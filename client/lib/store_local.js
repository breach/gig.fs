/**
 * GiG.fs: store_local.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-13 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var request = require('request');

var async = require('async');
var common = require('../../lib/common.js');

// ## store_local
//
// GiG.fs Client Local Store Object
//
// The local store object stores and retrieves data locally (or in memory if no
// `storage_path` is provided). There is no long-polling as all clients are
// supposed to go through this instance for local storage (no polling on local
// file system).
//
// ```
// @spec { id, json, registry }
// @emits 'mutate'
// ```
var store_local = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.tuples = {};
  my.storage = null;

  //
  // _public_
  // 
  var init;         /* init(cb_()); */
  var kill;         /* kill(cb_()); */

  var get;          /* get(type, path, cb_); */
  var push;         /* push(type, path, op, cb_(err, value)); */

  var storage_path; /* storage_path(); */
  var in_memory;    /* in_memory(); */

  //
  // #### _private_ 
  //
  var empty_oplog;    /* empty_oplog(); */
  
  //
  // #### _that_
  //
  var that = require('./store.js').store(spec, my);

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### empty_log
  //
  // Helper function to genarate an empty log
  empty_oplog = function() {
    var op = {
      date: 0,
      value: null
    };
    op.sha = common.hash([ op.date.toString(),
                           JSON.stringify(op.value) ]);
    return [op];
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### storage_path
  //
  // Returns the store storage_path
  storage_path = function() {
    return my.json.storage_path || null;
  };

  // ### in_memory
  //
  // Returns wether the store lives in memory or not
  in_memory = function() {
    return my.json.in_memory || null;
  };

  // ### get
  //
  // Retrieves a value from the store and starts keeping the associated oplog
  // updated for that tuple (type, path)
  // ```
  // @type {string} the data type
  // @path {string} the path to retrieve
  // @cb_  {function(err, value, oplog)} callback
  // ```
  get = function(type, path, cb_) {
    if(!my.registry[type]) {
      return cb_(common.err('Type not registered: ' + type,
                            'ReducerError:TypeNotRegistered'));
    }
    if(my.tuples[type] && my.tuples[type][path]) {
      return cb_(null, 
                 my.tuples[type][path].value,
                 my.tuples[type][path].oplog);
    }
    var oplog = [];

    async.series([
      function(cb_) {
        if(my.storage) {
          var release = null;
          async.series([
            function(cb_) {
              my.storage.lock(type + '/' + path, function(rel_) {
                release = rel_;
                return cb_();
              });
            },
            function(cb_) {
              my.storage.get(type + '/' + path, function(err, json) {
                if(err) {
                  if(err.code === 'ENOENT') {
                    oplog = empty_oplog();
                    return cb_();
                  }
                  else {
                    return cb_(err);
                  }
                }
                oplog = json;
                return cb_();
              });
            },
            function(cb_) {
              release();
              return cb_();
            }
          ], cb_);
        }
        else {
          /* If we haven't found the value yet, we just continue with an */
          /* emtpy oplog.                                                */
          oplog = empty_oplog();
        }
      },
      function(cb_) {
        my.tuples[type] = my.tuples[type] || {};
        my.tuples[type][path] = {
          oplog: oplog,
          value: my.registry[type](oplog)
        };
        if(typeof my.tuples[type][path].value === 'undefined') {
          return cb_(common.err('Reducer `value` undefined',
                                'ReducerError:ValueUndefined'));
        }
        else {
          return cb_();
        }
      }
    ], function(err) {
      if(err) {
        return cb_(err);
      }
      else {
        return cb_(null, 
                   my.tuples[type][path].value,
                   my.tuples[type][path].oplog);
      }
    });
  };

  // ### push
  //
  // Pushes an operation on the oplog. The operation is not necessarilly the
  // last one and this function can be used to merge oplogs. If the operation
  // is already known, this call is ignored. Once the operation has been merged,
  // the value is recomputed and the new oplog pushed to the store.
  //
  // The callback is returned once the store has accepted the operation.
  // ```
  // @type {string} the data type
  // @path {string} the path to retrieve
  // @op   {object} the operation to push on the oplog
  // @cb_  {function(err, value, noop)} callback
  // ```
  push = function(type, path, op, cb_) {
    var noop = false;
    async.series([
      function(cb_) {
        get(type, path, cb_);
      },
      function(cb_) {
        /* NOOP Detection */
        for(var i = 0; i < my.tuples[type][path].oplog.length; i ++) {
          if(op.sha === my.tuples[type][path].oplog[i].sha ||
             (my.tuples[type][path].oplog[i].value &&
              my.tuples[type][path].oplog[i].date > op.date)) {
            noop = true;
            common.log.out('NOOP: ' + op.sha);
            return cb_();
          }
        }
        /* Insertion / Sorting */
        my.tuples[type][path].oplog.push(op);
        my.tuples[type][path].oplog.sort(function(o1, o2) {
          return o1.date - o2.date;
        });
        /* Pruning */
        var i = 0;
        for(i = my.tuples[type][path].oplog.length - 1; i >= 0; i--) {
          if(my.tuples[type][path].oplog[i].value && i > 0) {
            break
          }
        }
        if(i > 0) {
          common.log.out('PRUNING: ' + my.tuples[type][path].oplog[i].sha + 
                         ' '  + i + ' / ' + my.tuples[type][path].oplog.length);
          my.tuples[type][path].oplog.splice(0, i);
        }

        try {
          my.tuples[type][path].value = 
            my.registry[type](my.tuples[type][path].oplog);
          if(typeof my.tuples[type][path].value === 'undefined') {
            throw common.err('Reducer `value` undefined',
                             'ReducerError:ValueUndefined');
          }
        }
        catch(err) {
          return cb_(err);
        }
        return cb_();
      }
    ], function(err) {
      if(err) {
        return cb_(err);
      }
      /* We return the callback as soon as the op is pushed in memory. */
      cb_(null, my.tuples[type][path].value, noop);

      if(!noop) {
        /* This is not a NOOP so we emit an mutate event for syncpruning. */
        that.emit('mutate', type, path, my.tuples[type][path].value);

        if(my.storage) {
          var release = null;
          async.series([
            function(cb_) {
              my.storage.lock(type + '/' + path, function(rel_) {
                release = rel_;
                return cb_();
              });
            },
            function(cb_) {
              my.storage.put(type + '/' + path, my.tuples[type][path].oplog, 
                             cb_);
            },
            function(cb_) {
              release();
              return cb_();
            }
          ], function(err) {
            if(err) {
              common.log.error(err);
            }
          });
        }
      }
    });
  };

  // ### init
  //
  // Inits the store by instantiating the underlying storage if applicable.
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    async.series([
      _super.init,
      function(cb_) {
        if(my.json.storage_path) {
          my.storage = require('./../../lib/storage.js').storage({
            data_path: my.json.storage_path
          });
        }
        return cb_();
      }
    ], cb_);
  };

  // ### kill
  //
  // Cleans-up and terminates this store (and all long-poll connections)
  //
  // ```
  // @cb_ {function(err)}
  // ```
  kill = function(cb_) {
    async.series([
      _super.kill,
      function(cb_) {
        return cb_();
      }
    ], cb_);
  };


  common.method(that, 'storage_path', storage_path, _super);
  common.method(that, 'in_memory', in_memory, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  return that;
};

exports.store_local = store_local;

