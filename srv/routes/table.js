/*
 * TeaBag: routes/table.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-28 spolu  Allow table access with token
 * - 2014-02-28 spolu  Move utility methods to `utility.js`
 * - 2014-02-19 spolu  Creation
 */
"use strict";

var querystring = require('querystring');
var util = require('util');
var async = require('async');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

var http = require('http');
var https = require('https');

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### POST /user/:user_id/table/:channel/store
//          { url }
//          master only
//
exports.post_channel_store = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  if(!req.body ||
     typeof req.body.url !== 'string' ||
     typeof req.body.code !== 'string') {
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
      return require('./utility.js').user_master_check(user_id,
                                                       req.param('master'), 
                                                       function(err, json) {
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      var url_p = require('url').parse(req.body.url);
      if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
         url_p.query || url_p.search || 
         !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
        return cb_(common.err('Invalid URL: ' + req.body.url,
                              'TableError:InvalidUrl'));
      }
      var url = url_p.href;
      store = {
        id: common.hash([url]),
        url: url,
        code: req.body.code,
        secure: url_p.protocol === 'https:' ? true : false,
        created_time: Date.now()
      };
      return cb_();
    },
    function(cb_) {
      var confirm_url = store.url + 'confirm?code=' + store.code;
      (store.secure ? https : http).get(confirm_url, function(res) {
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function(chunk) {
          body += chunk;
        });
        res.on('end', function() {
          try {
            var json = JSON.parse(body);
            if(json.ok) {
              return cb_();
            }
            else if(json.error) {
              return cb_(common.err(json.error.message,
                                    json.error.name));
            }
            else {
              return cb_(common.err('Store Refusal: ' + store.url,
                                    'TableError:StoreRefusal'));
            }
          }
          catch(err) {
            return cb_(err);
          }
        });
      }).on('error', cb_);
    },
    function(cb_) {
      storage.get(user_id, 'table.json', function(err, table) {
        if(err) {
          return cb_(err);
        }
        table[channel] = table[channel] || {};
        table[channel][store.id] = store;
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
//         master only
//
exports.del_channel_store = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

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

  var user = null;

  async.series([
    function(cb_) {
      return require('./utility.js').user_master_check(user_id, 
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
        if(table[channel]) {
          delete table[channel][store_id];
        }
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
// ### DEL /user/:user_id/table/:channel
//         master only
//
exports.del_channel = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  var channel = req.param('channel');
  if(typeof channel !== 'string' || channel.length === 0) {
    return res.error(common.err('Invalid `channel`: ' + req.param('channel'),
                                'TableError:InvalidChannel'));
  }

  var user = null;

  async.series([
    function(cb_) {
      return require('./utility.js').user_master_check(user_id, 
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
        delete table[channel];
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
// ### GET /user/:user_id/table
//
exports.get_table = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  if(typeof req.param('master') !== 'string' &&
     typeof req.param('token') !== 'string') {
    return res.error(common.err('Missing Credentials',
                                'TableError:MissingCredentials'));
  }

  var user = null;
  var table = null;

  async.series([
    function(cb_) {
      if(req.param('master')) {
        return require('./utility.js').user_master_check(user_id, 
                                                         req.param('master'), 
                                                         function(err, json) {
          user = json;
          return cb_(err);
        });
      }
      else {
        return require('./utility.js').user_token_check(user_id,
                                                        req.param('token'),
                                                        function(err, json) {
          user = json;
          return cb_(err);
        });
      }
    },
    function(cb_) {
      storage.get(user_id, 'table.json', function(err, t) {
        if(err) {
          return cb_(err);
        }
        table = t;
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(table);
  });
};

//
// ### GET /user/:user_id/table/:channel
//
exports.get_channel = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  if(typeof req.param('master') !== 'string' &&
     typeof req.param('token') !== 'string') {
    return res.error(common.err('Missing Credentials',
                                'TableError:MissingCredentials'));
  }
  
  var channel = req.param('channel');
  if(typeof channel !== 'string' || channel.length === 0) {
    return res.error(common.err('Invalid `channel`: ' + req.param('channel'),
                                'TableError:InvalidChannel'));
  }

  var user = null;
  var channel = null;

  async.series([
    function(cb_) {
      if(req.param('master')) {
        return require('./utility.js').user_master_check(user_id, 
                                                         req.param('master'), 
                                                         function(err, json) {
          user = json;
          return cb_(err);
        });
      }
      else {
        return require('./utility.js').user_token_check(user_id,
                                                        req.param('token'),
                                                        function(err, json) {
          user = json;
          return cb_(err);
        });
      }
    },
    function(cb_) {
      storage.get(user_id, 'table.json', function(err, table) {
        if(err) {
          return cb_(err);
        }
        if(table[channel]) {
          channel = table[channel];
        }
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(channel);
  });
};


