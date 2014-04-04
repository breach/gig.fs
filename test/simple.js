exports.setUp = function(cb_) {
  require('./cluster_setup.js').clusterSetUp(1, cb_);
};

exports.tearDown = function(cb_) {
  require('./cluster_setup.js').clusterTearDown(cb_);
};

exports.get_token = function(test) {
  var expiry = Date.now() + 1000 * 60 * 60 * 10;
  require('./cluster_setup.js').clusterGetToken(expiry, function(err, token) {
    test.equals(expiry, token.split('_')[1]);
    test.done();
  });
};
