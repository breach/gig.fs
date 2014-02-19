/*
 * TeaBag: routes/admin.js
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
// ### PUT /user/:user_id
//
exports.put_user = function(req, res, next) {
  return res.ok();
};

//
// ### PUT /user/:user_id/master/:master
//
exports.put_master = function(req, res, next) {
  return res.ok();
  /* TODO(spolu): Revoke all tokens. */
};

