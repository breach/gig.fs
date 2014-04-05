var request = require('request');
var common = require('../lib/common.js');
var async = require('async');

var _int = {};

exports.setUp = function(cb_) {
  require('./cluster_setup.js').clusterSetUp(1, function(err) {
    _int = require('./cluster_setup.js').clusterInternal();
    return cb_(err);
  });
};
exports.tearDown = function(cb_) {
  require('./cluster_setup.js').clusterTearDown(cb_);
};


exports.token_routes = function(test) {
  var tokens = [];
  var expiry = Date.now() + 1000 * 60 * 60 * 10;
  var deleted = null;

  var check_tokens = function(cb_) {
    async.series([
      function(cb_) {
        var t_url = _int.table.url + 'token/all?master=' + _int.user.master;
        request.get(t_url, { json: true }, function(err, res, all) {
          if(err) {
            return cb_(err);
          }
          test.equals(all.length, tokens.length);
          tokens.forEach(function(t, i) {
            test.equals(all[i].token, t);
            test.equals(all[i].expiry, expiry);
            test.ok(all[i].created_time < expiry);
          });
          return cb_();
        });
      },
      function(cb_) {
        async.each(tokens, function(t, cb_) {
          var t_url = _int.table.url + 'token/' + t + '/check';
          request.get(t_url, { json: true }, function(err, res, reply) {
            if(err) {
              return cb_(err);
            }
            test.ok(reply.ok);
            return cb_();
          });
        }, cb_);
      }
    ], cb_);
  };

  async.series([
    function(cb_) {
      require('./cluster_setup.js').clusterGetToken(expiry, function(err, t) {
        if(err) {
          return cb_(err);
        }
        tokens.push(t);
        test.equals(expiry, tokens[0].split('_')[1]);
        return cb_();
      });
    },
    check_tokens,
    function(cb_) {
      require('./cluster_setup.js').clusterGetToken(expiry, function(err, t) {
        if(err) {
          return cb_(err);
        }
        tokens.push(t);
        test.equals(expiry, tokens[1].split('_')[1]);
        return cb_();
      });
    },
    check_tokens,
    function(cb_) {
      var t_url = _int.table.url + 'token/' + tokens[0];
      request.del(t_url, { json: true }, function(err, res, reply) {
        if(err) {
          return cb_(err);
        }
        test.ok(reply.ok);
        deleted = tokens.shift();
        return cb_();
      });
    },
    check_tokens,
    function(cb_) {
      var t_url = _int.table.url + 'token/' + deleted + '/check';
      request.get(t_url, { json: true }, function(err, res, reply) {
        if(err) {
          return cb_(err);
        }
        test.equal(reply.error.name, 'UtilityError:InvalidToken');
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      throw err;
    }
    test.done();
  });
};


exports.table_routes = function(test) {
  var token = null;

  async.series([
    function(cb_) {
      var expiry = Date.now() + 1000 * 60 * 60 * 10;
      require('./cluster_setup.js').clusterGetToken(expiry, function(err, t) {
        if(err) {
          return cb_(err);
        }
        token = t;
        return cb_();
      });
    },
    function(cb_) {
      var t_url = _int.table.url + 'table?token=' + token;
      request.get(t_url, { json: true }, function(err, res, table) {
        if(err) {
          throw err;
        }
        var channel = _int.user.channel;
        var store_url = _int.stores[0].url;
        var store_id = common.hash([store_url]);
        var store_code = _int.stores[0].code;

        test.equal(Object.keys(table)[0], channel);
        test.equal(Object.keys(table[_int.user.channel])[0], store_id);
        test.equal(table[channel][store_id].id, store_id);
        test.equal(table[channel][store_id].url, store_url);
        test.equal(table[channel][store_id].code, store_code);

        //console.log(table);
        return cb_();
      });
    },
    function(cb_) {
      var ch = _int.user.channel;
      var t_url = _int.table.url + 'table/' + ch + '?token=' + token;
      request.get(t_url, { json: true }, function(err, res, channel) {
        if(err) {
          throw err;
        }
        var store_url = _int.stores[0].url;
        var store_id = common.hash([store_url]);
        var store_code = _int.stores[0].code;

        test.equal(Object.keys(channel)[0], store_id);
        test.equal(channel[store_id].id, store_id);
        test.equal(channel[store_id].url, store_url);
        test.equal(channel[store_id].code, store_code);

        //console.log(channel);
        return cb_();
      });
    }
  ], function(err) {
    if(err) {
      throw err;
    }
    test.done();
  });
};

