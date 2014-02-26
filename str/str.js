#!/usr/bin/env node
/*
 * TeaBag: srv.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-26 spolu  Creation
 */
var express = require('express');
var util = require('util');
var fs = require('fs');
var http = require('http');
var common = require('../lib/common.js');

var app = express();
var access = require('../lib/access.js').access({});

var setup = function() {
  /* App Configuration */
  app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(access.verify);
    app.use(app.router);
    app.use(access.error);
  });

  //
  // #### _JSON ROUTES_
  //
  app.get( '/user/:user_id/confirm',                          require('./routes/user.js').get_confirm);

  /*
  app.post('/user/:user_id/oplog',                            require('./routes/user.js').post_oplog);
  app.get( '/user/:user_id/oplog',                            require('./routes/user.js').get_oplog);
  app.del( '/user/:user_id/oplog',                            require('./routes/user.js').del_oplog);
  app.get( '/user/:user_id/oplog/stream',                     require('./routes/user.js').get_oplog_stream);
  */
};

// INIT & START
common.log.out('TeaBag: teabag_str [Started]');

/* Setup */
setup();
var http_srv = http.createServer(app).listen(3998);
common.log.out('HTTP Server started on port: 3998');

// SAFETY NET (kills the process and the spawns)
process.on('uncaughtException', function (err) {
  common.fatal(err);
});

