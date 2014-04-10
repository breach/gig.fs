#!/usr/bin/env node
/*
 * TeaBag: store.js
 *
 * Copyright (c) 2014, Stanislas Polu. All rights reserved.
 *
 * @author: spolu
 *
 * @log:
 * - 2014-04-07 spolu  Introduce `store_token`
 * - 2014-03-19 spolu  Renaming to `store`
 * - 2014-02-28 spolu  Separated srv/str keys
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
  if(process.env['TEABAG_STORE_KEY']) {
    common.KEY = process.env['TEABAG_STORE_KEY'];
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
  app.put( '/admin/user/:user_id',                            require('./routes/admin.js').put_user);
  app.get( '/admin/user/:user_id/code',                       require('./routes/admin.js').get_code);

  /* PUBLIC */
  app.post('/user/:user_id/confirm',                          require('./routes/user.js').post_confirm);

  app.del( '/user/:user_id/session/:store_token',             require('./routes/user.js').del_store_token);

  app.post('/user/:user_id/oplog',                            require('./routes/user.js').post_oplog);
  app.get( '/user/:user_id/oplog',                            require('./routes/user.js').get_oplog);
  app.get( '/user/:user_id/oplog/stream',                     require('./routes/user.js').get_oplog_stream);
};

// INIT & START
common.log.out('teabag_store [Started]');

/* Setup */
setup();

common.PORT = process.env['TEABAG_STORE_PORT'] ?
  parseInt(process.env['TEABAG_STORE_PORT'], 10) : 0;

var http_srv = http.createServer(app).listen(common.PORT);

http_srv.on('listening', function() {
  common.PORT = http_srv.address().port;
  common.log.out('[STORE_PORT]: ' + common.PORT);

  if(process.send) {
    process.send({ type: 'listening',
                   port: common.PORT });
  }
});


// SAFETY NET (kills the process and the spawns)
process.on('uncaughtException', function (err) {
  common.fatal(err);
});

