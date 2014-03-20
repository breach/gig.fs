/*
 * TeaBag: routes/token.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-28 spolu  Added `token/all' route
 * - 2014-02-28 spolu  Removed `master` requirement for token deletion
 * - 2014-02-28 spolu  Moved utility methods to 'utility.js'
 * - 2014-02-19 spolu  Creation
 */
"use strict";

var querystring = require('querystring');
var util = require('util');
var async = require('async');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

/******************************************************************************/
/*                                   ROUTES                                   */
/******************************************************************************/
//
// ### GET /user/:user_id/token
//     master only
//
exports.get_token = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  var expiry = parseInt(req.param('expiry', 10));
  if(!expiry || 
     expiry < Date.now() ||
     expiry > (Date.now() + 1000 * 60 * 60 * 24 * 365)) {
    return res.error(common.err('Invalid `expiry`: ' + req.param('expiry'),
                                'TokenError:InvalidExpire'));
  }
  var description = req.param('description') || '';

  var user = null;
  var token = null;

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
      storage.get(user_id, 'tokens.json', function(err, tokens) {
        if(err) {
          return cb_(err);
        }
        var now = Date.now();
        token = {
          token: now + '_' + expiry + '_' + 
                 common.hash([user.master,
                              common.KEY,
                              now.toString(),
                              expiry.toString()]),
          expiry: expiry,
          description: description,
          created_time: now
        }
        if(!require('./utility.js').check_token_object(user, token)) {
          return cb_(common.err('Invalid `token`: ' + token.token,
                                'TokenError:InvalidToken'));
        }
        /* Filters out old tokens. Done whenever the `tokens.json` file is */
        /* fetched from disk.                                              */
        tokens = tokens.filter(function(t) {
          return require('./utility.js').check_token_object(user, t);
        });
        tokens.push(token);

        return storage.put(user_id, 'tokens.json', tokens, cb_);
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(token);
  });
};

// ### GET /user/:user_id/token/all
//     master only
//
exports.get_token_all = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  var user = null;
  var tokens = null;

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
      storage.get(user_id, 'tokens.json', function(err, json) {
        if(err) {
          return cb_(err);
        }
        /* Filters out old tokens. Done whenever the `tokens.json` file is */
        /* fetched from disk.                                              */
        tokens = json.filter(function(t) {
          return require('./utility.js').check_token_object(user, t);
        });
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(tokens);
  });
};

//
// ### DEL /user/:user_id/token/:token
//     no master check (token suffices)
//
exports.del_token = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  var user = null;

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'TokenError:UserNotFound'));
        }
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      storage.get(user_id, 'tokens.json', function(err, tokens) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'TokenError:UserNotFound'));
        }
        if(err) {
          return cb_(err);
        }
        /* Filters out old tokens. Done whenever the `tokens.json` file is */
        /* fetched from disk.                                              */
        tokens = tokens.filter(function(t) {
          return require('./utility.js').check_token_object(user, t);
        });
        tokens = tokens.filter(function(t) {
          if(t.token === req.param('token'))
            return false;
          return true;
        });

        return storage.put(user_id, 'tokens.json', tokens, cb_);
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
// ### GET /user/:user_id/token/:token/check
//
exports.get_token_check = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'TableError:InvalidUserId'));
  }

  var user = null;

  async.series([
    function(cb_) {
      require('./utility.js').user_token_check(user_id,
                                               req.param('token'),
                                               function(err, json) {
        user = json;
        return cb_(err);
      });
    },
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.ok({});
  });
};
