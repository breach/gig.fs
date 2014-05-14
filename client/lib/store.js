/**
 * GiG.fs: store.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-13 spolu  `local_table/remote_table` API
 * - 2014-04-04 spolu   Add `kill` method
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
// GiG.fs Client Store Object
//
// The store object interfaces the gig.fs client with the stores associated
// with the different channels it uses. The store object shows the actual state
// of the store and may not reflect the last known state for a given channel.
// (eg. no connection)
//
// Stores can be local (persistent or in memory) or remotes (store URL).
//
// An operation is made of a date, a hash and a payload:
// ```
// { date: 13120123913,
//   sha: ae7c...,
//   payload: { ... } }
// ```
//
// ```
// @spec { id, json, registry }
// @emits 'mutate'
// ```
var store = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.id = spec.id;
  my.json = spec.json || {};
  my.registry = spec.registry;

  my.killed = false;

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var kill;      /* kill(cb_()); */

  var get;       /* get(type, path, cb_); */
  var push;      /* push(type, path, op, cb_(err, value)); */

  //
  // #### _private_ 
  //
  
  //
  // #### _that_
  //
  var that = new events.EventEmitter();

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  
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
  // @cb_  {function(err, value, oplog)} callback
  // ```
  get = function(type, path, cb_) {
    return cb_(common.err('`get` Must be implemented',
                          'StoreError:ImplementationMissing'));
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
    return cb_(common.err('`push` Must be implemented',
                          'StoreError:ImplementationMissing'));
  };

  // ### init
  //
  // Basic initialisation
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    common.log.debug('STORE [' + my.id + '] Initialization');
    return cb_();
  };

  // ### kill
  //
  // Cleans up event handlers and mark this sotre as killed.
  // ```
  // @cb_ {function(err)}
  // ```
  kill = function(cb_) {
    that.removeAllListeners();
    my.killed = true;
    return cb_();
  };


  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  return that;
};

exports.store = store;
