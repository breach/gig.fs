/*
 * TeaBag: routes/table.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-07 spolu  Introduce `store_token`
 * - 2014-03-20 spolu  Use `request` package
 * - 2014-02-28 spolu  Allow table access with token
 * - 2014-02-28 spolu  Move utility methods to `utility.js`
 * - 2014-02-19 spolu  Creation
 */
"use strict";

var querystring = require('querystring');
var util = require('util');
var async = require('async');
var request = require('request');

var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### POST /user/:user_id/table/:channel/store
//          { store_url, code }
//          master only
//
exports.post_channel_store = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  if(!req.body ||
     typeof req.body.store_url !== 'string' ||
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
      var url_p = require('url').parse(req.body.store_url);
      if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
         url_p.query || url_p.search || 
         !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
        return cb_(common.err('Invalid URL: ' + req.body.url,
                              'TableError:InvalidStoreUrl'));
      }
      store = {
        store_id: common.hash([url_p.href]),
        url: url_p.href,
        code: req.body.code,
        created_time: Date.now()
      };
      return cb_();
    },
    function(cb_) {
      var confirm_url = store.url + 'confirm';
      request.post({
        url: confirm_url,
        json: {
          code: store.code,
          table_url: common.BASE_URL + 'user/' + user_id + '/'
        }
      }, function(err, res, json) {
        if(err) {
          return cb_(err);
        }
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
      });
    },
    function(cb_) {
      storage.get(user_id, 'table.json', function(err, table) {
        if(err) {
          return cb_(err);
        }
        table[channel] = table[channel] || {};
        table[channel][store.store_id] = store;
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
// master, session_token
//
exports.get_table = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  if(typeof req.param('master') !== 'string' &&
     typeof req.param('session_token') !== 'string') {
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
        return require('./utility.js')
                 .user_session_token_check(user_id,
                                           req.param('session_token'),
                                           function(err, json) {
          user = json;
          return cb_(err);
        });
      }
    },
    function(cb_) {
      storage.get(user_id, 'table.json', function(err, json) {
        if(err) {
          return cb_(err);
        }
        table = json;
        if(req.param('session_token')) {
          Object.keys(table).forEach(function(c) {
            Object.keys(table[c]).forEach(function(s) {
              table[c][s].store_token = 
                require('./utility.js').make_store_token(req.param('session_token'),
                                                         table[c][s]);
            });
          });
        }
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
     typeof req.param('session_token') !== 'string') {
    return res.error(common.err('Missing Credentials',
                                'TableError:MissingCredentials'));
  }
  
  var ch = req.param('channel');
  if(typeof ch !== 'string' || ch.length === 0) {
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
        return require('./utility.js')
                 .user_session_token_check(user_id,
                                           req.param('session_token'),
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
        if(t[ch]) {
          channel = t[ch];
          if(req.param('session_token')) {
            Object.keys(channel).forEach(function(s) {
              channel[s].store_token = 
                require('utility.js').make_store_token(req.param('session_token'),
                                                       channel[s]);
            });
          }
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

//
// ### GET /user/:user_id/table/check/:store_token
//
exports.get_store_token_check = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'SessionError:InvalidUserId'));
  }

  var user = null;

  async.series([
    function(cb_) {
      require('./utility.js').user_store_token_check(user_id,
                                                     req.param('store_token'),
                                                     function(err, json) {
        user = json;
        return cb_(err);
      });
    },
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok();
  });
};


