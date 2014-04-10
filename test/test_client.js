var request = require('request');
var common = require('../lib/common.js');
var async = require('async');

var _int = {};
var _session = null;
var _tb = null;

exports.setUp = function(cb_) {
  var TIMEOUT = 1000 * 60;

  async.series([
    function(cb_) {
      _int = require('./cluster_setup.js').internal();
      return cb_();
    },
    function(cb_) {
      require('./cluster_setup.js').table_setup(true, cb_);
    },
    function(cb_) {
      require('./cluster_setup.js').store_setup(true, cb_);
    },
    function(cb_) {
      require('./cluster_setup.js').table_session(TIMEOUT, function(err, s) {
        _session = s;
        return cb_(err);
      });
    },
    function(cb_) {
      _tb = require('../client/index.js').teabag({
        table_url: _int.table.url,
        session_token: _session.session_token
      });
      _tb.init(cb_);
    }
  ], cb_);
};

exports.tearDown = function(cb_) {
  _tb.kill(function(err) {
    if(err) {
      return cb_(err);
    }
    require('./cluster_setup.js').tear_down(cb_);
  });
};

exports.table_api = function(test) {
  var channel = _int.user.channel;
  var store_id = common.hash([_int.stores[0].url]);
  var store_url = _int.stores[0].url;

  test.deepEqual(_tb.channels(), [channel]);
  test.deepEqual(_tb.channel(channel).stores(), [store_id]);
  test.deepEqual(_tb.channel(channel).store(store_id).url(), store_url);
 
  return test.done();
};

exports.no_reducer = function(test) {
  var channel = _int.user.channel;

  async.series([
    function(cb_) {
      _tb.get(channel, 'test', '/foo/bar', function(err, value) {
        test.equal(err.name, 'StoreError:TypeNotRegistered');
        test.equal(value, undefined);
        return cb_();
      });
    },
    function(cb_) {
      _tb.push(channel, 'test', '/foo/bar', { foo: 'bar' },  function(err, value) {
        test.equal(err.name, 'StoreError:TypeNotRegistered');
        test.equal(value, undefined);
        return cb_();
      });
    }
  ], test.done);
};

exports.push_get = function(test) {
  var channel = _int.user.channel;

  _tb.register('test', function(oplog) {
    var val = oplog[0].value || 0;
    val += (oplog.length - 1);
    return val;
  });

  async.series([
    function(cb_) {
      _tb.get(channel, 'test', '/foo/bar', function(err, value) {
        test.equal(value, 0);
        return cb_();
      });
    },
    function(cb_) {
      _tb.push(channel, 'test', '/foo/bar', { foo: 'bar' }, function(err, value) {
        test.equal(value, 1);
        return cb_();
      });
    },
    function(cb_) {
      /* We wait for the communication to happen. */
      setTimeout(cb_, 100);
    },
    function(cb_) {
      _tb.get(channel, 'test', '/foo/bar', function(err, value) {
        test.equal(value, 1);
        return cb_();
      });
    }
  ], test.done);
};
