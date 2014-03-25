/*
 * TeaBag: pump.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author:  spolu
 *
 * @log:
 * - 2014-03-24 spolu  Creation
 */
"use strict";

var util = require('util');
var async = require('async');
var request = require('request');
var common = require('../../lib/common.js');

// ## pump
//
// Pumps messages (takes care of long polling) by registering client, timeouting
// registrations when not requested for some time, keeping operations on the
// oplog to redistribute it to all listeners.
//
// ```
// @spec {}
// ```
var pump = function(spec, my) {
  my = my || {};
  spec = spec || {};
  var _super = {};        

  my.LONG_POLL_DELAY = 5 * 1000;
  my.LONG_POLL_TIMEOUT = 2 * 60 * 1000;

  /* Holds the data to all long polling registrations: */
  /* ```                                               */
  /* user_id -> reg_id -> {                            */
  /*   last_seen: 123...,                              */
  /*   callback: null || [Function],                   */
  /*   backlog: [{ type, path, op }]                   */
  /* }                                                 */
  /* ```                                               */
  my.regs = {};
  my.next_reg_id = 0;

  //
  // _public_
  // 
  var push;     /* push(user_id, type, path, op); */
  var listen;   /* listen(user_id, reg_id, cb_(err, reg_id)); */

  //
  // #### _that_
  //
  var that = {};  

  /****************************************************************************/
  /* PUBLIC METHODS */
  /****************************************************************************/
  // ### push
  //
  // Record a new push to the oplog for the given user to be broadcasted to all 
  // listeners for that user
  // ```
  // @user_id {number} the user_id's oplog on which an operation is pushed
  // @type    {string} the type of the operation
  // @path    {string} the path of the operation
  // @op      {object} the actual operation
  // ```
  push = function(user_id, type, path, op) {
    if(my.regs[user_id]) {
      Object.keys(my.regs[user_id]).forEach(function(reg_id) {
        if(my.regs[user_id][reg_id].callback) {
          var cb_ = my.regs[user_id][reg_id].callback;
          clearTimeout(my.regs[user_id][reg_id].delay_itv);
          my.regs[user_id][reg_id].delay_itv = null;
          my.regs[user_id][reg_id].callback = null;
          return cb_(null, reg_id, {
            type: type,
            path: path,
            op: op
          });
        }
        else {
          my.regs[user_id][reg_id].backlog.push({
            type: type,
            path: path,
            op: op
          });
        }
      });
    }

    /* Finally we remove all timed out registrations. */
    var now = Date.now();
    Object.keys(my.regs[user_id]).forEach(function(user_id) {
      Object.keys(my.regs[user_id]).forEach(function(reg_id) {
        if(!my.regs[user_id][reg_id].callback &&
           (now - my.regs[user_id][reg_id].last_seen) > my.LONG_POLL_TIMEOUT) {
          delete my.regs[user_id][reg_id];
        }
      });
    });
  };

  // ### listen
  //
  // Registers a callback for the given `reg_id`. The callback will be returned
  // after my.LONG_POLL_DELAY without any result if no opetration was pushed on
  // the oplog for the specified user_id. As soon as an operation is pushed, the
  // callback is returned with that operation.
  //
  // If operation are received while no callback is registered, the operations
  // are stored in the backlog of the registration for immediate delivery as
  // soon as a new callback is returned
  //
  // If no `reg_id` is provided, a new one is created and returned along with
  // the data. Registration older than my.LONG_POLL_TIMEOUT are discarded.
  // ```
  // @user_id {number} the user_id's oplog on which an operation is pushed
  // @reg_id  {string} the registration to retrieve data from can be `null`
  // @cb_     {function(err, reg_id, [{ type, path, op }])}
  // ```
  listen = function(user_id, reg_id, cb_) {
    if(typeof user_id !== 'number') {
      return cb_(common.err('Invalid `user_id`: ' + user_id,
                            'PumpError:InvalidUserId'));
    }
    if(reg_id !== null && typeof reg_id !== 'string') {
      return cb_(common.err('Invalid `reg_id`: ' + reg_id,
                            'PumpError:InvalidRegId'));
    }
    reg_id = reg_id || (user_id + '_' + Date.now() + '_' + (++my.next_reg_id));

    if(!my.regs[user_id] || !my.regs[user_id][reg_id]) {
      my.regs[user_id] = my.regs[user_id] || {};
      my.regs[user_id][reg_id] = {
        last_seen: Date.now(),
        callback: null,
        backlog: []
      };
    }

    if(my.regs[user_id][reg_id].callback) {
      return cb_(common.err('Callback already pending on `reg_id`: ' + reg_id,
                            'PumpError:CallbackPending'));
    }
    else if(my.regs[user_id][reg_id].backlog.length > 0) {
      var backlog = my.regs[user_id][reg_id].backlog;
      my.regs[user_id][reg_id].backlog = [];
      my.regs[user_id][reg_id].last_seen = Date.now();
      backlog.sort(function(o1, o2) {
        return o1.op.date - o2.op.date;
      });
      return cb_(null, reg_id, backlog);
    }
    else {
      my.regs[user_id][reg_id].callback = cb_;
      my.regs[user_id][reg_id].last_seen = Date.now();

      my.regs[user_id][reg_id].delay_itv = setTimeout(function() {
        var cb_ = my.regs[user_id][reg_id].callback;
        clearTimeout(my.regs[user_id][reg_id].delay_itv);
        my.regs[user_id][reg_id].delay_itv = null;
        my.regs[user_id][reg_id].callback = null;
        return cb_(null, reg_id, []);
      }, my.LONG_POLL_DELAY);
    }
  };

  common.method(that, 'push', push, _super);
  common.method(that, 'listen', listen, _super);

  return that;
};

exports.pump = pump;

