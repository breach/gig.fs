/*
 * TeaBag: routes/token.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-02-19 spolu  Creation
 */
"use strict";

var querystring = require('querystring');
var util = require('util');
var http = require('http');
var async = require('async');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

/******************************************************************************/
/*                               UTILITY METHODS                              */
/******************************************************************************/

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### GET /user/:user_id/token
//
exports.get_token = function(req, res, next) {
  return res.ok();
  /* TODO(spolu): Push tokens on strs. */
};

//
// ### DEL /user/:user_id/token/:token
//
exports.del_token = function(req, res, next) {
  return res.ok();
  /* TODO(spolu): Revoke token on strs. */
};

