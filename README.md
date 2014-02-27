TeaBag
======

Centrally Orchestrated Multi Node Log-Based Storage with Distributed Conflict 
Resolution

TeaBag is a log-based multi node storage based on the principle of event
propagation and oplog pruning. Operations are pushed to the storage and conflict
resolution is delegated to the client. Conflict resolution is done by retrieving
the different log histories and replaying it a merged version.

Read are always first attempted local (delayed if the data was enver retrieved).
A central authority server serves as rendez-vous to retrieve the mount table and
the different nodes for each root path. 

Client library only stores data in memory. Tokens have an expiry date.

- Small amount of data. Holds in memory.
- Log based with history replay and distributed reconciliation
- Cache nodes [in-memory, disk] and Full nodes (read/write over net)
- Writes get commited on network but optimistically accepted. Disconnected OK.
- Notifications when pathes are modified (local and remote)
- Temporary keys `{ node, end_time, signature }`, Revocations

All calls to the nodes are trackable thanks to the token attached with it.

```
`teabag_srv`: TeaBag Server
-------------

user_id -> { 
  master,                                              // hash(user_id, pwd)
  channel -> [ { id, url } ],     
  [ tokens ]
};


/* ADMIN */

// master
PUT  /user/:user_id/master/:master                     // revoke all tokens

/* PUBLIC */

// token
GET  /user/:user_id/token
     master, expire, description
DEL  /user/:user_id/token/:token
     master
GET  /user/:user_id/token/:token/check

// table
POST /user/:user_id/table/:channel/store
     master
     { url, code }
DEL  /user/:user_id/table/:channel/store/:store_id
     master
GET  /user/:user_id/table/:channel/store/:store_id
     master
GET  /user/:user_id/table/:channel
     master
DEL  /user/:user_id/table/:channel
     master
GET  /user/:user_id/table
     master

Storage:
- user's master: $TEABAG_DATA/:salt/:user/user.json
- user's tokens: $TEABAG_DATA/:salt/:user/tokens.json
- user's table: $TEABAG_DATA/:salt/:user/table.json

```

```
`teabag_str`: TeaBag Store
-------------

user_id -> {
  { path, type } -> { initial, [ op ], final, sha },
  [ tokens ]
}
op := { payload, time }

BASE_URL = /user/:user_id

/* ADMIN */

// confirmation
PUT  /admin/user/:user_id
GET  /admin/user/:user_id/code

/* PUBLIC */

// confirmation
GET  {BASE_URL}/confirm
     code

// oplog
POST {BASE_URL}/oplog
     token
     { type, path, [ op, sha ], value }
GET  {BASE_URL}/oplog
     token, path, type
GET  {BASE_URL}/last                             // returns value & last
     token, path, type
DEL  {BASE_URL}/oplog
     token, path, type, before
GET  {BASE_URL}/oplog/stream
     token, path

Storage:
- user's meta:   $TEABAG_DATA/:salt/:user/user.json
- user's data:   $TEABAG_DATA/:salt/:user/root/:type/...[path]...

TODO: BLOB Storage
```

```
`teabag_cli`: TeaBag Client
-------------

var cli = teabag_cli({ token });

```
