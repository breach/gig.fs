/**
 * GiG.fs: channel.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-13 spolu  `local_table/remote_table` API
 * - 2014-04-11 spolu  `in_memory` mode
 * - 2014-04-04 spolu   Add `kill` method
 * - 2014-03-05 spolu   Creation (on a plane!)
 */
"use strict";

var util = require('util');
var events = require('events');
var async = require('async');
var common = require('../../lib/common.js');

// ## channel
//
// GiG.fs Client Channel Object
//
// The channel object is the main object in charge of data reconciliation and
// propagation among the stores for that channel.
//
// ```
// @spec { name, json, registry }
// ```
var channel = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.json = spec.json || {};

  my.name = spec.name;
  my.registry = spec.registry;

  my.stores = {};
  my.state = {};

  my.killed = false;

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var kill;      /* kill(cb_()); */

  var get;       /* get(type, path, cb_(err, value)); */
  var push;      /* push(type, path, op, cb_(err, value)); */

  var store;     /* store(id); */
  var stores;    /* stores(); */

  //
  // #### _private_
  //
  var syncprune; /* syncprune(type, path); */
  
  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### syncprune
  //
  // Sync the different stores for that channel and attemps a pruning operation
  // if applicable and no syncing is required.
  // ```
  // @type {string} the data type
  // @path {string} the path to retrieve
  // ```
  syncprune = function(type, path) {
    if(my.killed)
      return;

    common.log.out('SYNCPRUNE: ' + type + ' ' + path);
    var synced = false;
    var oplogs = {};
    var values = {};
    async.series([
      function(cb_) {
        /* SYNCING */
        common.log.out('SYNC: ' + type + ' ' + path);
        async.each(Object.keys(my.stores), function(s, cb_) {
          my.stores[s].get(type, path, function(err, value, oplog) {
            if(err) {
              common.log.error(err);
            }
            else {
              oplogs[s] = oplog;
            }
            return cb_();
          });
        }, function() {
          async.each(Object.keys(oplogs), function(dst, cb_) {
            async.each(Object.keys(oplogs), function(src, cb_) {
              async.each(oplogs[src], function(op, cb_) {
                my.stores[dst].push(type, path, op, function(err, value, noop) {
                  if(err) {
                    common.log.error(err);
                  }
                  else {
                    if(!noop) {
                      synced = true;
                    }
                    values[dst] = value;
                  }
                  return cb_();
                });
              }, cb_);
            }, cb_);
          }, cb_);
        });
      },
      function(cb_) {
        /* PRUNING */
        if(synced) {
          return cb_();
        }
        var length = null;
        Object.keys(oplogs).forEach(function(s) {
          if(!length) {
            length = oplogs[s].length;
            //console.log(length);
          }
          else if(oplogs[s].length !== length) {
            return cb_(common.err('Oplog length mismatch at pruning : ' + 
                                  '[' + type + '] ' + path,
                                  'ChannelError:OplogLengthMismatch'));
          }
        });
        if(length <= 1) {
          return cb_();
        }
        common.log.out('PRUNE: ' + type + ' ' + path);
        var value = null;
        var hv = '';
        Object.keys(values).forEach(function(s) {
          if(!value) {
            value = values[s];
            hv = common.hash([JSON.stringify(value)]);
          }
          else if(common.hash([JSON.stringify(values[s])]) !== hv) {
            return cb_(common.err('Values mismatch at pruning : ' + 
                                  '[' + type + '] ' + path,
                                  'ChannelError:ValuesMismatch'));
          }
        });
        var op = {
          date: Date.now(),
          value: value
        }
        op.sha = common.hash([ op.date.toString(),
                               JSON.stringify(op.value) ]);
        common.log.out('PUSHING: ' + op.sha);
        async.each(Object.keys(my.stores), function(s, cb_) {
          my.stores[s].push(type, path, op, cb_);
        }, cb_);
      }
    ], function(err) {
      if(err) {
        common.log.error(err);
      }
    });
  };


  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### store
  //
  // Returns the store object for the requested store
  // ```
  // @channel {string} the channel name
  // ```
  store = function(id) {
    return (my.stores[id] || null);
  };

  // ### stores
  //
  // Returns the list of available stores ids
  stores = function() {
    return Object.keys(my.stores);
  };


  // ### get
  //
  // Retrieves a value for this channel. See README for the conflict resolution
  // model. We reply as soon as a value is received.
  // ```
  // @type {string} the data type
  // @path {string} the path to retrieve
  // @cb_  {function(err, value)} callback
  // ```
  get = function(type, path, cb_) {
    var htp = common.hash([type, path]);
    var replied = false;
    async.each(Object.keys(my.stores), function(s, scb_) {
      my.stores[s].get(type, path, function(err, value) {
        if(err) {
          if(err.name === 'ReducerError:TypeNotRegistered' ||
             err.name === 'ReducerError:ValueUndefined') {
            return scb_(err);
          }
          common.log.error(err);
        }
        if(!err && !replied) {
          replied = true;
          my.state[htp] = common.hash([JSON.stringify(value)]);
          cb_(null, value);
        }
        return scb_();
      });
    }, function(err) {
      if(!replied) {
        if(err) {
          return cb_(err);
        }
        return cb_(common.err('All stores failed: [' + type + '] ' + path,
                              'ChannelError:AllStoresFailed'));
      }
      else {
        syncprune(type, path);
      }
    });
  };

  // ### push
  //
  // Pushes an operation on the oplog. See README for the conflict resolution
  // model. We reply as soon as the value was accepted by one store.
  // ```
  // @type {string} the data type
  // @path {string} the path to push to
  // @op   {object} the operation to push on the oplog
  // @cb_  {function(err, value)} callback
  // ```
  push = function(type, path, op, cb_) {
    var htp = common.hash([type, path]);
    var replied = false;
    async.each(Object.keys(my.stores), function(s, scb_) {
      my.stores[s].push(type, path, op, function(err, value) {
        if(err) {
          if(err.name === 'ReducerError:TypeNotRegistered' ||
             err.name === 'ReducerError:ValueUndefined') {
            return scb_(err);
          }
          common.log.error(err);
        }
        if(!err && !replied) {
          replied = true;
          my.state[htp] = common.hash([JSON.stringify(value)]);
          cb_(null, value);
        }
        return scb_();
      });
    }, function(err) {
      if(!replied) {
        if(err) {
          return cb_(err);
        }
        return cb_(common.err('All stores failed: [' + type + '] ' + path,
                              'ChannelError:AllStoresFailed'));
      }
    });
  };


  // ### init
  //
  // Inits the channel object 
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    async.each(Object.keys(my.json), function(s, cb_) {
      if(my.json[s].type === 'remote') {
        my.stores[s] = require('./store_remote.js').store_remote({
          id: s,
          json: my.json[s],
          registry: my.registry
        });
      }
      else {
        my.stores[s] = require('./store_local.js').store_local({
          id: s,
          json: my.json[s],
          registry: my.registry
        });
      }
      my.stores[s].init(cb_);

      my.stores[s].on('mutate', function(type, path, value) {
        /* State update trigger. */
        var htp = common.hash([type, path]);
        var hv = common.hash([JSON.stringify(value)]);
        if(my.state[htp] !== hv) {
           my.state[htp] = hv;
          common.log.out('UPDATE: [' + type + '] ' + path + ' ' + hv);
          that.emit('update', type, path, value);
        }
        /* Syncpruning trigger. */
        process.nextTick(function() {
          syncprune(type, path);
        });
      });
    }, cb_);
  };

  // ### kill
  //
  // Cleans-up and terminates this channell (and all long-poll connections)
  //
  // ```
  // @cb_ {function(err)}
  // ```
  kill = function(cb_) {
    that.removeAllListeners();
    my.killed = true;
    async.each(Object.keys(my.stores), function(s, cb_) {
      my.stores[s].kill(cb_);
    }, cb_);
  };

  common.method(that, 'store', store, _super);
  common.method(that, 'stores', stores, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  return that;
};

exports.channel = channel;
