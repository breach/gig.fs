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
- Temporary keys { node, end_time, signature }, Revocations

All calls to the nodes are trackable thanks to the token attached with it.

```
teabag_srv:
-----------

user_id -> { 
  master_token,                   // hash(user_id, pwd)
  [ root -> [ str_host ] ],     
  [ tokens ]
};


/* ADMIN */

// master_token
PUT  /user/:user_id
PUT  /user/:user_id/master_token/:master_token         // revoke all tokens

/* PUBLIC */

// token
GET  /user/:user_id/token?master_token=X&end_date=Y    // broadcast token
DEL  /user/:user_id/token/:token?master_token=X        // broadcast revocation

// table
PUT  /user/:user_id/table/:channel/:str_host?master_token=X 
DEL  /user/:user_id/table/:channel/:str_host?master_token=X
DEL  /user/:user_id/table/:channel?master_token=X
GET  /user/:user_id/table?token=X

```

```
teabag_str:
-----------

user_id -> {
  [ path, type -> { initial, [ op ], final, sha } ],
  [ tokens ]
}
op := { payload, time }

DEL /user/:user_id/token                               // revokes all tokens
DEL /user/:user_id/token/:token

POST /user/:user_id/oplog?token=X&path=Y&type=Z { [ op, sha ], value }
GET  /user/:user_id/oplog?token=X&path=Y&type=Z
GET  /user/:user_id/last?token=X&path=Y&type=Z         // returns value & last
DEL  /user/:user_id/oplog?token=X&path=Y&type=Z&before=S
GET  /user/:user_id/oplog/stream?token=X&path=Y

```

```
teabag_cli:
-----------

var cli = teabag_cli({ token });

```
