#!/usr/bin/env node
/*
 * TeaBag: srv.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-02-19 spolu  Creation
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

  /* ADMIN */
  app.put( '/admin/user/:user_id/master/:master',           require('./routes/admin.js').put_master);

  /* PUBLIC (MASTER) */
  app.get( '/user/:user_id/token',                          require('./routes/token.js').get_token);
  app.del( '/user/:user_id/token/:token',                   require('./routes/token.js').del_token);
  app.get( '/user/:user_id/token/:token/check',             require('./routes/token.js').get_token_check);

  app.post('/user/:user_id/table/:channel/store',           require('./routes/table.js').post_channel_store);
  app.get( '/user/:user_id/table/:channel/store/:store_id', require('./routes/table.js').get_channel_store);
  app.del( '/user/:user_id/table/:channel/store/:store_id', require('./routes/table.js').del_channel_store);
  app.get( '/user/:user_id/table/:channel',                 require('./routes/table.js').get_channel);
  app.del( '/user/:user_id/table/:channel',                 require('./routes/table.js').del_channel);
  app.get( '/user/:user_id/table',                          require('./routes/table.js').get_table);
};


// INIT & START
common.log.out('TeaBag: teabag_srv [Started]');

/* Setup */
setup();
var http_srv = http.createServer(app).listen(3000);
common.log.out('HTTP Server started on port: 3000');

// SAFETY NET (kills the process and the spawns)
process.on('uncaughtException', function (err) {
  common.fatal(err);
});

