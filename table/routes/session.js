/*
 * GiG.fs: routes/session.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-07 spolu  Introduce `session_token` [token.js -> session.js]
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
// ### GET /user/:user_id/session/new
//     master only
//
exports.get_session_new = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'SessionError:InvalidUserId'));
  }

  var timeout = parseInt(req.param('timeout', 10));
  if(!timeout || 
     timeout < 1000 ||
     timeout > (1000 * 60 * 60 * 24 * 31)) {
    return res.error(common.err('Invalid `timeout`: ' + req.param('timeout'),
                                'SessionError:InvalidTimeout'));
  }
  var description = req.param('description') || '';

  var user = null;
  var session = null;

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
      storage.get(user_id, 'sessions.json', function(err, sessions) {
        if(err) {
          return cb_(err);
        }
        session = require('./utility.js').make_session(user, 
                                                       timeout, description);
        if(!require('./utility.js').check_session(user, session)) {
          return cb_(common.err('Invalid `session`: ' + session.session_token,
                                'SessionError:InvalidSession'));
        }
        /* Filters out old sessions. Done whenever the `sessions.json` file */
        /* is fetched from disk.                                            */
        sessions = sessions.filter(function(s) {
          return require('./utility.js').check_session(user, s);
        });
        sessions.push(session);

        return storage.put(user_id, 'sessions.json', sessions, cb_);
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(session);
  });
};

// ### GET /user/:user_id/session/all
//     master only
//
exports.get_session_all = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'SessionError:InvalidUserId'));
  }

  var user = null;
  var sessions = null;

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
      storage.get(user_id, 'sessions.json', function(err, json) {
        if(err) {
          return cb_(err);
        }
        /* Filters out old sessions. Done whenever the `sessions.json` file */
        /* is fetched from disk.                                            */
        sessions = json.filter(function(s) {
          return require('./utility.js').check_session(user, s);
        });
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      return res.error(err);
    }
    return res.data(sessions);
  });
};

//
// ### DEL /user/:user_id/session/:session_token
//     no master check (token suffices)
//
exports.del_session = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'SessionError:InvalidUserId'));
  }

  var user = null;

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'SessionError:UserNotFound'));
        }
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      storage.get(user_id, 'sessions.json', function(err, sessions) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'SessionError:UserNotFound'));
        }
        if(err) {
          return cb_(err);
        }
        /* Filters out old sessions. Done whenever the `sessions.json` file */
        /* is fetched from disk.                                            */
        sessions = sessions.filter(function(s) {
          return require('./utility.js').check_session(user, s);
        });
        sessions = sessions.filter(function(s) {
          if(s.session_token === req.param('session_token'))
            return false;
          return true;
        });

        return storage.put(user_id, 'sessions.json', sessions, cb_);
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
// ### GET /user/:user_id/session/check/:session_token
//
exports.get_session_token_check = function(req, res, next) {
  var user_id = parseInt(req.param('user_id', 10));
  if(!user_id) {
    return res.error(common.err('Invalid `user_id`: ' + req.param('user_id'),
                                'SessionError:InvalidUserId'));
  }

  var user = null;

  async.series([
    function(cb_) {
      require('./utility.js').user_session_token_check(user_id,
                                                       req.param('session_token'),
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

