teabag
======

Centrally Orchestrated Multi Node Log-Based Storage with Distributed Conflict Resolution

Multi node storage with built-in conflict resolution and event propagation. 
Node values are computed on the log of mutations propagated across the network. 
Read are always local (delayed if the value was never found). 
A central authority serve as rendez-vous to retrieve the mount table for each a 
given path.

A user has a mount table which associates path to node lists. If the system is
accessed from an untrusted machine all operations should happen in memory.
Each machine 

- Small amount of data. Holds in memory.
- Log based with history replay and distributed reconciliation
- Cache nodes [in-memory, disk] and Full nodes (read/write over net)
- Writes get commited on network but optimistically accepted. Disconnected OK.
- Notifications when pathes are modified (local and remote)
- Temporary keys { node, end_time, signature }, Revocations

Log computation are based on simple functions that must be installed on the
full nodes. The nodes only accept the types of storage it knows of, that is, the
ones it has a conflict resolution function for.

All calls to the nodes are signed by the user and can be tracked.

```
teabag_srv:
-----------

user -> { 
  public_key, 
  [ path -> [ str_url ] ],
  [ token_revocations ]
};

GET  /public_key

POST /token                        # returns challenge
GET  /token/:challenge/:solution   # returns signed token to be signed

GET  /table/:token

POST /store
```

```
teabag_str:
-----------

user -> {
  public_key,
  [ path ],
  [ token_revocations ]
}
```

```
teabag_cli:
-----------

{
  public_key,
  token
}
```
