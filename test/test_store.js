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
  var store = null;
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
        store = table['test'][common.hash([_int.stores[0].url])];
        return cb_(err);
      });
    },
    function(cb_) {
      test.deepEqual(Object.keys(table), ['test']);
      test.deepEqual(Object.keys(table['test']), [common.hash([_int.stores[0].url])]);
      test.equals(store.store_id, common.hash([_int.stores[0].url]));
      return cb_();
    },
    function(cb_) {
      var s_url = store.url + 'oplog?store_token=' + store.store_token + 
                                   '&path=/&type=test';
      request.get(s_url, {
        json: true
      }, function(err, res, body) {
        if(err) {
          return cb_(err);
        }
        test.equals(body.value, null);
        return cb_();
      });
    },
    function(cb_) {
      var s_url = store.url + 'session/' + store.store_token;
      request.del(s_url, {
        json: true
      }, function(err, res, body) {
        if(err) {
          return cb_(err);
        }
        console.log(body);
        return cb_();
      });
    },
    function(cb_) {
      var s_url = store.url + 'oplog?store_token=' + store.store_token + 
                                   '&path=/&type=test';
      request.get(s_url, {
        json: true
      }, function(err, res, body) {
        if(err) {
          return cb_(err);
        }
        test.equals(body.value, null);
        return cb_();
      });
    },
  ], function(err) {
    if(err) {
      throw err;
    }
    test.done();
  });
};
