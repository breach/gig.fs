var request = require('request');
var async = require('async');

var table_port = process.env['TEABAG_TABLE_PORT'];
var store_port = process.env['TEABAG_STORE_PORT']

var table_url = process.env['TEABAG_TABLE_URL'];
var store_url = process.env['TEABAG_STORE_URL'];

var table_key = process.env['TEABAG_TABLE_KEY'];
var store_key = process.env['TEABAG_STORE_KEY'];

var user_id = parseInt(process.argv[2], 10);
var master = process.argv[3];
var channel = process.argv[4];

if(!user_id || !master || !channel) {
    console.log('Usage: node add_user.js {user_id} {master} {channel}');
      process.exit(1);
}

var store_code = '';

async.series([
  function(cb_) {
    var t_url = table_url + 'admin/user/' + user_id + '/master/' + master;
    console.log('>>>> PUT ' + t_url);
    console.log(table_key);
    request.put(t_url, {
      auth: {
        user: 'admin',
        pass: table_key
      },
      json: true
    }, function(err, res, json) {
      if(err) {
        return cb_(err);
      }
      if(!json || !json.ok) {
        return cb_(new Error(t_url));
      }
      return cb_();
    });
  },
  function(cb_) {
    var s_url = store_url + 'admin/user/' + user_id;
    console.log('>>>> PUT ' + s_url);
    request.put(s_url, {
      auth: {
        user: 'admin',
        pass: store_key
      },
      json: true
    }, function(err, res, json) {
      if(err) {
        return cb_(err);
      }
      if(!json || !json.ok) {
        return cb_(new Error(s_url));
      }
      return cb_();
    });
  },
  function(cb_) {
    var s_url = store_url + 'admin/user/' + user_id + '/code'
    console.log('>>>> GET ' + s_url);
    request.get(s_url, {
      auth: {
        user: 'admin',
        pass: store_key,
      },
      json: true
    }, function(err, res, body) {
      if(err) {
        return cb_(err);
      }
      store_code = body.code;
      return cb_();
    });
  },
  function(cb_) {
    var t_url = table_url + 'user/' + user_id + '/table/' + channel + '/store?master=' + master;
    console.log('>>>> POST ' + t_url);
    console.log(store_url + 'user/' + user_id + '/');
    console.log(store_code);
    request.post(t_url, {
      json: {
        store_url: store_url + 'user/' + user_id + '/',
        code: store_code
      }
    }, function(err, res, json) {
      if(err) {
        return cb_(err);
      }
      if(!json || !json.store_id) {
        console.log(json);
        return cb_(new Error(t_url));
      }
      return cb_();
    });
  }
], function(err) {
  if(err) {
    console.log(err);
    process.exit(1);
  }
  console.log('TABLE_URL: ' + table_url + 'user/' + user_id);
  console.log('MASTER: ' + master);
  console.log('CHANNEL: ' + channel);
  process.exit(0);
});
