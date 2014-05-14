GiG.fs
======

Centrally Orchestrated Multi Node Log-Based Storage with Distributed Conflict 
Resolution

GiG.fs is a log-based multi node storage based on the principle of operation
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

Session Tokens:
---------------

- Sessions are created on the table with a timeout
- `store_token` are sent to the stores and are generated by the table
- `store_token` are checked initially by the the store with table and inherit the
  parent `session_token` timeout
- Revoking the session on the table will revoke the `store_tokens` on each store
  as well.

Non-Connected Mode:
-------------------
GiG.fs is capable to operate without remote connection. This is done by
specifying a `local_table` that gets merged with any remote table found. GiG.fs
can entirely operate with solely the local table for fully local operations.
The local table specifies the channels where a local store may be participating
as well as attributes for these stores (`in_memory` or `local_path`);
```
local_table: {
  core: [
    { local_path: '/home/spolu/...' }
  ],
  modules: [
    { in_memory: true }
  ]
}
```


Conflict Resolution:
--------------------
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

GiG.fs Table
------------

```
user_id -> { 
  master,                                              // hash(user_id, pwd)
  channel -> [ { id, store_url } ],     
  [ tokens ]
};


/* ADMIN */

// master
PUT  /user/:user_id/master/:master                     // revoke all sessions

/* PUBLIC */

// sessions
GET  /user/:user_id/session/new
     master, timeout, description
GET  /user/:user_id/session/all
     master
DEL  /user/:user_id/session/:session_token              
GET  /user/:user_id/session/check/:session_token

// table
POST /user/:user_id/table/:channel/store
     master
     { store_url, code }
DEL  /user/:user_id/table/:channel/store/:store_id
     master
DEL  /user/:user_id/table/:channel
     master
GET  /user/:user_id/table
     master | session_token
GET  /user/:user_id/table/:channel
     master | session_token
GET  /user/:user_id/table/check/:store_token

Storage:
- user's master: $GIGFS_DATA/:salt/:user/user.json
- user's tokens: $GIGFS_DATA/:salt/:user/sessions.json
- user's table: $GIGFS_DATA/:salt/:user/table.json

```

GiG.fs Store
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

// store_token
DEL  {BASE_URL}/session/:store_token

// oplog
POST {BASE_URL}/oplog
     store_token, path, type
     { date, payload|value, sha }
GET  {BASE_URL}/oplog
     store_token, path, type
GET  {BASE_URL}/oplog/stream
     store_token, [reg_id]

Storage:
- user's meta:   $GIGFS_DATA/:salt/:user/user.json
- user's data:   $GIGFS_DATA/:salt/:user/root/:type/...[path]...

TODO: BLOB Storage
```

GiG.fs Client
-------------

```
var cli = require('gig.fs').gig({
  remote_table: {
    session_token: '...',
    
  session_token: '...',
  url: '...',
});

cli.init(cb_());
cli.register(type, reduce_fun);

cli.get(channel, type, path, cb_(err, value));
cli.push(channel, type, path, op, cb_(err, value));

cli.on(channel, type, path, cb_(type, value, [op]));

```
