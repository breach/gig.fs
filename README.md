TeaBag
======

Centrally Orchestrated Multi Node Log-Based Storage with Distributed Conflict 
Resolution

TeaBag is a log-based multi node storage based on the principle of operation
propagation and oplog pruning. Operations are pushed to the storage and conflict
resolution is delegated to the client. Conflict resolution is done by retrieving
the different operation logs and replaying them in a merged version.

Read are always first attempted locally (delayed if the data was never retrieved 
yet). A central authority server serves as rendez-vous to retrieve the mount 
table, that is, the different nodes for each root path, called `channels`.

The client library only stores data in memory. Tokens have an expiry date. The
entire system operates on the following asumptions:

- Small amount of data. Holds in memory.
- Log based with history replay and distributed reconciliation
- Client nodes store data in memory
- Writes get commited on network but optimistically accepted. Disconnected OK.
- Notifications when pathes are modified (local and remote)
- Temporary keys `{ node, end_time, signature }`

All calls to the nodes are trackable thanks to the token attached to them.

OPLOG Structure:
----------------
The oplog is an array of operations with the following structure:
```
{ 
  date: 12312...
  sha: a2ef...
  payload: { ... }
}

{ 
  date: 12312...
  sha: a2ef...
  value: { ... }
}
```
The `payload` is defined by the user and an operation is always associated with
a type. The user provides reducers per type she uses.

Operations with a `value` field (called `values`) are used to allow the pruning
of the oplog. Whenever a value is encoutered, history before that value is
ignored by the conflict resolution algorithm.

An oplog is initialized with a value equal to `null`. 

The oplog is automatically pruned by inserting `values` into it whenever a
client considers that all the stores it knows of are in sync. Inserting a value
may fail on some stores, but it will eventually get propagated later on by other
clients to all of the stores upon reconnect.

Finally, stores stream operations they accept so that clients can stay up to
date, so that most oplog read happen locally.

Conflicts Resolution:
---------------------
```
READ PATH:

On each store, Read oplog if not already in memory
When first oplog received
Reduce current value and return
Store in memory all other oplogs and register to stream
Attempt syncing and pruning

WRITE PATH:

On each store, read and then insert op in oplog locally, recompute value
push op to store
Attempt syncing and pruning

SYNCING & PRUNING:

On each store, read oplog
Compare each store oplogs
If discrepancies, push ops to oplogs unaware of them
Otherwise push a new value to all oplogs for pruning

```

TeaBag Table
------------

```
user_id -> { 
  master,                                              // hash(user_id, pwd)
  channel -> [ { id, store_url } ],     
  [ tokens ]
};


/* ADMIN */

// master
PUT  /user/:user_id/master/:master                     // revoke all tokens

/* PUBLIC */

// token
GET  /user/:user_id/token
     master, expiry, description
GET  /user/:user_id/token/all
DEL  /user/:user_id/token/:token
GET  /user/:user_id/token/:token/check

// table
POST /user/:user_id/table/:channel/store
     master
     { store_url, code }
DEL  /user/:user_id/table/:channel/store/:store_id
     master
DEL  /user/:user_id/table/:channel
     master
GET  /user/:user_id/table
     master | token
GET  /user/:user_id/table/:channel
     master | token

Storage:
- user's master: $TEABAG_DATA/:salt/:user/user.json
- user's tokens: $TEABAG_DATA/:salt/:user/tokens.json
- user's table: $TEABAG_DATA/:salt/:user/table.json

```

TeaBag Store
------------

```
user_id -> {
  table: { id, table_url }, 
  { path, type } -> { [ op ] },
}
op := { date, sha, payload }

BASE_URL = /user/:user_id

/* ADMIN */

// confirmation
PUT  /admin/user/:user_id
GET  /admin/user/:user_id/code

/* PUBLIC */

// table confirmation
POST {BASE_URL}/confirm
     { table_url, code }

// oplog
POST {BASE_URL}/oplog
     token, path, type
     { date, sha, payload|value }
GET  {BASE_URL}/oplog
     token, path, type

GET  {BASE_URL}/oplog/stream
     token

Storage:
- user's meta:   $TEABAG_DATA/:salt/:user/user.json
- user's data:   $TEABAG_DATA/:salt/:user/root/:type/...[path]...

TODO: BLOB Storage
```

TeaBag Client
-------------

```
var cli = require('teabag').teabag({
  token: '...',
  url: '...'
});

cli.init(cb_());
cli.register(type, reduce_fun);

cli.get(channel, type, path, cb_(err, value));
cli.push(channel, type, path, op, cb_(err, value));

cli.on(channel, type, path, cb_(type, value, [op]));

```
