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
// ### user_retrieve
//
// Utility method to retrieve a user data, checking that the user exists.
// ```
// @user_id {number} the user's id
// @master  {string} the user master token
// @cb_     {function(err), user}
// ```
exports.user_retrieve = function(user_id, master, cb_) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return cb_(common.err('Invalid `user_id`: ' + req.param('user_id'),
                          'TableError:InvalidUserId'));
  }

  storage.get(user_id, 'user.json', function(err, json) {
    if(err && err.code === 'ENOENT') {
      return cb_(common.err('User Not Found: ' + user_id,
                            'TableError:UserNotFound'));
    }
    else if(err) {
      return cb_(err);
    }
    else {
      if(master !== json.master) {
        return cb_(common.err('User Not Found: ' + user_id,
                              'TableError:UserNotFound'));
      }
      return cb_(null, json);
    }
  });
};

// ### check_token
//
// Checks whether a token object is still valid or not. Returns boolean.
// ```
// @token { token, expire, description } the token object
// ```
exports.check_token = function(token) {
  if(!token.token || !token.expire) {
    return false;
  }
  if(token.expire !== parseInt(token.token.split('_'), 10)) {
    return false;
  }
  if(token.expire < Date.now()) {
    return false;
  }
  return true;
};

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### GET /user/:user_id/token
//
exports.get_token = function(req, res, next) {
  var expire = parseInt(req.param('expire', 10));
  if(!expire || 
     expire < Date.now() ||
     expire > (Date.now() + 1000 * 60 * 60 * 24 * 365)) {
    return res.error(common.err('Invalid `expire`: ' + req.param('expire'),
                                'TokenError:InvalidExpire'));
  }
  var description = req.param('description') || '';

  var user = null;
  var token = null;

  async.series([
    function(cb_) {
      return exports.user_retrieve(req.param('user_id'), 
                                   req.param('master'), 
                                   function(err, json) {
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      storage.get(user.user_id, 'tokens.json', function(err, tokens) {
        if(err) {
          return cb_(err);
        }
        token = {
          token: expire + '_' + common.hash([user.master,
                                            Date.now(),
                                            expire]),
          expire: expire,
          description: description
        }
        if(!exports.check_token(token)) {
          return cb_(common.err('Invalid `token`: ' + token.token,
                                'TokenError:InvalidToken'));
        }
        /* Filters out old tokens. Done whenever the `tokens.json` file is */
        /* fetched from disk.                                              */
        tokens = tokens.filter(exports.check_token);
        tokens.push(token);

        return storage.put(user.user_id, 'tokens.json', tokens, cb_);
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(token);
  });
};

//
// ### DEL /user/:user_id/token/:token
//
exports.del_token = function(req, res, next) {
  var user = null;

  async.series([
    function(cb_) {
      return exports.user_retrieve(req.param('user_id'), 
                                   req.param('master'), 
                                   function(err, json) {
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      storage.get(user.user_id, 'tokens.json', function(err, tokens) {
        if(err) {
          return cb_(err);
        }
        /* Filters out old tokens. Done whenever the `tokens.json` file is */
        /* fetched from disk.                                              */
        tokens = tokens.filter(exports.check_token);
        tokens = tokens.filter(function(t) {
          if(t.token === req.param('token'))
            return false;
          return true;
        });

        return storage.put(user.user_id, 'tokens.json', tokens, cb_);
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok();
  });
};

//
// ### GET /user/:user_id/token/:token/check
//
exports.get_token_check = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  var token = null;

  async.series([
    function(cb_) {
      storage.get(user_id, 'tokens.json', function(err, tokens) {
        if(err) {
          return cb_(err);
        }
        /* Filters out old tokens. Done whenever the `tokens.json` file is */
        /* fetched from disk.                                              */
        tokens = tokens.filter(exports.check_token);

        tokens.forEach(function(t) {
          if(t.token === req.param('token')) {
            token = t;
          }
        });
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    if(token) {
      return res.ok({});
    }
    return res.error(common.err('Invalid `token`: ' + req.param('token'),
                                'TokenError:InvalidToken'));
  });
};
