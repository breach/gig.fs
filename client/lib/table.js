/**
 * GiG.fs: table.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-11 spolu  `in_memory` mode
 * - 2014-04-04 spolu   Add `kill` method
 * - 2014-03-20 spolu   Use `request` package
 * - 2014-03-01 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var async = require('async');
var request = require('request');
var common = require('../../lib/common.js');

// ## table
//
// GiG.fs Client Table Object
//
// The base table object exposing the table interace. Two implemetations inherit
// from it, `talbe_in_memory`, `table_networked`
//
// TODO(spolu):
// - Emitting events to notify of any change on the table structure
//
// ```
// @spec { registry }
// ```
var table = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.registry = spec.registry;
  my.channels = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var kill;      /* kill(cb_()); */

  var channel;   /* channel(channel); */
  var channels;  /* channels(); */

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
  // ### channel
  //
  // Returns the channel object for the requested channel
  // ```
  // @channel {string} the channel name
  // ```
  channel = function(channel) {
    return (my.channels[channel] || null);
  };

  // ### channels
  //
  // Returns the list of available channels
  channels = function() {
    return Object.keys(my.channels);
  };

  // ### init
  //
  // Inits the table object by contacting the server with the provided token
  // and copying locally the table information, creating associated channel
  // and store objects.
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    common.log.debug('TABLE Initialization');
    return cb_();
  };

  // ### kill
  //
  // Cleans-up and terminates this table (and all long-poll connections)
  //
  // ```
  // @cb_ {function(err)}
  // ```
  kill = function(cb_) {
    async.each(Object.keys(my.channels), function(c, cb_) {
      my.channels[c].kill(cb_);
    }, cb_);
  };

  common.method(that, 'channel', channel, _super);
  common.method(that, 'channels', channels, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.table = table;

