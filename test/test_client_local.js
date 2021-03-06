var common = require('../lib/common.js');
var async = require('async');
var rimraf = require('rimraf');

var _gig = null;

exports.setUp = function(cb_) {
  var TIMEOUT = 1000 * 60;

  var storage_path = require('path').join(process.cwd(), 'GIGFS_STORAGE_PATH');
  
  async.series([
    function(cb_) {
      rimraf(storage_path, cb_);
    },
    function(cb_) {
      _gig = require('../client/index.js').gig({
        local_table: {
          'test': [ {
            in_memory: true
          }, {
            storage_path: storage_path
          } ]
        }
      });
      _gig.init(cb_);
    }
  ], cb_);
};

exports.tearDown = function(cb_) {
  _gig.kill(cb_);
};

exports.table_api = function(test) {
  var channel = 'test';

  test.deepEqual(_gig.channels(), [channel]);
  test.ok(_gig.channel(channel).stores().length === 2);
  test.ok(typeof _gig.channel(channel).store(_gig.channel(channel).stores()[1]).storage_path() !== 'undefined');
  test.ok(_gig.channel(channel).store(_gig.channel(channel).stores()[0]).in_memory());
 
  return test.done();
};

exports.no_reducer = function(test) {
  var channel = 'test';

  async.series([
    function(cb_) {
      _gig.get(channel, 'test', '/foo/bar', function(err, value) {
        test.equal(err.name, 'ReducerError:TypeNotRegistered');
        test.equal(value, undefined);
        return cb_();
      });
    },
    function(cb_) {
      _gig.push(channel, 'test', '/foo/bar', { foo: 'bar' },  function(err, value) {
        test.equal(err.name, 'ReducerError:TypeNotRegistered');
        test.equal(value, undefined);
        return cb_();
      });
    }
  ], test.done);
};

exports.push_get = function(test) {
  var channel = 'test';

  _gig.register('test', function(oplog) {
    var val = oplog[0].value || 0;
    val += (oplog.length - 1);
    return val;
  });

  async.series([
    function(cb_) {
      _gig.get(channel, 'test', '/foo/bar', function(err, value) {
        test.equal(value, 0);
        return cb_();
      });
    },
    function(cb_) {
      _gig.push(channel, 'test', '/foo/bar', { foo: 'bar' }, function(err, value) {
        test.equal(value, 1);
        return cb_();
      });
    },
    function(cb_) {
      _gig.get(channel, 'test', '/foo/bar', function(err, value) {
        test.equal(value, 1);
        return cb_();
      });
    }
  ], test.done);
};
