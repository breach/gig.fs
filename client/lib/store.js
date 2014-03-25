/**
 * TeaBag: channel.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-03-20 spolu   Use `request` package
 * - 2014-03-05 spolu   Creation (on a plane!)
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var request = require('request');

var async = require('async');
var common = require('../../lib/common.js');

// ## store
//
// Teabag Client Channel Object
//
// The store object interfaces the teabag client with the stores associated
// with the different channels it uses. The store object shows the actual state
// of the store and may not reflect the last known state for a given channel.
// (eg. no connection)
//
// The store object starts by connecting to the oplog stream of the store it is
// in charge of. Oplog events are filtered to the (type, path) tuples it
// already interacted with. It uses long-polling
//
// An operation is made of a date, a hash and a payload:
// ```
// { date: 13120123913,
//   sha: ae7c...,
//   payload: { ... } }
// ```
//
// ```
// @spec { id, json, token, registry }
// ```
var store = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        


  my.id = spec.id;
  my.json = spec.json || {};
  my.token = spec.token;
  my.registry = spec.registry;

  my.tuples = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */

  var get;       /* get(type, path, cb_); */
  var push;      /* push(type, path, op, cb_(err, value)); */

  //
  // #### _private_ 
  //
  var long_poll; /* long_poll(); */
  
  //
  // #### _that_
  //
  var that = {};  

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### long_poll
  //
  // Runs the long polling on the store oplog stream endpoint. The long polling
  // is resilient to network errors
  long_poll = function() {
    var handle_error = function(err) {
      common.log.error(err);
      my.lp_itv = setTimeout(long_poll, 1000);
    }

    var stream_url = my.store_url + 'oplog/stream' + 
      '?token=' + my.token;

    if(my.reg_id) {
      stream_url += '&reg_id=' + reg_id;
    }

    my.lp_req = request.get({
      url: stream_url,
      json: true
    }, function(err, res, data) {
      my.lp_req = null;
      if(err) {
        handle_error(err);
      }
      if(res.statusCode === 200 && data && !data.error) {
        console.log(JSON.stringify(data, null, 2));
        /* TODO(spolu): handle data. */
        return long_poll();
      }
      else {
        var err = common.err('Store Stream Error: ' + stream_url,
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
  // ### get
  //
  // Retrieves a value from the store and starts keeping the associated oplog
  // updated for that tuple (type, path)
  // ```
  // @type {string} the data type
  // @path {string} the path to retrieve
  // @cb_  {function(err, value)} callback
  // ```
  get = function(type, path, cb_) {
    if(!my.registry[type]) {
      return cb_(common.err('Type not registered: ' + type,
                            'StoreError:TypeNotRegistered'));
    }
    if(my.tuples[type] && my.tuples[type][path]) {
      return cb_(null, my.tuples[type][path].value);
    }
    else {
      var oplog_url = my.store_url + 'oplog' +
        '?type=' + type + '&path=' + escape(path) + '&token=' + my.token;

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
            return cb_(null, my.tuples[type][path].value);
          }
          catch(err) {
            return cb_(err);
          }
        }
        else {
          var err = common.err('Store Oplog Error: ' + oplog_url,
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
  // @cb_  {function(err, value)} callback
  // ```
  push = function(type, path, op, cb_) {
    async.series([
      function(cb_) {
        get(type, path, cb_);
      },
      function(cb_) {
        for(var i = 0; i < my.tuples[type][path].oplog.length; i ++) {
          if(op.sha === my.tuples[type][path].oplog[i].sha) {
            /* We found the operation so there's nothing to do here. Move on. */
            return cb_();
          }
        }
        my.tuples[type][path].oplog.push(op);
        my.tuples[type][path].oplog.sort(function(o1, o2) {
          return o1.date - o2.date;
        });

        try {
          my.tuples[type][path].value = 
            my.registry[type](my.tuples[type][path].oplog);
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
      cb_(null, my.tuples[type][path].value);

      var oplog_url = my.store_url + 'oplog' +
        '?type=' + type + '&path=' + escape(path) + '&token=' + my.token;

      request.post({
        url: oplog_url,
        json: op
      }, function(err, res, json) {
        /* We can't provide feedback here but we'll print errors. */
        if(err) {
          common.log.error(err);
        }
        if(res.statusCode !== 200 || !json.ok) {
          var err = common.err('Store Oplog Error: ' + oplog_url,
                               'StoreError:OplogError');
          if(json && json.error) {
            err = common.err(json.error.message,
                             json.error.name);
          }
          common.log.error(err);
        }
      });
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
    var url_p = require('url').parse(my.json.url || '');
    if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
       url_p.query || url_p.search || 
       !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
      return cb_(common.err('Invalid store URL: ' + my.json.url,
                            'StoreError:InvalidUrl'));
    }

    my.store_url = url_p.href;
    long_poll();

    common.log.out('STORE [' + my.id + '] Initialization');
    return cb_();
  };

  common.method(that, 'init', init, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  return that;
};

exports.store = store;
