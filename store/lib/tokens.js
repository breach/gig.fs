/*
 * TeaBag: tokens.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-03-19 spolu  Creation
 */
"use strict";

var util = require('util');
var async = require('async');
var request = require('request');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

// ## tokens
//
// Token local cache. It caches tokens for a given table_url and user_id and
// checks their continued validity periodically.
//
// ```
// @spec {}
// ```
var tokens = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.cache = {};
  my.REFRESH_INTERVAL = 1000 * 60;

  //
  // _public_
  // 
  var check;    /* check(table_url, user_id, token, cb_); */

  //
  // _private_
  // 
  var refresh;  /* refresh(table_url, user_id, token, cb_); */

  //
  // #### _that_
  //
  var that = {};  

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### refresh
  //
  // Refreshes a token validity
  // ```
  // @user_id   {number} the user id
  // @token     {string} the token to check
  // ```
  refresh = function(user_id, token) {
    if(!my.cache[user_id][token] ||
       !my.cache[user_id][token].table_url) {
      return;
    }
    request.get({
      url: my.cache[user_id][token].table_url + 'token/' + token + '/check',
      json: true
    }, function(err, res, json) {
      if(err || res.statusCode !== 200) {
        /* An unexpected error occured, let's abort. */
        return;
      }
      if(json && json.ok) {
        my.cache[user_id][token].valid = true;
        return;
      }
      else {
        my.cache[user_id][token].valid = false;
        clearInterval(my.cache[user_id][token].itv);
        delete my.cache[user_id][token].itv;
      }
    });
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### check
  //
  // Checks the vailidity of a token for the given user_id and caches the
  // token locally. The tokens are checked again every REFRESH_INTERVAL to
  // detect any access revocation.
  //
  // If a check is pending on the network, the callback is queued for later
  // reply when the answer is retrieved from the network.
  // ```
  // @user_id   {number} the user id
  // @token     {string} the token to check
  // @cb_       {function(err, valid)}
  // ```
  check = function(user_id, token, cb_) {
    if(typeof token !== 'string' ||
       token.split('_').length !== 3) {
      return cb_(common.err('Invalid `token`: ' + token,
                            'TokensError:InvalidToken'));
    }
    if(my.cache[user_id] &&
       typeof my.cache[user_id][token] !== 'undefined') {
      /* If we're here, either we have a request pending on this token... */
      if(typeof my.cache[user_id][token].valid === 'undefined') {
        my.cache[user_id][token].callbacks.push(cb_);
        return;
      }
      /* Or the validity has already been cached. */
      else {
        return cb_(null, my.cache[user_id][token].valid);
      }
    }

    /* We cache an empty entry pending resolution with the table. `valid` is */
    /* voluntarily kept undefined.                                           */
    my.cache[user_id] = my.cache[user_id] || {};
    my.cache[user_id][token] = {
      callbacks: [cb_]
    };

    async.series([
      function(cb_) {
        /* We retrieve the `table_url` for the requested `user_id`. */
        storage.get(user_id, 'user.json', function(err, json) {
          if(err) {
            return cb_(err);
          }
          if(!json || !json.table.url) {
            return cb_(common.err('Unknown Table URL',
                                  'TokensError:UnknownTableUrl'));
          }
          my.cache[user_id][token].table_url = json.table.url;
          return cb_();
        });
      },
      function(cb_) {
        request.get({
          url: my.cache[user_id][token].table_url + 'token/' + token + '/check',
          json: true
        }, function(err, res, json) {
          if(err) {
            /* An unexpected error occured, we'll refuse the token but not */
            /* cache its refusal.                                          */
            return cb_(err);
          }
          if(json && json.ok) {
            my.cache[user_id][token].valid = true;
            /* As the token is valid we trigger the refresh interval. */
            my.cache[user_id][token].itv = setInterval(function() {
              refresh(user_id, token);
            }, my.REFRESH_INTERVAL);
          }
          else {
            my.cache[user_id][token].valid = false;
          }
          return cb_();
        });
      }
    ], function(err) {
      if(err) {
        my.cache[user_id][token].callbacks.forEach(function(cb_) {
          return cb_(err);
        });
        delete my.cache[user_id][token];
      }
      else {
        my.cache[user_id][token].callbacks.forEach(function(cb_) {
          return cb_(null, my.cache[user_id][token].valid);
        });
        delete my.cache[user_id][token].callbacks;
      }
    });
  };

  common.method(that, 'check', check, _super);

  return that;
};

exports.tokens = tokens;

