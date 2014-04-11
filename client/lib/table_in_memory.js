/**
 * GiG.fs: table_in_memory.js
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
var fs = require('fs');
var async = require('async');
var request = require('request');
var common = require('../../lib/common.js');

// ## table_in_memory
//
// GiG.fs Client In Memory Table Object
//
// ```
// @spec    { registry, channels }
// @extends table
// ```
var table_in_memory = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  //
  // _public_
  // 
  var init;      /* init(cb_()); */

  //
  // #### _that_
  //
  var that = require('./table.js').table(spec, my);

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### init
  //
  // Inits the table by constructing the in_memory channels based on the
  // `channels` argument.
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    async.series([
      _super.init,
      function(cb_) {
        async.each(spec.channels || [], function(c, cb_) {
          my.channels[c] = require('./channel_in_memory.js').channel_in_memory({
            name: c,
            registry: my.registry
          });
          my.channels[c].init(cb_);
        }, cb_);
      }
    ], cb_);
  };

  common.method(that, 'init', init, _super);

  return that;
};

exports.table_in_memory = table_in_memory;
