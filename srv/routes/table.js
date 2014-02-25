/*
 * TeaBag: routes/table.js
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

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### POST /user/:user_id/table/:channel/store
//          { url }
//
exports.post_channel_store = function(req, res, next) {
  if(!req.body ||
     typeof req.body.url !== 'string' ||
     typeof req.body.secret !== 'string') {
    return res.error(common.err('Invalid POST body: ' + JSON.stringify(req.body),
                                'TableError:InvalidPostBody'));
  }

  var channel = req.param('channel');
  if(typeof channel !== 'string' || channel.length === 0) {
    return res.error(common.err('Invalid `channel`: ' + req.param('channel'),
                                'TableError:InvalidChannel'));
  }

  var user = null;
  var table = null;
  var store = null;

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
      var url_p = require('url').parse(req.body.url);
      if(url_p.query || url_p.search || 
         !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
        return res.error(common.err('Invalid URL: ' + req.body.url,
                                    'TableError:InvalidUrl'));
      }
      var url = url_p.href;
      store = {
        id: common.hash([url]),
        url: url
        secret: req.body.secret
      };
      /* TODO(spolu): Contact the store to confirm addition */
      return cb_();
    },
    function(cb_) {
      storage.get(user_id, 'table.json', function(err, table) {
        if(err) {
          return cb_(err);
        }
        table[store.id] = store;
        return storage.put(user_id, 'table.json', table, cb_);
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(store);
  });
};

//
// ### DEL /user/:user_id/table/:channel/store/:store_id
//
exports.del_channel_store = function(req, res, next) {
  var channel = req.param('channel');
  if(typeof channel !== 'string' || channel.length === 0) {
    return res.error(common.err('Invalid `channel`: ' + req.param('channel'),
                                'TableError:InvalidChannel'));
  }

  var store_id = req.param('store_id');
  if(!store_id) {
    return res.error(common.err('Invalid `store_id`: ' + req.param('store_id'),
                                'TableError:InvalidStoreId'));
  }

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
      storage.get(user_id, 'table.json', function(err, table) {
        if(err) {
          return cb_(err);
        }
        delete table[store_id];
        return storage.put(user_id, 'table.json', table, cb_);
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
// ### GET /user/:user_id/table/:channel/store/:store_id
//
exports.get_channel_store = function(req, res, next) {
  return res.ok();
};

//
// ### DEL /user/:user_id/table/:channel
//
exports.del_channel = function(req, res, next) {
  return res.ok();
};

//
// ### GET /user/:user_id/table/:channel
//
exports.get_channel = function(req, res, next) {
  return res.ok();
};

//
// ### GET /user/:user_id/table
//
exports.get_table = function(req, res, next) {
  return res.ok();
};

