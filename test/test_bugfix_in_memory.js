var common = require('../lib/common.js');
var async = require('async');

var _gig = null;

exports.setUp = function(cb_) {
  var TIMEOUT = 1000 * 60;

  _gig = require('../client/index.js').gig({
    in_memory: true,
    in_memory_channels: ['test']
  });
  _gig.init(cb_);
};

exports.tearDown = function(cb_) {
  _gig.kill(cb_);
};

exports.fix_1 = function(test) {
  var channel = 'test';

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

