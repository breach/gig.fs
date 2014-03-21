/**
 * TeaBag: teabag.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-28 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var async = require('async');
var common = require('../../lib/common.js');

// ## teabag
//
// Teabag Client API
//
// ```
// @spec { server, token }
// ```
var teabag = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.init = {
    done: false,
    callbacks: []
  };

  my.table = null;
  my.registry = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var register;  /* register(type, reduce, cb_()); */

  var get;       /* get(channel, type, path, cb_(err, value)); */
  var push;      /* push(channel, type, path, payload, cb_(err, value)); */

  var on;        /* on(channel, type, path, cb_(class, value, [op])); */

  //
  // #### _private_
  //
  
  //
  // #### _that_
  //
  var that = {};  
  
  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### get
  //
  // Retrieves the value for the given channel, type and path
  // ```
  // @channel {string} the channel name
  // @type    {string} the data type
  // @path    {string} the path to retrieve
  // @cb_     {function(err, value)} callback
  // ```
  get = function(channel, type, path, cb_) {
    if(!my.init.done) {
      my.init.callbacks.push(funtion(err) {
        if(err) {
          return cb_(err);
        }
        return get(channel, type, path, cb_);
      });
      return;
    }

    var c = my.table.channel(channel);
    if(!c) {
      return cb_(common.err('Unknown `channel`: ' + channel,
                            'TeaBagError:UnknownChannel'));
    }

    return c.get(type, path, cb_);
  };

  // ### push
  //
  // Pushes an operation on the oplog for the given channel, type, path
  // ```
  // @channel {string} the channel name
  // @type    {string} the data type
  // @path    {string} the path to retrieve
  // @payload {JSON} stringifiable JSON operation payload
  // @cb_     {function(err, value)} callback
  // ```
  push = function(channel, type, path, payload, cb_) {
    if(!my.init.done) {
      my.init.callbacks.push(funtion(err) {
        if(err) {
          return cb_(err);
        }
        return get(channel, type, path, cb_);
      });
      return;
    }

    var c = my.table.channel(channel);
    if(!c) {
      return cb_(common.err('Unknown `channel`: ' + channel,
                            'TeaBagError:UnknownChannel'));
    }

    var op = {
      date: Date.now(),
      payload: payload
    };
    op.sha = common.hash([ op.date.toString(),
                           JSON.stringify(op.payload) ]);

    return c.push(type, path, op, cb_);
  };

  // ### register
  //
  // Registers a reducer for the given type
  // ```
  // @type    {string} the data type
  // @reducer {function([oplog])} a reducer function
  // ```
  register = function(type, reducer) {
    my.registry[type ] = reducer;
  };

  // ### init
  //
  // Initialisation function called by user or at first call on the client API.
  // The initialization will retrieve the table from the server url using the
  // token provided and construct the associated objects (table, channel, 
  // stores)
  //
  // `init` can be called from multiple location, callbacks are queued and
  // caled once the init phase is completed.
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    if(!my.init.done) {
      my.init.callbacks.push(cb_);
    }
    else {
      return cb_();
    }
    if(my.init.callbacks.length > 1) {
      return;
    }

    my.table = require('./table.js').table({
      server: spec.server,
      token: spec.token,
      registry: my.registry
    });

    async.series([
      my.table.init
    ], function(err) {
      my.init.done = true;
      my.init.callbacks.forEach(function(cb_) {
        cb_(err);
      });
      my.init.callbacks = [];
    });
  };


  common.method(that, 'init', init, _super);
  common.method(that, 'register', register, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  common.method(that, 'on', on, _super);

  return that;
};

exports.teabag = teabag;

