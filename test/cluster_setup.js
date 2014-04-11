
var async = require('async');
var path = require('path');
var request = require('request');
var rimraf = require('rimraf');

var my = {
  user: {
    id: 1,
    master: 'foobar',
    channel: 'test'
  },
  store_count: 0,
  table: {},
  stores: [],
  procs: []
};

exports.internal = function() {
  return my;
};

exports.table_setup = function(silent, cb_) {
  my.table = {
    url: 'http://localhost:4000/user/' + my.user.id + '/',
    port: 4000,
    key: 'gig_table_test_key',
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
          silent: silent
        });
        my.procs.push(my.table.process);
        return cb_(err);
      });
    },
    function(cb_) {
      my.table.process.on('message', function(m) {
        if(m.type === 'listening') {
          return cb_();
        }
      });
    },
    function(cb_) {
      var t_url = 'http://localhost:' + my.table.port + '/admin/user/' + 
                  my.user.id + '/master/' + my.user.master;
      //console.log('>>>> ' + t_url);
      request.put(t_url, {
        auth: {
          user: 'admin',
          pass: my.table.key
        }
      }, cb_);
    }
  ], function(err) {
    return cb_(err, my.table);
  });
};


exports.table_session = function(timeout, cb_) {
  var t_url = my.table.url + 'session/new?master=' + my.user.master + '&timeout=' + timeout;
  //console.log('>>>> ' + t_url);
  request.get(t_url, {
    json: true
  }, function(err, res, body) {
    if(err) {
      return cb_(err);
    }
    else if(body && body.session_token) {
      return cb_(null, body);
    }
    else {
      console.log(body);
      return cb_(new Error('Invalid Body'));
    }
  });
};

exports.table_table = function(session_token, cb_) {
  var t_url = my.table.url + 'table?session_token=' + session_token;
  //console.log('>>>> ' + t_url);
  request.get(t_url, {
    json: true
  }, function(err, res, body) {
    if(err) {
      return cb_(err);
    }
    else if(body && !body.error) {
      return cb_(null, body);
    }
    else {
      console.log(body);
      return cb_(new Error('Invalid Body'));
    }
  });
};


exports.store_setup = function(silent, cb_) {
  var store = {
    url: 'http://localhost:' + (4001 + my.store_count) + '/user/' + my.user.id + '/',
    port: 4001 + my.store_count,
    key: 'gig_store_test_key_' + my.store_count,
    data_path: path.join(__dirname, 'TEABAG_DATA_TEST_STORE_' + my.store_count),
    index: my.store_count
  };
  
  async.series([
    function(cb_) {
      rimraf(store.data_path, function(err) {
        store.process = require('child_process').fork(path.join(__dirname, '../store/store.js'), [], {
          env: {
            'TEABAG_STORE_KEY': store.key,
            'TEABAG_STORE_PORT': store.port,
            'TEABAG_DATA': store.data_path
          },
          silent: silent
        });
        return cb_(err);
      });
    },
    function(cb_) {
      store.process.on('message', function(m) {
        if(m.type === 'listening') {
          return cb_();
        }
      });
    },
    function(cb_) {
      var s_url = 'http://localhost:' + store.port + '/admin/user/' + my.user.id;
      //console.log('>>>> ' + s_url);
      request.put(s_url, {
        auth: {
          user: 'admin',
          pass: store.key
        }
      }, cb_);
    },
    function(cb_) {
      request.get('http://localhost:' + store.port + '/admin/user/' + my.user.id + '/code', {
        auth: {
          user: 'admin',
          pass: store.key,
        },
        json: true
      }, function(err, res, body) {
        if(err) {
          return cb_(err);
        }
        store.code = body.code;
        return cb_();
      });
    },
    function(cb_) {
      var t_url = my.table.url + 'table/' + my.user.channel + '/store?master=' + my.user.master;
      //console.log('>>>> ' + t_url);
      request.post(t_url, {
        json: {
          store_url: store.url,
          code: store.code
        }
      }, cb_);
    }
  ], function(err) {
    if(err) {
      return cb_(err);
    }
    my.stores[store.index] = store;
    my.procs.push(store.process);
    return cb_(null, store);
  });
};


exports.tear_down = function(cb_) {
  my.procs.forEach(function(p) {
    p.kill();
  });
  return cb_();
};


