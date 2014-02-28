/*
 * TeaBag: routes/utility.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-28 spolu  Updated token check
 * - 2014-02-28 spolu  Creation
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
// ### user_master_check
//
// Utility method to check user credentials and existence based on its master
// ```
// @user_id {number} the user's id
// @master  {string} the user master token
// @cb_     {function(err), user}
// ```
exports.user_master_check = function(user_id, master, cb_) {
  var user = null;
  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'UtilityError:UserNotFound'));
        }
        else if(err) {
          return cb_(err);
        }
        else {
          if(master !== json.master) {
            return cb_(common.err('User Not Found: ' + user_id,
                                  'UtilityError:UserNotFound'));
          }
          user = json;
          return cb_();
        }
      });
    }
  ], function(err) {
    return cb_(err, user);
  });
};

// ### check_token_string
//
// Checks the token string integrity. Returns boolean.
// ```
// @user { master, ... } the user object
// @token {string} the token **string**
// ```
exports.check_token_string = function(user, token) {
  if(typeof token !== 'string' || 
     token.split('_').length !== 3) {
    return false;
  }
  var split = token.split('_');

  if(split[2] !== common.hash([user.master,
                               common.KEY,
                               split[0],
                               split[1]])) {
    return false;
  }
  return true;
};

// ### check_token_object
//
// Checks whether a token object is still valid or not. Returns boolean.
// ```
// @user { master, ... } the user object
// @t    { token, expiry, description } the token **object**
// ```
exports.check_token_object = function(user, t) {
  if(!exports.check_token_string(user, t.token)) {
    return false;
  }
  var split = t.token.split('_');
  if(!t.expiry) {
    return false;
  }
  if(t.expiry !== parseInt(split[1], 10)) {
    return false;
  }
  if(t.expiry < Date.now()) {
    return false;
  }
  return true;
};

// ### user_token_check
//
// Utility method to check user credentials and existence based on a token
// ```
// @user_id {number} the user's id
// @okten   {string} a user token **string**
// @cb_     {function(err), user}
// ```
exports.user_token_check = function(user_id, token, cb_) {
  var user = null;
  var found = null; 

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'UtilityError:UserNotFound'));
        }
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      storage.get(user_id, 'tokens.json', function(err, tokens) {
        if(err) {
          return cb_(err);
        }
        var len = tokens.length;
        /* Filters out old tokens. Done whenever the `tokens.json` file is */
        /* fetched from disk.                                              */
        tokens = tokens.filter(function(t) {
          return exports.check_token_object(user, t);
        });

        tokens.forEach(function(t) {
          if(t.token === token) {
            found = t;
          }
        });

        /* If we filtered a token, let's write back the tokens array to disk */
        if(tokens.length < len) {
          return storage.put(user_id, 'tokens.json', tokens, cb_);
        }
        else {
          return cb_();
        }
      });
    }
  ], function(err) {
    if(err) {
      return cb_(err);
    }
    else if(found) {
      return cb_();
    }
    else {
      return cb_(common.err('Invalid `token`: ' + token,
                            'UtilityError:InvalidToken'));
    }
  });
};

