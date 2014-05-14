/**
 * GiG.fs: storage.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-13 spolu  Storage `prefix` to make it more versatile
 * - 2014-02-20 spolu  Creation
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
// @spec { data_path }
// ```
var storage = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        


  my.data_path = process.env['GIGFS_DATA'] || 
    require('path').join(process.cwd(), 'GIGFS_DATA');
  if(spec.data_path) {
    my.data_path = require('path').normalize(spec.data_path);
  }
  my.locks = {};
  
  //
  // _public_
  // 
  var get;    /* get(path, cb_); */
  var put;    /* put(path, json, cb_); */
  var lock;   /* lock(path, cb_(unlock_)); */

  var prefix; /* prefix(user_id); */

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
  // ### prefix
  //
  // Generates a prefix path for the given user_id using salts. This is an
  // utility method often used in the context of storage.
  // ```
  // @user_id {number} the user_id
  // ```
  prefix = function(user_id) {
    return (common.salt(user_id).toString() + '/' + user_id + '/');
  };

  // ### lock
  //
  // Waits for any currently running critical section to finish
  // ```
  // @path    {string} path
  // @cb_     {function(rel_)}
  // ```
  lock = function(path, cb_) {
    var h = common.hash([ path ]);
    if(my.locks[h]) {
      my.locks[h].push(cb_);
    }
    else {
      my.locks[h] = [null, cb_];

      (function release() {
        my.locks[h].shift();
        if(my.locks[h].length === 0) {
          delete my.locks[h];
        }
        else {
          return my.locks[h][0](release);
        }
      })();
    }
  };


  // ### get
  //
  // Retrieves the parsed JSON data for the provided user and path
  // ```
  // @path    {string} path
  // @cb_     {function(err, json)}
  // ```
  get = function(path, cb_) {
    var json = null;
    async.series([
      function(cb_) {
        check_path(path, function(err, p) {
          path = p;
          return cb_(err);
        });
      },
      function(cb_) {
        fs.readFile(require('path').join(my.data_path, path), {
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
  // @path    {string} path
  // @cb_     {function(err)}
  // ```
  put = function(path, json, cb_) {
    async.series([
      function(cb_) {
        check_path(path, function(err, p) {
          path = p;
          return cb_(err);
        });
      },
      function(cb_) {
        var p = require('path').dirname(require('path').join(my.data_path, path));
        mkdirp(p, cb_);
      },
      function(cb_) {
        try {
          var data = JSON.stringify(json);
        }
        catch(err) {
          return cb_(err);
        }
        fs.writeFile(require('path').join(my.data_path, path), data, {
          encoding: 'utf8',
          flag: 'w'
        }, cb_);
      }
    ], function(err) {
      return cb_(err, json);
    });
  };

  common.method(that, 'prefix', prefix, _super);

  common.method(that, 'lock', lock, _super);
  common.method(that, 'get', get, _super);
  common.method(that, 'put', put, _super);

  return that;
};

exports.storage = storage;

