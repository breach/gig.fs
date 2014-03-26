/*
 * TeaBag: routes/user.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-02-28 spolu  Updated `code` format
 * - 2014-02-26 spolu  Creation
 */
"use strict";

var querystring = require('querystring');
var util = require('util');
var async = require('async');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

var tokens = require('../lib/tokens.js').tokens({});
var pump = require('../lib/pump.js').pump({});

/******************************************************************************/
/*                               UTILITY METHODS                              */
/******************************************************************************/
exports.empty_oplog = function() {
  var op = {
    date: 0,
    value: null
  };
  op.sha = common.hash([ op.date.toString(),
                         JSON.stringify(op.value) ]);
  return [op];
};

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### POST /user/:user_id/confirm
//          { table_url, code }
//
exports.post_confirm = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'UserError:InvalidUserId'));
  }

  if(!req.body ||
     typeof req.body.table_url !== 'string' ||
     typeof req.body.code !== 'string') {
    return res.error(common.err('Invalid POST body: ' + JSON.stringify(req.body),
                                'UserError:InvalidPostBody'));
  }
  var code = req.body.code;
  if(typeof code !== 'string' || 
     code.length === 0 || code.split('_').length !== 3) {
    return res.error(common.err('Invalid `code`: ' + req.body.code,
                                'UserError:InvalidCode'));
  }

  var user = null;

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      if(!parseInt(code.split('_')[0], 10) ||
         parseInt(code.split('_')[0], 10) >= Date.now()) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      if(!parseInt(code.split('_')[1], 10) ||
         parseInt(code.split('_')[1], 10) < Date.now()) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      if(code.split('_')[2] !== common.hash([common.KEY,
                                             user_id.toString(),
                                             code.split('_')[0].toString(),
                                             code.split('_')[1].toString()])) {
        return cb_(common.err('Invalid `code`: ' + code,
                              'UserError:InvalidCode'));
      }
      return cb_();
    },
    function(cb_) {
      var url_p = require('url').parse(req.body.table_url);
      if((url_p.protocol !== 'http:' && url_p.protocol !== 'https:') ||
         url_p.query || url_p.search || 
         !url_p.path || url_p.path[url_p.path.length - 1] !== '/') {
        return cb_(common.err('Invalid URL: ' + req.body.table_url,
                              'UserError:InvalidTableUrl'));
      }
      var table_url = url_p.href;
      user.table = {
        id: common.hash([table_url]),
        url: table_url,
        created_time: Date.now()
      };
      return storage.put(user_id, 'user.json', user, cb_);
    },
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok();
  });
};

//
// ### POST /user/:user_id/oplog
//          { date, payload | value, sha }
//
exports.post_oplog = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'UserError:InvalidUserId'));
  }

  var token = req.param('token');

  var type = req.param('type');
  if(typeof type !== 'string' || 
     type.indexOf('/') !== -1 || type.indexOf('.') !== -1) {
    return res.error(common.err('Invalid `type`: ' + req.param('type'),
                                'UserError:InvalidType'));
  }

  var path = req.param('path');
  if(typeof path !== 'string') {
    return res.error(common.err('Invalid `path`: ' + req.param('path'),
                                'UserError:InvalidPath'));
  }

  var op = {
    date: req.body.date,
    sha: req.body.sha
  }
  if(req.body.payload) {
    op.payload = req.body.payload
  }
  else if(req.body.value) {
    op.value = req.body.value
  }

  if((!op.payload && !op.value) || !op.sha || !op.date) {
    return res.error(common.err('Invalid `op` Body',
                                'UserError:InvalidOpBody'));
  }

  var oplog = null;
  var noop = false;

  async.series([
    function(cb_) {
      tokens.check(user_id, token, function(err, valid) {
        if(err) {
          return cb_(err);
        }
        if(!valid) {
          return cb_(common.err('Invalid `token`: ' + req.param('token'),
                                'UserError:InvalidToken'));
        }
        return cb_();
      });
    },
    function(cb_) {
      storage.get(user_id, '/root/' + type + '/' + path, function(err, json) {
        if(err) {
          if(err.code === 'ENOENT') {
            oplog = exports.empty_oplog();
            return cb_();
          }
          else {
            return cb_(err);
          }
        }
        oplog = json;
        return cb_();
      });
    },
    function(cb_) {
      for(var i = 0; i < oplog.length; i ++) {
        if(op.sha === oplog[i].sha) {
          noop = true;
          common.log.out('NOOP: ' + op.sha);
          return cb_();
        }
      }
      oplog.push(op);
      oplog.sort(function(o1, o2) {
        return o1.date - o2.date;
      });

      return storage.put(user_id, 
                         '/root/' + type + '/' + path, 
                         oplog, 
                         cb_);
    },
    function(cb_) {
      /* Finally we push the operation to `pump` */
      if(!noop) {
        pump.push(user_id, type, path, op);
      }
      return cb_();
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok();
  });
};

//
// ### GET /user/:user_id/oplog
//
exports.get_oplog = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'UserError:InvalidUserId'));
  }

  var token = req.param('token');

  var type = req.param('type');
  if(typeof type !== 'string' || 
     type.indexOf('/') !== -1 || type.indexOf('.') !== -1) {
    return res.error(common.err('Invalid `type`: ' + req.param('type'),
                                'UserError:InvalidType'));
  }

  var path = req.param('path');
  if(typeof path !== 'string') {
    return res.error(common.err('Invalid `path`: ' + req.param('path'),
                                'UserError:InvalidPath'));
  }

  var oplog = [];

  async.series([
    function(cb_) {
      tokens.check(user_id, token, function(err, valid) {
        if(err) {
          return cb_(err);
        }
        if(!valid) {
          return cb_(common.err('Invalid `token`: ' + req.param('token'),
                                'UserError:InvalidToken'));
        }
        return cb_();
      });
    },
    function(cb_) {
      storage.get(user_id, '/root/' + type + '/' + path, function(err, json) {
        if(err) {
          if(err.code === 'ENOENT') {
            oplog = exports.empty_oplog();
            return cb_();
          }
          else {
            return cb_(err);
          }
        }
        oplog = json;
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(oplog);
  });
};


//
// ### GET /user/:user_id/oplog/stream
//
exports.get_oplog_stream = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'UserError:InvalidUserId'));
  }

  var reg_id = null;
  if(req.param('reg_id')) {
    reg_id = req.param('reg_id');
    if(typeof reg_id != 'string') {
      return res.error(common.err('Invalid `reg_id`: ' + req.param('reg_id'),
                                  'UserError:InvalidRegId'));
    }
  }

  var token = req.param('token');
  var data = {
    reg_id: null,
    stream: []
  };

  async.series([
    function(cb_) {
      tokens.check(user_id, token, function(err, valid) {
        if(err) {
          return cb_(err);
        }
        if(!valid) {
          return cb_(common.err('Invalid `token`: ' + req.param('token'),
                                'UserError:InvalidToken'));
        }
        return cb_();
      });
    },
    function(cb_) {
      var closed = false;
      res.on('close', function() {
        closed = true;
        return cb_();
      });
      pump.listen(user_id, reg_id, function(err, reg_id, stream) {
        if(closed) return;
        if(err) {
          return cb_(err);
        }
        data.reg_id = reg_id;
        data.stream = stream;
        return cb_();
      });
    }
  ], function(err) {
    console.log('REPLYING: ' + err);
    if(err) {
      return res.error(err);
    }
    return res.data(data);
  });
};

