/*
 * TeaBag: routes/user.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-02-28 spolu  Updated `code` format
 * - 2014-02-26 spolu  Creation
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

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### POST /user/:user_id/confirm
//
exports.post_confirm = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'UserError:InvalidUserId'));
  }

  if(!req.body ||
     typeof req.body.table_url !== 'string' ||
     typeof req.body.code !== 'string') {
    return res.error(common.err('Invalid POST body: ' + JSON.stringify(req.body),
                                'UserError:InvalidPostBody'));
  }
  var code = req.body.code;
  if(typeof code !== 'string' || 
     code.length === 0 || code.split('_').length !== 3) {
    return res.error(common.err('Invalid `code`: ' + req.body.code,
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
      if(!parseInt(code.split('_')[0], 10) ||
         parseInt(code.split('_')[0], 10) >= Date.now()) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      if(!parseInt(code.split('_')[1], 10) ||
         parseInt(code.split('_')[1], 10) < Date.now()) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      if(code.split('_')[2] !== common.hash([common.KEY,
                                             user_id.toString(),
                                             code.split('_')[0].toString(),
                                             code.split('_')[1].toString()])) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      return cb_();
    },
    function(cb_) {
      var url_p = require('url').parse(req.body.table_url);
      if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
         url_p.query || url_p.search || 
         !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
        return cb_(common.err('Invalid URL: ' + req.body.table_url,
                              'UserError:InvalidTableUrl'));
      }
      var table_url = url_p.href;
      user.table = {
        id: common.hash([table_url]),
        url: table_url,
        created_time: Date.now()
      };
      return storage.put(user_id, 'user.json', user, cb_);
    },
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok();
  });
};

//
// ### POST /user/:user_id/oplog
//
exports.post_oplog = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'UserError:InvalidUserId'));
  }

  var token = req.param('token');

  if(typeof token !== 'string' || token.length === 0) {
    return res.error(common.err('Invalid `token`: ' + req.param('token'),
                                'UserError:InvalidToken'));
  }


};
