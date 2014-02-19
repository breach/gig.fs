/*
 * TeaBag: routes/table.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-02-19 spolu  Creation
 */
var querystring = require('querystring');
var common = require('../../lib/common.js');
var util = require('util');
var http = require('http');
var async = require('async');

/******************************************************************************/
/*                               UTILITY METHODS                              */
/******************************************************************************/

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### PUT /user/:user_id/table/:channel/:str_host
//
exports.put_channel_host = function(req, res, next) {
  return res.ok();
};

//
// ### DEL /user/:user_id/table/:channel/:str_host
//
exports.del_channel_host = function(req, res, next) {
  return res.ok();
};

//
// ### DEL /user/:user_id/table/:channel
//
exports.del_channel = function(req, res, next) {
  return res.ok();
};

//
// ### GET /user/:user_id/table/:channel
//
exports.get_channel = function(req, res, next) {
  return res.ok();
};

//
// ### GET /user/:user_id/table
//
exports.get_table = function(req, res, next) {
  return res.ok();
};

