/*
 * GiG.fs: tokens_cache.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-05-13 spolu  Storage `prefix` to make it more versatile
 * - 2014-04-07 spolu  Introduce `store_token`
 * - 2014-03-19 spolu  Creation
 */
"use strict";

var util = require('util');
var async = require('async');
var request = require('request');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

// ## tokens_cache
//
// `store_token` local cache. It caches tokens for a given table_url and user_id 
// and checks their continued validity until they timeout or they are revoked.
//
// ```
// @spec {}
// ```
var tokens_cache = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.cache = {};

  //
  // _public_
  // 
  var check;        /* check(user_id, store_token, cb_); */
  var revoke        /* revoke(store_token); */

  //
  // _private_
  // 
  var expand;       /* expand(store_token); */
  var fatal;        /* fatal(store_token, cb_); */
  var table_check;  /* table_check(store_token, cb_); */

  //
  // #### _that_
  //
  var that = {};  

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### expand
  //  
  // Expands a store_token in an object to use the information contained in it.
  // Returns `null` if the token is not valid
  // ```
  // @store_token {string} the token to expand
  // ```
  expand = function(store_token) {
    if(typeof store_token !== 'string' || 
       store_token.split('_').length !== 6) {
      return null;
    }
    var split = store_token.split('_');

    var expand = {};

    if(split[0] !== 'store') {
      return null;
    }

    expand.user_id = parseInt(split[1], 10);
    expand.date_created = parseInt(split[2], 10);
    expand.timeout = parseInt(split[3], 10);
    expand.store_id = split[4];
    expand.check = split[5];

    if(!expand.user_id ||
       !expand.date_created ||
       !expand.timeout ||
       expand.timeout < 1000 ||
       expand.timeout > (1000 * 60 * 60 * 24 * 31)) {
      return null;
    }
    return expand;
  };

  // ### fatal
  //
  // Returns a default error (not to leak any info)
  // ```
  // @cb_         {function(err)}
  // ```
  fatal = function(store_token, cb_) {
    return cb_(common.err('Invalid `store_token`: ' + store_token,
                          'TokensError:InvalidStoreToken'));
  };
  
  // ### table_check
  //
  // Checks the validity of a token with the table
  // ```
  // @store_token {string} the token to check
  // @cb_         {function(err)}
  // ```
  table_check = function(store_token, cb_) {
    var exp = expand(store_token);
    if(!exp) {
      return fatal(store_token, cb_);
    }

    var table_url = null;

    async.series([
      function(cb_) {
        /* We retrieve the `table_url` for the requested `user_id`. */
        storage.get(storage.prefix(exp.user_id) + 'user.json', 
                    function(err, json) {
          if(err) {
            return cb_(err);
          }
          if(!json || !json.table.url) {
            return fatal(store_token, cb_);
          }
          table_url = json.table.url;
          return cb_();
        });
      },
      function(cb_) {
        request.get({
          url: table_url + 'table/check/' + store_token,
          json: true
        }, function(err, res, json) {
          if(err || res.statusCode !== 200) {
            return fatal(store_token, cb_);
          }
          if(json && json.ok) {
            return cb_();
          }
          else {
            return fatal(store_token, cb_);
          }
        });
      }
    ], cb_);
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### check
  //
  // Checks the vailidity of a store_token and caches the result locally until
  // the token timeout is expired.
  //
  // If a check is pending on the network, the callback is queued for later
  // reply when the answer is retrieved from the network.
  // ```
  // @user_id     {number} the user_id for that token
  // @store_token {string} the token to check
  // @cb_         {function(err)}
  // ```
  check = function(user_id, store_token, cb_) {
    var exp = expand(store_token);
    if(!exp) {
      return fatal(store_token, cb_);
    }
    if(exp.user_id !== user_id) {
      return fatal(store_token, cb_);
    }

    if(my.cache[store_token]) {
      if(typeof my.cache[store_token].callbacks !== 'undefined') {
        my.cache[store_token].callbacks.push(cb_);
        return;
      }
      else if(my.cache[store_token].last_check + exp.timeout >= Date.now()) {
        my.cache[store_token].last_check = Date.now();
        return cb_();
      }
      else {
        delete my.cache[store_token];
        return fatal(store_token, cb_);
      }
    }

    /* We cache an empty entry pending resolution with the table. */
    my.cache[store_token] = {
      callbacks: [cb_],
      last_check: Date.now()
    };

    table_check(store_token, function(err) {
      if(err) {
        my.cache[store_token].callbacks.forEach(function(cb_) {
          return cb_(err);
        });
        delete my.cache[store_token];
      }
      else {
        my.cache[store_token].callbacks.forEach(function(cb_) {
          return cb_();
        });
        delete my.cache[store_token].callbacks;
      }
    });
  };

  // ### revoke
  //
  // Revokes a token with itself
  //
  // If a check is pending on the network, the callbacks are called with the
  // standard error.
  // ```
  // @store_token {string} the token to check
  // ```
  revoke = function(store_token) {
    if(my.cache[store_token]) {
      if(typeof my.cache[store_token].callbacks !== 'undefined') {
        var callbacks = my.cache[store_token].callbacks;
        delete my.cache[store_token];
        callbacks.forEach(function(cb_) {
          return fatal(store_token, cb_);
        });
      }
    }
    delete my.cache[store_token];
  };

  common.method(that, 'check', check, _super);
  common.method(that, 'revoke', revoke, _super);

  return that;
};

exports.tokens_cache = tokens_cache;

