/*
 * TeaBag: routes/admin.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-02-28 spolu  Updated `code` format
 * - 2014-02-27 spolu  Creation
 */
"use strict";

var querystring = require('querystring');
var util = require('util');
var async = require('async');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

/******************************************************************************/
/*                               UTILITY METHODS                              */
/******************************************************************************/
// ### user_create 
//
// Utility method to create a user. It's indempotent and does not override
// existing users.
// ```
// @user_id {number} the user_id to create
// @cb_     {function(err), user}
// ```
exports.user_create = function(user_id, cb_) {
  storage.get(user_id, 'user.json', function(err, json) {
    if(err && err.code === 'ENOENT') {
      async.parallel({
        'user.json': function(cb_) {
          return storage.put(user_id, 'user.json', {}, cb_);
        }
      }, function(err) {
        return cb_(err, {});
      });
    }
    else if(err) {
      return cb_(err);
    }
    else {
      return cb_(null, json);
    }
  });
};

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### PUT /admin/user/:user_id
//
exports.put_user = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'AdminError:InvalidUserId'));
  }

  var user = null;

  async.series([
    function(cb_) {
      exports.user_create(user_id, function(err, json) {
        user = json;
        return cb_(err);
      });
    },
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok();
  });
};

//
// ### GET /admin/user/:user_id/code
//
exports.get_code = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'AdminError:InvalidUserId'));
  }

  var user = null;
  var code = null;
  var expiry = null;

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      var now = Date.now();
      expiry = now + 1000 * 60 * 2;
      code = now + '_' + expiry + '_' + 
             common.hash([common.KEY,
                          user_id.toString(),
                          now.toString(),
                          expiry.toString()]);
      return cb_();
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data({
      code: code,
      expiry: expiry
    });
  });
};

