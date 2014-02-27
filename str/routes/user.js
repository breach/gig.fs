/*
 * TeaBag: routes/user.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-02-26 spolu  Creation
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
// ### GET /user/:user_id/confirm
//
exports.get_confirm = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'UserError:InvalidUserId'));
  }

  var code = req.param('code');
  if(typeof code !== 'string' || 
     code.length === 0 || code.split('_').length !== 3) {
    return res.error(common.err('Invalid `code`: ' + req.param('code'),
                                'UserError:InvalidCode'));
  }

  var user = null;

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      if(parseInt(code.split('_')[0], 10) !== user_id) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      if(!parseInt(code.split('_')[1], 10) ||
         parseInt(code.split('_')[1], 10) < Date.now()) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      if(code.split('_')[2] !== common.hash([common.KEY,
                                            code.split('_')[0].toString(),
                                            code.split('_')[1].toString()])) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      return cb_();
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok();
  });
};


