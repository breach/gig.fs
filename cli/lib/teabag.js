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
var common = require('./common.js');

// ## teabag
//
// Teabag Client API
//
// ```
// @spec {}
// ```
var teabag = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var register;  /* register(type, reduce, cb_()); */

  var get;       /* get(channel, type, path, cb_(err, value)); */
  var push;      /* push(channel, type, path, op, cb_(err, value)); */

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


  common.method(that, 'init', init, _super);
  common.method(that, 'register', register, _super);

  common.method(that, 'get', get, _super);
  common.method(that, 'push', push, _super);

  common.method(that, 'on', on, _super);

  return that;
};

exports.teabag = teabag;
