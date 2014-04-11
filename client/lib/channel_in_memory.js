/**
 * GiG.fs: channel_in_memory.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-11 spolu  `in_memory` mode
 * - 2014-04-11 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var async = require('async');
var common = require('../../lib/common.js');

// ## channel_in_memory.js
//
// GiG.fs Client Channel In Memory Object
//
// Stores data in memory without interacting with any store.
//
// ```
// @spec { name, registry }
// ```
var channel_in_memory = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.memory = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var kill;      /* kill(cb_()); */

  var get;       /* get(type, path, cb_(err, value)); */
  var push;      /* push(type, path, op, cb_(err, value)); */

  //
  // #### _private_
  //
  
  //
  // #### _that_
  //
  var that = require('./channel.js').channel(spec, my);

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### get
  //
  // Retrieves a value for this channel. 
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
    var htp = common.hash([type, path]);
    
    if(!my.memory[htp]) {
      var op = {
        date: 0,
        value: null
      };
      op.sha = common.hash([ op.date.toString(),
                             JSON.stringify(op.value) ]);
      my.memory[htp] = [op];
    }

    return cb_(null, my.registry[type](my.memory[htp]));
  };

  // ### push
  //
  // Pushes an operation on the oplog. 
  // ```
  // @type {string} the data type
  // @path {string} the path to push to
  // @op   {object} the operation to push on the oplog
  // @cb_  {function(err, value)} callback
  // ```
  push = function(type, path, op, cb_) {
    if(!my.registry[type]) {
      return cb_(common.err('Type not registered: ' + type,
                            'StoreError:TypeNotRegistered'));
    }
    var htp = common.hash([type, path]);
    
    if(!my.memory[htp]) {
      var original_op = {
        date: 0,
        value: null
      };
      original_op.sha = common.hash([ original_op.date.toString(),
                                      JSON.stringify(original_op.value) ]);
      my.memory[htp] = [original_op];
    }

    my.memory[htp].push(op);
    my.memory[htp].sort(function(o1, o2) {
      return o1.date - o2.date;
    });

    var value = my.registry[type](my.memory[htp]);
    var pruning_op = {
      date: Date.now(),
      value: value
    }
    pruning_op.sha = common.hash([ pruning_op.date.toString(),
                                   JSON.stringify(pruning_op.value) ]);
    my.memory[htp] = [pruning_op];

    return cb_(null, value);
  };


  // ### init
  //
  // Inits the channel object 
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    return _super.init(cb_);
  };

  // ### kill
  //
  // Cleans-up and terminates this channell (and all long-poll connections)
  //
  // ```
  // @cb_ {function(err)}
  // ```
  kill = function(cb_) {
    return _super.kill(cb_);
  };


  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  return that;
};

exports.channel_in_memory = channel_in_memory;
