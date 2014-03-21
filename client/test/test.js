var tb = require('../index.js').teabag({
  server: 'http://localhost:3999/user/1/',
  token: '1395337007694_1398015383938_d21bd569bea368c81e6393341686d8f0d5dc33af'
});

tb.init(function(err) {
  if(err) {
    console.log(err);
  }
});
