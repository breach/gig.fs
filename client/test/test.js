var tb = require('../index.js').teabag({
  server: 'http://localhost:3999/user/1/',
  token: '1395337007694_1398015383938_d21bd569bea368c81e6393341686d8f0d5dc33af'
});
var common = require('../../lib/common.js');

tb.init(function(err) {
  if(err) {
    console.log(err);
    process.exit(1);
  }

  tb.register('test', function(oplog) {
    console.log('REDUCER:');
    console.log(JSON.stringify(oplog, null, 2));
    return 'foo ' + oplog.length;
  });

  console.log(tb.channels());

  console.log('GET:');
  tb.get('test', 'test', '/foo/bar', function(err, value) {
    if(err) {
      common.fatal(err);
    }
    console.log(value);
    console.log('PUSH:');
    tb.push('test', 'test', '/foo/bar', { foo: 'bar' }, function(err, value) {
      if(err) {
        common.fatal(err);
      }
      console.log('GET:');
      tb.get('test', 'test', '/foo/bar', function(err, value) {
        if(err) {
          common.fatal(err);
        }
        console.log(value);
      });
    });
  });
});
