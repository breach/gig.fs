#!/usr/bin/env node
/*
 * TeaBag: table.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-07 spolu  Introduce `session_token`
 * - 2014-03-19 spolu  Renaming to `table`
 * - 2014-02-28 spolu  Separated srv/str keys
 * - 2014-02-28 spolu  Added `token/all' route
 * - 2014-02-19 spolu  Creation
 */
"use strict";

var express = require('express');
var util = require('util');
var fs = require('fs');
var http = require('http');
var common = require('../lib/common.js');

var app = express();
var access = require('../lib/access.js').access({});

var setup = function() {
  /* App Configuration */
  if(process.env['TEABAG_TABLE_KEY']) {
    common.KEY = process.env['TEABAG_TABLE_KEY'];
    common.log.out('[KEY]: ' + common.KEY);
  }

  app.configure(function() {
    app.use('/admin', express.basicAuth('admin', common.KEY)); 
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
  app.get( '/user/:user_id/session/new',                    require('./routes/session.js').get_session_new);
  app.get( '/user/:user_id/session/all',                    require('./routes/session.js').get_session_all);
  app.del( '/user/:user_id/session/:session_token',         require('./routes/session.js').del_session);
  app.get( '/user/:user_id/session/check/:session_token',   require('./routes/session.js').get_session_token_check);

  app.post('/user/:user_id/table/:channel/store',           require('./routes/table.js').post_channel_store);
  app.del( '/user/:user_id/table/:channel/store/:store_id', require('./routes/table.js').del_channel_store);
  app.del( '/user/:user_id/table/:channel',                 require('./routes/table.js').del_channel);
  app.get( '/user/:user_id/table',                          require('./routes/table.js').get_table);
  app.get( '/user/:user_id/table/:channel',                 require('./routes/table.js').get_channel);
  app.get( '/user/:user_id/table/check/:store_token',       require('./routes/table.js').get_store_token_check);
};


// INIT & START
common.log.out('teabag_table [Started]');

/* Setup */
setup();

common.PORT = process.env['TEABAG_TABLE_PORT'] ?
  parseInt(process.env['TEABAG_TABLE_PORT'], 10) : 0;

var http_srv = http.createServer(app).listen(common.PORT);
common.log.out('HTTP Server started on port: ' + common.PORT);

http_srv.on('listening', function() {
  common.PORT = http_srv.address().port;
  common.log.out('[TABLE_PORT]: ' + common.PORT);

  common.BASE_URL = process.env['TEABAG_TABLE_URL'] ? 
    process.env['TEABAG_TABLE_URL'] : 'http://localhost:' + common.PORT + '/'
  common.log.out('[TABLE_URL]: ' + common.BASE_URL);

  if(process.send) {
    process.send({ type: 'listening',
                   port: common.PORT });
  }
});

// SAFETY NET (kills the process and the spawns)
process.on('uncaughtException', function (err) {
  common.fatal(err);
});

