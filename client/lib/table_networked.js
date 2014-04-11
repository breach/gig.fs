/**
 * GiG.fs: table_networked.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-11 spolu  `in_memory` mode
 * - 2014-04-11 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var async = require('async');
var request = require('request');
var common = require('../../lib/common.js');

// ## table_networked
//
// GiG.fs Client In Memory Table Object
//
// The table object is initiated by retrieving the table data for this user over
// the network. 
//
// TODO(spolu):
// - The table information must be kept up to date periodically.
// - Emitting events to notify of any change on the table structure
//
// ```
// @spec    { registry, table_url, session_token }
// @extends table
// ```
var table_networked = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.table_url = spec.table_url;
  my.session_token = spec.session_token;

  my.json = null;

  //
  // _public_
  // 
  var init;      /* init(cb_()); */

  //
  // #### _that_
  //
  var that = require('./table.js').table(spec, my);

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
      _super.init,
      function(cb_) {
        var url_p = require('url').parse(my.table_url);
        if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
            url_p.query || url_p.search || 
            !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
          return cb_(common.err('Invalid `table_url`: ' + my.table_url,
                                'TableError:InvalidUrl'));
        }
        var table_url = url_p.href + 'table?session_token='  + my.session_token;
        request.get({
          url: table_url,
          json: true
        }, function(err, res, json) {
          if(err) {
            return cb_(err);
          }
          if(json && !json.error) {
            my.json = json;
            return cb_();
          }
          else if(json && json.error) {
            return cb_(common.err(json.error.message,
                                  json.error.name));
          }
          else {
            return cb_(common.err('Server Error: ' + table_url,
                                  'TableError:ServerError'));
          }
        });
      },
      function(cb_) {
        async.each(Object.keys(my.json), function(c, cb_) {
          my.channels[c] = require('./channel_networked.js').channel_networked({
            name: c,
            registry: my.registry,
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

exports.table_networked = table_networked;
