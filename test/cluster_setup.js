
var async = require('async');
var path = require('path');
var request = require('request');
var rimraf = require('rimraf');

var my = {
  procs: []
};

exports.clusterSetUp = function(store_count, cb_) {

  my.user = {
    master: 'foobar',
    stream: 'test'
  };

  my.stores = [];
  for(var i = 0; i < store_count; i ++) {
    my.stores[i] = {
      port: 4001 + i,
      key: 'teabag_store_test_key_' + i,
      data_path: path.join(__dirname, 'TEABAG_DATA_TEST_STORE_' + i)
    }
  }

  my.table = {
    port: 4000,
    key: 'teabag_table_test_key',
    data_path: path.join(__dirname, 'TEABAG_DATA_TEST_TABLE')
  };

  async.series([
    function(cb_) {
      rimraf(my.table.data_path, function(err) {
        my.table.process = require('child_process').fork(path.join(__dirname, '../table/table.js'), [], {
          env: {
            'TEABAG_TABLE_KEY': my.table.key,
            'TEABAG_TABLE_PORT': my.table.port,
            'TEABAG_DATA': my.table.data_path
          },
          silent: true
        });
        my.procs.push(my.table.process);
        return cb_(err);
      });
    },
    function(cb_) {
      async.each(my.stores, function(s, cb_) {
        rimraf(s.data_path, function(err) {
          s.process = require('child_process').fork(path.join(__dirname, '../store/store.js'), [], {
            env: {
              'TEABAG_STORE_KEY': s.key,
              'TEABAG_STORE_PORT': s.port,
              'TEABAG_DATA': s.data_path
            },
            silent: true
          });
          my.procs.push(s.process);
          return cb_(err);
        });
      }, cb_);
    },
    function(cb_) {
      async.each(my.procs, function(p, cb_) {
        p.on('message', function(m) {
          if(m.type === 'listening') {
            p.port = m.port;
            return cb_();
          }
        });
      }, function(err) {
        return cb_(err);
      });
    },
    function(cb_) {
      async.parallel([
        function(cb_) {
          var t_url = 'http://localhost:' + my.table.port + '/admin/user/1/master/' + my.user.master;
          console.log('>>>> ' + t_url);
          request.put(t_url, {
            auth: {
              user: 'admin',
              pass: my.table.key
            }
          }, cb_);
        },
        function(cb_) {
          async.each(my.stores, function(s, cb_) {
            var s_url = 'http://localhost:' + s.port + '/admin/user/1';
            console.log('>>>> ' + s_url);
            request.put(s_url, {
              auth: {
                user: 'admin',
                pass: s.key
              }
            }, cb_);
          }, cb_);
        }
      ], cb_);
    },
    function(cb_) {
      async.each(my.stores, function(s, cb_) {
        request.get('http://localhost:' + s.port + '/admin/user/1/code', {
          auth: {
            user: 'admin',
            pass: s.key,
          },
          json: true
        }, function(err, res, body) {
          if(err) {
            return cb_(err);
          }
          s.code = body.code;
          return cb_();
        });
      }, cb_);
    },
    function(cb_) {
      async.each(my.stores, function(s, cb_) {
        var t_url = 'http://localhost:' + my.table.port + 
                    '/user/1/table/' + my.user.stream + '/store?master=' + my.user.master;
        console.log('>>>> ' + t_url);
        request.post(t_url, {
          json: {
            store_url: 'http://localhost:' + s.port + '/user/1/',
            code: s.code
          }
        }, cb_);
      }, cb_);
    }
  ], cb_);
};

exports.clusterGetToken = function(expiry, cb_) {
  var t_url = 'http://localhost:' + my.table.port + 
               '/user/1/token?master=' + my.user.master + '&expiry=' + expiry;
  console.log('>>>> ' + t_url);
  request.get(t_url, {
    json: true
  }, function(err, res, body) {
    if(err) {
      return cb_(err);
    }
    else if(body && body.token) {
      return cb_(null, body.token);
    }
    else {
      console.log(body);
      return cb_(new Error('Invalid Body'));
    }
  });
};

exports.clusterTearDown = function(cb_) {
  my.procs.forEach(function(p) {
    p.kill();
  });
  return cb_();
};
