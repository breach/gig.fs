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

  //
  // _public_
  // 
  var init;      /* init(cb_()); */

  var get;       /* get(type, path, cb_(err, value)); */
  var push;      /* push(type, path, op, cb_(err, value)); */

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
  // Retrieves a value for this channel. The concurrency model is fairly simple:
  // Each store is asked for a value, as soon as the first one responds, the
  // value is returned to the called
  // ```
  // @type {string} the data type
  // @path {string} the path to retrieve
  // @cb_  {function(err, value)} callback
  // ```
  get = function(type, path, cb_) {
    var replied = false;
    Object.keys(my.stores).forEach(function(s) {
      my.stores[s].get(type, path, function(err, value) {
        if(!replied) {
          replied = true;
          return cb_(err, value);
        }
        /* NOP. */
      });
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
    }, cb_);
  };

  common.method(that, 'init', init, _super);

  return that;
};

exports.channel = channel;
