/**
 * TeaBag: storage.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-20 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var async = require('async');
var mkdirp = require('mkdirp');
var common = require('./common.js');

// ## storage
//
// Access checker and helper
//
// ```
// @spec {}
// ```
var storage = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.data_path = process.env['TEABAG_DATA'] || 
    require('path').join(process.cwd(), 'TEABAG_DATA');
  
  //
  // _public_
  // 
  var get;  /* get(user_id, path, cb_); */
  var put;  /* put(user_id, path, json, cb_); */

  //
  // #### _private_
  //
  var check_path;

  //
  // #### _that_
  //
  var that = {};  

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/
  // ### check_path
  //
  // Checks and returns the sanitized path. 
  // ```
  // @path {string} path
  // @cb_  {function(err, normalized_path)}
  // ```
  check_path = function(path, cb_) {
    if(!path || path.length === 0) {
      return cb_(common.err('Invalid `path`: ' + path,
                            'StorageError:InvalidPath'));
    }
    /* The path behing relative to the user data storage path, we prepend */
    /* it with '/' as this forces relativeness post normalization.        */
    if(path[0] !== '/')
      path = '/' + path;
    path = require('path').normalize(path);
    if(path.length < 2) {
      return cb_(common.err('Invalid `path`: ' + path,
                            'StorageError:InvalidPath'));
    }
    return cb_(null, path);
  };

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### get
  //
  // Retrieves the parsed JSON data for the provided user and path
  // ```
  // @user_id {number} user_id
  // @path    {string} path
  // @cb_     {function(err, json)}
  // ```
  get = function(user_id, path, cb_) {
    if(typeof user_id !== 'number') {
      return cb_(common.err('Invalid `user_id`: ' + user_id,
                            'StorageError:InvalidUserId'));
    }
    var json = null;
    async.series([
      function(cb_) {
        check_path(path, function(err, p) {
          path = p;
          return cb_(err);
        });
      },
      function(cb_) {
        fs.readFile(require('path').join(my.data_path, 
                                         common.salt(user_id).toString(), 
                                         user_id.toString(), path), {
          encoding: 'utf8',
          flag: 'r'
        }, function(err, data) {
          if(err) {
            return cb_(err);
          }
          try {
            json = JSON.parse(data);
            return cb_();
          }
          catch(err) {
            return cb_(err);
          }
        });
      }
    ], function(err) {
      return cb_(err, json);
    });
  };

  // ### put
  //
  // Writes or overwrites the JSON data at the provided path for the provided
  // user. Paths are normalized to ensure they are under the user's data path.
  // ```
  // @user_id {number} user_id
  // @path    {string} path
  // @cb_     {function(err)}
  // ```
  put = function(user_id, path, json, cb_) {
    if(typeof user_id !== 'number') {
      return cb_(common.err('Invalid `user_id`: ' + user_id,
                            'StorageError:InvalidUserId'));
    }
    var base = require('path').join(my.data_path, 
                                    common.salt(user_id).toString(), 
                                    user_id.toString());
    async.series([
      function(cb_) {
        check_path(path, function(err, p) {
          path = p;
          return cb_(err);
        });
      },
      function(cb_) {
        mkdirp(require('path').dirname(require('path').join(base, path)), cb_);
      },
      function(cb_) {
        try {
          var data = JSON.stringify(json);
        }
        catch(err) {
          return cb_(err);
        }
        fs.writeFile(require('path').join(base, path), data, {
          encoding: 'utf8',
          flag: 'w'
        }, cb_);
      }
    ], function(err) {
      return cb_(err, json);
    });
  };

  common.method(that, 'get', get, _super);
  common.method(that, 'put', put, _super);

  return that;
};

exports.storage = storage;

