var tb = require('../index.js').teabag({
  server: 'http://localhost:3999/user/1/',
  token: '1393843560045_1396521949271_58407c985cde6e5c0b7d039f7f137cbf4c68f383'
});

tb.init(function(err) {
  if(err) {
    console.log(err);
  }
});
