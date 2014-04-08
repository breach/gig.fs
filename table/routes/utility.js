/*
 * TeaBag: routes/utility.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-07 spolu  Introduce `session_token`
 * - 2014-02-28 spolu  Updated token check
 * - 2014-02-28 spolu  Creation
 */
"use strict";

var querystring = require('querystring');
var util = require('util');
var async = require('async');
var common = require('../../lib/common.js');
var storage = require('../../lib/storage.js').storage({});

/******************************************************************************/
/*                               UTILITY METHODS                              */
/******************************************************************************/
// ### user_master_check
//
// Utility method to check user credentials and existence based on its master
// ```
// @user_id {number} the user's id
// @master  {string} the user master token
// @cb_     {function(err), user}
// ```
exports.user_master_check = function(user_id, master, cb_) {
  var user = null;
  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'UtilityError:UserNotFound'));
        }
        else if(err) {
          return cb_(err);
        }
        else {
          if(master !== json.master) {
            return cb_(common.err('User Not Found: ' + user_id,
                                  'UtilityError:UserNotFound'));
          }
          user = json;
          return cb_();
        }
      });
    }
  ], function(err) {
    return cb_(err, user);
  });
};



// ### user_session_token_check
//
// Utility method to check user credentials and existence based on a 
// `session_token`
// ```
// @user_id       {number} the user's id
// @session_token {string} a user session_token
// @cb_           {function(err), user}
// ```
exports.user_session_token_check = function(user_id, session_token, cb_) {
  var user = null;
  var found = null; 

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'UtilityError:UserNotFound'));
        }
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      storage.get(user_id, 'sessions.json', function(err, sessions) {
        if(err) {
          return cb_(err);
        }
        /* Filters out old sessions. Done whenever the `sessions.json` file */
        /* is fetched from disk.                                            */
        sessions = sessions.filter(function(s) {
          return exports.check_sesions(user, s);
        });

        /* Retrieve session object and update `last_check` */
        sessions.forEach(function(s) {
          if(s.session_token === session_token) {
            s.last_check = Date.now();
            found = s;
          }
        });

        /* We write back the sessions as we updated the `last_check` or */
        /* filtered outdated sessions.                                  */
        return storage.put(user_id, 'sessions.json', tokens, cb_);
      });
    }
  ], function(err) {
    if(err) {
      return cb_(err);
    }
    else if(found) {
      return cb_(null, user);
    }
    else {
      return cb_(common.err('Invalid `session_token`: ' + session_token,
                            'UtilityError:InvalidSessionToken'));
    }
  });
};

// ### user_store_token_check
//
// Utility method to check user credentials and existence based on a 
// `store_token`
// ```
// @user_id       {number} the user's id
// @store_token   {string} a user store_token
// @cb_           {function(err), user}
// ```
exports.user_store_token_check = function(user_id, store_token, cb_) {
  var user = null;
  var found = null; 

  async.series([
    function(cb_) {
      storage.get(user_id, 'user.json', function(err, json) {
        if(err && err.code === 'ENOENT') {
          return cb_(common.err('User Not Found: ' + user_id,
                                'UtilityError:UserNotFound'));
        }
        user = json;
        return cb_(err);
      });
    },
    function(cb_) {
      storage.get(user_id, 'sessions.json', function(err, sessions) {
        if(err) {
          return cb_(err);
        }
        /* Filters out old sessions. Done whenever the `sessions.json` file */
        /* is fetched from disk.                                            */
        sessions = sessions.filter(function(s) {
          return exports.check_sesions(user, s);
        });

        /* Retrieve session matching this `store_token` and check. */
        sessions.forEach(function(s) {
          if(exports.check_store_token(s.session_token, store_token)) {
            found = s;
            s.last_check = Date.now();
          }
        });

        /* We write back the sessions as we updated the `last_check` or */
        /* filtered outdated sessions.                                  */
        return storage.put(user_id, 'sessions.json', tokens, cb_);
      });
    }
  ], function(err) {
    if(err) {
      return cb_(err);
    }
    else if(found) {
      return cb_(null, user);
    }
    else {
      return cb_(common.err('Invalid `store_token`: ' + store_token,
                            'UtilityError:InvalidStoreToken'));
    }
  });
};


// ### check_session_token
//
// Checks the `session_token` integrity and validity. Returns boolean.
// ```
// @user          {master, ...} the user object
// @session_token {string} the session_token
// ```
exports.check_session_token = function(user, session_token) {
  if(typeof session_token !== 'string' || 
     session_token.split('_').length !== 5) {
    return false;
  }
  var split = session_token.split('_');

  if(split[0] !== 'session') {
    return false;
  }
  if(split[1] !== user.user_id) {
    return false;
  }
  var timeout = parseInt(split[3], 10);
  if(!timeout ||
     timeout < 1000 ||
     timeout > (1000 * 60 * 60 * 24 * 31)) {
    return false;
  }
  if(split[4] !== common.hash([user.master,
                               common.KEY,
                               split[1],
                               split[2],
                               split[3]])) {
    return false;
  }
  return true;
};

// ### check_session
//
// Checks whether a session object is still valid or not. Returns boolean.
// ```
// @user    {master, ...} the user object
// @session {token_token, timeout, description, last_check} the session object
// ```
exports.check_session = function(user, session) {
  if(!exports.check_session_token(user, session.session_token)) {
    return false;
  }
  var split = session.session_token.split('_');
  if(!session.timeout || 
     session.timeout < 1000 ||
     session.timeout > (1000 * 60 * 60 * 24 * 31)) {
    return false;
  }
  if(user.user_id !== parseInt(split[1], 10)) {
    return false;
  }
  if(session.created_time !== parseInt(split[2], 10)) {
    return false;
  }
  if(session.timeout !== parseInt(split[3], 10)) {
    return false;
  }
  if(!session.last_check) {
    return false;
  }
  if((session.last_check + session.timeout) < Date.now()) {
    return false;
  }
  return true;
};

// ### make_session
//
// Creates a new session object with a new `session_token`
// ```
// @user { master, ... } the user object
// ```
exports.make_session = function(user, timeout, description) {
  var now = Date.now();
  return ({
    timeout: timeout,
    description: description,
    session_token: 'session_' + user.user_id + '_' + 
                                now + '_' + 
                                timeout + '_' + 
                                common.hash([user.master,
                                             common.KEY,
                                             user.user_id.toString(),
                                             now.toString(),
                                             timeout.toString()]),
    created_time: now,
    last_check: now
  });
};


// ### make_store_token
//
// Computes the store_token for the given session_token and store_id. We assume
// the session_token is valid here.
// ```
// @session_token {string} the session_token to use
// @store         {store_id, ...} the store object
// ```
exports.make_store_token = function(session_token, store) {
  var split = session_token.split('_');
  return ('store_' + split[1] + '_' + 
                     split[2] + '_' + 
                     split[3] + '_' + 
                     store.store_id + '_' + 
                     common.hash([split[4],
                                  store.store_id]));
};

// ### check_store_token
//
// Checks the `store_token` integrity and validity. Returns boolean. We assume
// the session_token is valid here.
// ```
// @session_token {string} the session_token to use
// @store_token   {string} the store_token to check
// ```
exports.check_store_token = function(session_token, store_token) {
  if(typeof session_token !== 'string' || 
     session_token.split('_').length !== 5) {
    return false;
  }
  var session_split = session_token.split('_');

  if(typeof store_token !== 'string' || 
     store_token.split('_').length !== 6) {
    return false;
  }
  var store_split = store_token.split('_');

  if(store_split[0] !== 'store') {
    return false;
  }
  if(store_split[1] !== session_split[1]) {
    return false;
  }
  if(store_split[2] !== session_split[2]) {
    return false;
  }
  if(store_split[3] !== session_split[3]) {
    return false;
  }

  if(store_split[5] !== common.hash([session_split[4],
                                     store_split[4]])) {
    return false;
  }
  return true;
};
