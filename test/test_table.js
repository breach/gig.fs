var request = require('request');
var common = require('../lib/common.js');
var async = require('async');

var _int = {};

exports.setUp = function(cb_) {
  require('./cluster_setup.js').table_setup(true, function(err) {
    _int = require('./cluster_setup.js').internal();
    return cb_(err);
  });
};

exports.tearDown = function(cb_) {
  require('./cluster_setup.js').tear_down(cb_);
};

exports.session_routes = function(test) {
  var sessions = [];
  var TIMEOUT = 1000 * 60 * 60;
  var last = null;
  var deleted = null;

  var check_sessions = function(cb_) {
    async.series([
      function(cb_) {
        var last = Date.now();
        async.each(sessions, function(s, cb_) {
          var t_url = _int.table.url + 'session/check/' + s.session_token;
          request.get(t_url, { json: true }, function(err, res, reply) {
            if(err) {
              return cb_(err);
            }
            test.ok(reply.ok);
            return cb_();
          });
        }, cb_);
      },
      function(cb_) {
        var t_url = _int.table.url + 'session/all?master=' + _int.user.master;
        request.get(t_url, { json: true }, function(err, res, all) {
          if(err) {
            return cb_(err);
          }
          test.equals(all.length, sessions.length);
          sessions.forEach(function(s, i) {
            test.equals(all[i].session_token, s.session_token);
            test.equals(all[i].timeout, s.timeout);
            test.ok(all[i].last_check + all[i].timeout > Date.now());
            test.ok(all[i].last_check > last);
          });
          return cb_();
        });
      }
    ], cb_);
  };

  async.series([
    function(cb_) {
      require('./cluster_setup.js').table_session(TIMEOUT, function(err, session) {
        if(err) {
          return cb_(err);
        }
        sessions.push(session);
        test.equals(TIMEOUT, session.session_token.split('_')[3]);
        test.equals(TIMEOUT, session.timeout);
        return cb_();
      });
    },
    check_sessions,
    function(cb_) {
      require('./cluster_setup.js').table_session(2 * TIMEOUT, function(err, session) {
        if(err) {
          return cb_(err);
        }
        sessions.push(session);
        test.equals(2 * TIMEOUT, session.session_token.split('_')[3]);
        test.equals(2 * TIMEOUT, session.timeout);
        return cb_();
      });
    },
    check_sessions,

    function(cb_) {
      var t_url = _int.table.url + 'session/' + sessions[0].session_token;
      request.del(t_url, { json: true }, function(err, res, reply) {
        if(err) {
          return cb_(err);
        }
        test.ok(reply.ok);
        deleted = sessions.shift();
        return cb_();
      });
    },
    check_sessions,
    function(cb_) {
      var t_url = _int.table.url + 'session/check/' + deleted.session_token;
      request.get(t_url, { json: true }, function(err, res, reply) {
        if(err) {
          return cb_(err);
        }
        test.equal(reply.error.name, 'UtilityError:InvalidSessionToken');
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

/*

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
*/
