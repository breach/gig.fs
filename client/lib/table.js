/**
 * GiG.fs: table.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-05-13 spolu  `local_table/remote_table` API
 * - 2014-04-11 spolu  `in_memory` mode
 * - 2014-04-04 spolu   Add `kill` method
 * - 2014-03-20 spolu   Use `request` package
 * - 2014-03-01 spolu   Creation
 */
"use strict";

var util = require('util');
var events = require('events');
var fs = require('fs');
var async = require('async');
var request = require('request');
var common = require('../../lib/common.js');

// ## table
//
// GiG.fs Client Table Object
//
// The table object exposing the table interface. The object is also in charge 
// of merging channels across the `local` and `remote` table.
//
// TODO(spolu):
// - Emitting events to notify of any change on the table structure
//
// ```
// @spec { local, remote, registry }
// ```
var table = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.remote = spec.remote || null;
  my.local = spec.local || null;
  my.registry = spec.registry;

  my.json = {};
  my.channels = {};

  //
  // _public_
  // 
  var init;      /* init(cb_()); */
  var kill;      /* kill(cb_()); */

  var channel;   /* channel(channel); */
  var channels;  /* channels(); */

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
  // ### channel
  //
  // Returns the channel object for the requested channel
  // ```
  // @channel {string} the channel name
  // ```
  channel = function(channel) {
    return (my.channels[channel] || null);
  };

  // ### channels
  //
  // Returns the list of available channels
  channels = function() {
    return Object.keys(my.channels);
  };

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
        /* We start by merging the two tables, the remote one and the local */
        /* one provided as an argument to the library.                      */
        async.parallel([
          function(cb_) {
            if(spec.remote) {
              var url_p = require('url').parse(my.remote.table_url);
              if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
                 url_p.query || url_p.search || 
                 !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
                return cb_(common.err('Invalid `table_url`: ' + my.table_url,
                                      'TableError:InvalidUrl'));
              }
              var table_url = url_p.href + 'table?session_token=' + 
                              my.remote.session_token;
              request.get({
                url: table_url,
                json: true
              }, function(err, res, json) {
                if(err) {
                  return cb_(err);
                }
                if(json && !json.error) {
                  Object.keys(json).forEach(function(c) {
                    my.json[c] = my.json[c] || {};
                    Object.keys(json[c]).forEach(function(s) {
                      my.json[c][s] = json[c][s];
                      my.json[c][s].type = 'remote';
                    });
                  });
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
            }
            else {
              return cb_();
            }
          },
          function(cb_) {
            if(spec.local) {
              Object.keys(spec.local).forEach(function(c) {
                my.json[c] = my.json[c] || {};
                spec.local[c].forEach(function(s) {
                  var store_id = common.hash([
                    c, 
                    (s.local_path || ''), 
                    s.in_memory.toString()
                  ]);
                  my.json[c][store_id] = s;
                  my.json[c][store_id].type = 'local';
                  my.json[c][store_id].store_id = store_id;
                });
              });
            }
            return cb_();
          }
        ], cb_);
      },
      function(cb_) {
        console.log(my.json);
        async.each(Object.keys(my.json), function(c, cb_) {
          my.channels[c] = require('./channel.js').channel({
            name: c,
            registry: my.registry,
            json: my.json[c]
          });
          my.channels[c].init(cb_);
        }, cb_);
      },
    ], cb_);
  };

  // ### kill
  //
  // Cleans-up and terminates this table (and all long-poll connections)
  //
  // ```
  // @cb_ {function(err)}
  // ```
  kill = function(cb_) {
    async.each(Object.keys(my.channels), function(c, cb_) {
      my.channels[c].kill(cb_);
    }, cb_);
  };

  common.method(that, 'channel', channel, _super);
  common.method(that, 'channels', channels, _super);

  common.method(that, 'init', init, _super);
  common.method(that, 'kill', kill, _super);

  return that;
};

exports.table = table;

