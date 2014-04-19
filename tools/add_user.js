var request = require('request');
var async = require('async');

var table_port = process.env['TEABAG_TABLE_PORT'];
var store_port = process.env['TEABAG_STORE_PORT']

var table_url = process.env['TEABAG_STORE_URL'];
var store_url = process.env['TEABAG_STORE_URL'];

var table_key = process.env['TEABAG_TABLE_KEY'];
var store_key = process.env['TEABAG_STORE_KEY'];

var user_id = parseInt(process.argv[2], 10);
var master = process.argv[3];
var channel = process.argv[4];

if(!user_id || !master || channel) {
    console.log('Usage: node add_user.js {user_id} {master} {channel}');
      process.exit(1);
}

var store_code = '';

async.series([
  function(cb_) {
    var t_url = table_url + 'admin/user/' + user_id + '/master/' + master;
    console.log('>>>> PUT ' + t_url);
    request.put(t_url, {
      auth: {
        user: 'admin',
        pass: table_key
      }
    }, cb_);
  },
  function(cb_) {
    var s_url = store_url + 'admin/user/' + user_id;
    console.log('>>>> PUT ' + s_url);
    request.put(s_url, {
      auth: {
        user: 'admin',
        pass: store_key
      }
    }, cb_);
  },
  function(cb_) {
    var s_url = store_url + 'admin/user/' + user_id + '/code'
    console.log('>>>> GET ' + s_url);
    request.get('http://localhost:' + store.port + '/admin/user/' + my.user.id + '/code', {
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
    /*
    var t_url = table_url + 'table/' + my.user.channel + '/store?master=' + my.user.master;
    //console.log('>>>> ' + t_url);
    request.post(t_url, {
      json: {
        store_url: store.url,
        code: store.code
      }
    }, cb_);
    */
  }
