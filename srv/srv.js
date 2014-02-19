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

var setup = function() {
  /* App Configuration */
  app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    //app.use(factory.access().verify);

    app.use(app.router);

    //app.use(factory.access().error);
  });

  //
  // #### _JSON ROUTES_
  //

  /* ADMIN */
  app.put( '/user/:user_id',                             require('./routes/admin.js').put_user);
  app.put( '/user/:user_id/master_token/:master_token',  require('./routes/admin.js').put_master_token);

  /* PUBLIC */
  app.get( '/user/:user_id/token',                       require('./routes/token.js').get_token);
  app.del( '/user/:user_id/token/:token',                require('./routes/token.js').del_token);

  app.put( '/user/:user_id/table/:channel/:str_host',    require('./routes/table.js').put_channel_host);
  app.del( '/user/:user_id/table/:channel/:str_host',    require('./routes/table.js').del_channel_host);
  app.del( '/user/:user_id/table/:channel',              require('./routes/table.js').del_channel);
  app.get( '/user/:user_id/table/:channel',              require('./routes/table.js').get_channel);
  app.get( '/user/:user_id/table',                       require('./routes/table.js').get_table);
};


// Manager
var manager = require('./lib/manager.js').manager({});


// INIT & START
common.log.out('TeaBat: teabag_srv [Started]');

/* Setup */
setup();
var http_srv = http.createServer(app).listen(3000);
common.log.out('HTTP Server started on port: 3000');

// SAFETY NET (kills the process and the spawns)
process.on('uncaughtException', function (err) {
  common.fatal(err);
});

