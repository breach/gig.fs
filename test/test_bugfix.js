var request = require('request');
var common = require('../lib/common.js');
var async = require('async');
var rimraf = require('rimraf');

var _int = {};
var _session = null;
var _gig = null;

exports.setUp = function(cb_) {
  var TIMEOUT = 1000 * 60;
  var storage_path = require('path').join(process.cwd(), 'GIGFS_STORAGE_PATH');

  async.series([
    function(cb_) {
      rimraf(storage_path, cb_);
    },
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
      _gig = require('../client/index.js').gig({
        remote_table: {
          table_url: _int.table.url,
          session_token: _session.session_token
        },
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
  /* We add a setTimeout otherwise the remote part does not even get the time */
  /* to finish before the whole test is run with the local part.              */
  setTimeout(function() {
    _gig.kill(function(err) {
      if(err) {
        return cb_(err);
      }
      require('./cluster_setup.js').tear_down(cb_);
    });
  }, 100);
};

exports.fix_1 = function(test) {
  var channel = _int.user.channel;

  _gig.register('test', function(oplog) {
    return undefined;
  });

  async.series([
    function(cb_) {
      _gig.get(channel, 'test', '/foo/bar', function(err, value) {
        test.equal(err.name, 'ReducerError:ValueUndefined');
        return cb_();
      });
    },
  ], test.done);
};

