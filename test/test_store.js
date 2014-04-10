var request = require('request');
var common = require('../lib/common.js');
var async = require('async');

var _int = {};

exports.setUp = function(cb_) {
  async.series([
    function(cb_) {
      _int = require('./cluster_setup.js').internal();
      return cb_();
    },
    function(cb_) {
      require('./cluster_setup.js').table_setup(false, cb_);
    },
    function(cb_) {
      require('./cluster_setup.js').store_setup(false, cb_);
    }
  ], cb_);
};

exports.tearDown = function(cb_) {
  require('./cluster_setup.js').tear_down(cb_);
};

exports.store_token_routes = function(test) {
  var session = null;
  var table = null;
  var TIMEOUT = 1000 * 60;

  async.series([
    function(cb_) {
      require('./cluster_setup.js').table_session(TIMEOUT, function(err, s) {
        session = s;
        return cb_(err);
      });
    },
    function(cb_) {
      require('./cluster_setup.js').table_table(session.session_token, function(err, t) {
        table = t;
        return cb_(err);
      });
    },
    function(cb_) {
      console.log(table);
      /* TODO(spolu): CHECK table.test.store_id.store_token */
      return cb_();
    }
  ], function(err) {
    if(err) {
      throw err;
    }
    test.done();
  });
};
