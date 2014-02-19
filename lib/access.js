/*
 * TeaBag: access.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-19 spolu   Creation
 */
var crypto = require('crypto');
var url = require('url');
var common = require('./common.js');

// 
// ## access
//
// Access checker and helper
//
// ```
// @spec {}
// ```
//
var access = function(spec, my) {
  my = my || {};
  var _super = {};        

  //
  // _public_
  // 
  var verify;       /* verify(req, res, next); */
  var error;        /* error(err, req, res, next); */

  //
  // #### _private_
  //
  
  //
  // #### _that_
  //
  var that = {};  
  
  // ### verify
  //
  // Asynchronous verifier for user access
  // ```
  // @req  {http request} http request
  // @res  {http response} http response
  // @next {function(err)}
  // ```
  verify = function(req, res, next) {
    var url_p = url.parse(req.url);

    common.log.out('EVAL: ' + req.url + ' (' + req.method + ')');

    /* JSON helpers */
    res.error = function(err) {
      return next(err);
    };

    res.data = function(data) {
      if(req.param('callback'))
        return res.jsonp(data);
      else
        return res.json(data);
    };

    res.ok = function() {
      var json = {
        ok: true,
      };
      return res.json(json);
    };

    /* Public paths. */
    
    if(/^\/user\/[0-9]+\/token/.test(url_p.pathname)) return next();
    if(/^\/user\/[0-9]+\/table/.test(url_p.pathname)) return next();

    common.log.out('REFUSED');
    return res.send(404, 'Not Found');
  };

  // ### error
  //
  // Error handler
  // ```
  // @err {object} the error to handle
  // @req  {http request} http request
  // @res  {http response} http response
  // @next {function(err)}
  // ```
  error = function(err, req, res, next) {
    common.log.error(err);
    return res.send(500, { 
      error: {
        name: err.name,
        message: err.message 
      }
    });
  };


  common.method(that, 'verify', verify, _super);
  common.method(that, 'error', error, _super);

  return that;
};

exports.access = access;
