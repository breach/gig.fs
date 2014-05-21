/**
 * GiG.fs: store_remote.js
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

// ## store_remote
//
// GiG.fs Client Remote Store Object
//
// The remote store object starts by connecting to the oplog stream of the store 
// it is in charge of. Oplog events are filtered to the (type, path) tuples it
// already interacted with. It uses long-polling
//
// ```
// @spec { id, json, registry }
// @emits 'mutate'
// ```
var store_remote = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.store_token = null;
  my.tuples = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var kill;      /* kill(cb_()); */

  var get;       /* get(type, path, cb_); */
  var push;      /* push(type, path, op, cb_(err, value)); */

  var url;       /* url(); */

  //
  // #### _private_ 
  //
  var long_poll; /* long_poll(); */
  
  //
  // #### _that_
  //
  var that = require('./store.js').store(spec, my);

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### long_poll
  //
  // Runs the long polling on the store oplog stream endpoint. The long polling
  // is resilient to network errors
  long_poll = function() {
    if(my.killed)
      return;

    var handle_error = function(err) {
      common.log.error(err);
      my.lp_itv = setTimeout(long_poll, 1000);
    }

    var stream_url = my.store_url + 'oplog/stream' + 
      '?store_token=' + my.store_token;

    if(my.reg_id) {
      stream_url += '&reg_id=' + my.reg_id;
    }

    my.lp_req = request.get({
      url: stream_url,
      json: true
    }, function(err, res, data) {
      my.lp_req = null;
      if(err) {
        return handle_error(err);
      }
      if(res.statusCode === 200 && data && !data.error) {
        if(data.reg_id) {
          my.reg_id = data.reg_id;
        }
        /* We push the values on the local oplog and emit an update event. */
        /* This means that the sync & prune need not be triggered by the   */
        /* original push as it will be triggered here.                     */
        async.eachSeries(data.stream, function(data, cb_) {
          /* If the op originated from this node, this push will be entirely */
          /* cached and won't mutate the state.                              */
          that.push(data.type, data.path, data.op, cb_);
        }, function(err) {
          /* The only error possible here is if the reducer failed so we just */
          /* ignore it as there's not much we can do from here.               */
        });

        return long_poll();
      }
      else {
        var err = common.err('Store stream error: ' + stream_url,
                             'StoreError:StreamError');
        if(data && data.error) {
          err = common.err(data.error.message,
                           data.error.name);
        }
        return handle_error(err);
      }
    });
  };
  
  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### url
  //
  // Returns the store url
  url = function() {
    return my.json.url || null;
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
    else {
      var oplog_url = my.store_url + 'oplog' + '?type=' + type + 
        '&path=' + escape(path) + '&store_token=' + my.store_token;

      request.get({
        url: oplog_url,
        json: true
      }, function(err, res, oplog) {
        if(err) {
          return cb_(err);
        }
        if(Array.isArray(oplog)) {
          try {
            my.tuples[type] = my.tuples[type] || {};
            my.tuples[type][path] = {
              oplog: oplog,
              value: my.registry[type](oplog)
            };
            if(typeof my.tuples[type][path].value === 'undefined') {
              throw common.err('Reducer `value` undefined',
                               'ReducerError:ValueUndefined');
            }
            return cb_(null, 
                       my.tuples[type][path].value,
                       my.tuples[type][path].oplog);
          }
          catch(err) {
            return cb_(err);
          }
        }
        else {
          var err = common.err('Store oplog error: ' + oplog_url,
                               'StoreError:OplogError');
          if(oplog && oplog.error) {
            err = common.err(oplog.error.message,
                             oplog.error.name);
          }
          return cb_(err);
        }
      });
    }
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
            common.log.debug('NOOP: ' + op.sha);
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
          common.log.debug('PRUNING: ' + my.tuples[type][path].oplog[i].sha + 
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

        var oplog_url = my.store_url + 'oplog' + '?type=' + type + 
          '&path=' + escape(path) + '&store_token=' + my.store_token;

        request.post({
          url: oplog_url,
          json: op
        }, function(err, res, json) {
          /* We can't provide feedback here but we'll print errors. */
          if(err) {
            common.log.error(err);
          }
          if(res.statusCode !== 200 || !json.ok) {
            var err = common.err('Store oplog error: ' + oplog_url,
                                 'StoreError:OplogError');
            if(json && json.error) {
              err = common.err(json.error.message,
                               json.error.name);
            }
            common.log.error(err);
          }
        });
      }
    });
  };

  // ### init
  //
  // Inits the channel by connecting to its oplog stream. This is a long-polling
  // connection resilient to deconnexions and errors.
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    async.series([
      _super.init,
      function(cb_) {
        my.store_token = my.json.store_token;
        var url_p = require('url').parse(my.json.url || '');
        if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
           url_p.query || url_p.search || 
           !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
          return cb_(common.err('Invalid store URL: ' + my.json.url,
                                'StoreError:InvalidUrl'));
        }

        my.store_url = url_p.href;
        long_poll();
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
        if(my.lp_req) {
          my.lp_req.abort();
          my.lp_req = null;
        }
        if(my.lp_itv) {
          clearTimeout(my.lp_itv);
          my.lp_itv = null;
        }
        return cb_();
      }
    ], cb_);
  };


  common.method(that, 'url', url, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  return that;
};

exports.store_remote = store_remote;
