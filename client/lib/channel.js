/**
 * TeaBag: channel.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-03-05 spolu   Creation (on a plane!)
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var http = require('http');
var async = require('async');
var common = require('../../lib/common.js');

// ## channel
//
// Teabag Client Channel Object
//
// The channel object is the main object in charge of data reconciliation and
// propagation among the stores for that channel.
//
// ```
// @spec { name, json, token, registry }
// ```
var channel = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        


  my.name = spec.name;
  my.json = spec.json || {};
  my.token = spec.token;
  my.registry = spec.registry;

  my.stores = {};
  my.state = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */

  var get;       /* get(type, path, cb_(err, value)); */
  var push;      /* push(type, path, op, cb_(err, value)); */

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
    common.log.out('SYNCPRUNE: ' + type + ' ' + path);
    /* TODO(spolu): Implement. */
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
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
        if(!err && !replied) {
          replied = true;
          my.state[htp] = factory.hash([JSON.stringify(value)]);
          cb_(null, value);
        }
        return scb_();
      });
    }, function(err) {
      if(!replied) {
        cb_(common.err('All stores failed: [' + type + '] ' + path,
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
        if(!err && !replied) {
          replied = true;
          my.state[htp] = factory.hash([JSON.stringify(value)]);
          cb_(null, value);
        }
        return scb_();
      });
    }, function(err) {
      if(!replied) {
        cb_(common.err('All stores failed: [' + type + '] ' + path,
                       'ChannelError:AllStoresFailed'));
      }
    });
  };


  // ### init
  //
  // Inits the channel object mainly by instatiating and initializing the stores
  // object associated with this channel.
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    common.log.out('CHANNEL [' + my.name + '] Initialization');
    async.each(Object.keys(my.json), function(s, cb_) {
      my.stores[s] = require('./store.js').store({
        id: s,
        json: my.json[s],
        token: my.token,
        registry: my.registry
      });
      my.stores[s].init(cb_);

      my.stores[s].on('mutate', function(type, path, value) {
        /* State update trigger. */
        var htp = common.hash([type, path]);
        var hv = common.hash(JSON.stringify(value));
        if(my.state[htp] !== hv) {
          my.state[htp] = hv;
          that.emit('update', type, path, value);
        }
        /* Syncpruning trigger. */
        syncprune(type, path);
      });
    }, cb_);
  };

  common.method(that, 'init', init, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  return that;
};

exports.channel = channel;
