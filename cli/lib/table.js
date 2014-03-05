/**
 * TeaBag: table.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-03-01 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var http = require('http');
var https = require('https');
var async = require('async');
var common = require('../../lib/common.js');

// ## table
//
// Teabag Client Table Object
//
// The table object is initiated by retrieving the table data for this user over
// the network. 
//
// TODO(spolu):
// - The table information must be kept up to date periodically.
// - Emitting events to notify of any change on the table structure
//
// ```
// @spec { server, token }
// ```
var table = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.server = spec.server;
  my.token = spec.token;

  my.json = null;
  my.channels = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */

  //
  // #### _private_
  //
  
  //
  // #### _that_
  //
  var that = {};  

  /****************************************************************************/
  /* PRIVATE HELPERS */
  /****************************************************************************/

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### init
  //
  // Inits the table object by contacting the server with the provided token
  // and copying locally the table information, creating associated channel
  // and store objects.
  // ```
  // @cb_ {function(err)}
  // ```
  init = function(cb_) {
    async.series([
      function(cb_) {
        var url_p = require('url').parse(spec.server);
        if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
            url_p.query || url_p.search || 
            !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
          return cb_(common.err('Invalid Server URL: ' + spec.server,
                                'TableError:InvalidUrl'));
        }
        var table_url = url_p.href + 'table?token='  + spec.token;

        (url_p.protocol === 'https:' ? https : http).get(table_url, function(res) {
          res.setEncoding('utf8');
          var body = '';
          res.on('data', function(chunk) {
            body += chunk;
          });
          res.on('end', function() {
            try {
              my.json = JSON.parse(body);
              if(my.json && !my.json.error) {
                return cb_();
              }
              else if(my.json && my.json.error) {
                return cb_(common.err(json.error.message,
                                      json.error.name));
              }
              else {
                return cb_(common.err('Server Error: ' + table_url,
                                      'TableError:ServerError'));
              }
            }
            catch(err) {
              return cb_(err);
            }
          });
        }).on('error', cb_);
      },
      function(cb_) {
        async.each(Object.keys(my.json), function(c, cb_) {
          my.channels[c] = require('./channel.js').channel({
            name: c,
            json: my.json[c]
          });
          my.channels[c].init(cb_);
        }, cb_);
      }
    ], cb_);
  };

  common.method(that, 'init', init, _super);

  return that;
};

exports.table = table;

