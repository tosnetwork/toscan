# TOSCAN Production Operations

## Deployment topology

TOSCAN has four independently scalable layers:

1. one or more archival TOS nodes exposing read-only JSON-RPC behind a private network;
2. an explorer-only `tosctl explorer` source index with persistent SQLite storage;
3. the TOSCAN query service backed by PostgreSQL;
4. stateless Nginx/Vue gateways behind the public load balancer.

Only the gateway is public. It allowlists the exact node read methods and `/explorer/*` query paths used by the UI. The node's general JSON-RPC endpoint, `tosctld` authentication/operator routes, PostgreSQL and query-service metrics remain private.

Query-service replicas coordinate with a PostgreSQL advisory lease. Exactly one replica projects at a time; every replica can serve reads. A failed writer releases the lease with its database connection, so another replica resumes from the committed masterchain checkpoint. Each projection batch commits blocks, replacement deletions, rich transaction summaries and the checkpoint atomically.

## Configuration

Required production values:

- `DATABASE_URL`: TLS-enabled PostgreSQL connection string supplied by the secret manager;
- `TOS_RPC_UPSTREAM`: private read-only node REST origin;
- `TOS_SOURCE_EXPLORER`: private explorer-only `tosctld` origin;
- `TOS_SERVICE_UPSTREAM`: query-service origin used by the public gateway;
- `TOS_RPC_API_KEY`: node read key, held only by backend services and the gateway.

Capacity controls:

- `QUERY_PROJECT_BATCH` (default `64`): concurrent masterchain heights fetched during catch-up;
- `QUERY_DB_POOL_SIZE` (default `20`): PostgreSQL connections per query replica;
- `QUERY_POLL_MS` (default `1000`): delay between projection cycles;
- `QUERY_CONTRACT_SYNC_MS` (default `30000`): contract-state refresh interval;
- `TOS_RPC_TIMEOUT_MS` (default `15000`): individual node request timeout.

Tune projection concurrency against a replica/archive node rather than the validator's consensus-critical RPC capacity.

## Health and monitoring

- `/healthz` proves the query HTTP process is alive.
- `/readyz` requires PostgreSQL and at least one successful projection/observer cycle.
- `/metrics` exposes the node head, projected head, lag, projection cycles/errors, query request count and last successful projection time.
- `/explorer/status` adds durable block/transaction/contract totals and per-shard heads for the product UI.

Recommended alerts:

- `toscan_projection_errors_total` increases in two consecutive evaluation windows;
- `toscan_projection_last_success_unixtime` is older than 60 seconds;
- `toscan_projection_lag` grows for 10 minutes or exceeds the network's agreed freshness SLO;
- query `/readyz` has no healthy replica;
- PostgreSQL storage exceeds 75% or replication lag breaches the database SLO.

## Recovery

PostgreSQL is a rebuildable read projection. Back it up for fast recovery, but never treat it as ledger truth. If it is lost or corrupted:

1. point a clean query service at a fresh database;
2. let migrations create the schema;
3. project from genesis and monitor lag to zero;
4. switch public traffic only after recent transaction/block searches match the node.

The node-local `tosctl-indexer.db` is also rebuildable. Schema migrations that change canonical meaning intentionally clear chain-derived tables and checkpoints, then replay. Preserve the validator/archive database and genesis configuration; they are the recovery authority.

A confirmed masterchain root mismatch causes both index paths to discard chain-derived state and replay. Block replacement deletes transactions retired by the old block before the canonical identities are inserted.

## Release gate

Before promotion:

```bash
pnpm check
pnpm test:e2e
QUERY_INTEGRATION_DATABASE_URL=postgresql://toscan:toscan-local-only@127.0.0.1:55432/toscan_test pnpm test:query:integration
docker compose build
```

The TOS repository must also pass `cargo test -p service` and `uv run python scripts/toscan-explorer-e2e.py`. The latter boots a native chain, deploys all five Agent Economy contract classes, verifies route isolation and rich transaction messages, then restarts the explorer and checks durable recovery.

Promote only when PostgreSQL projection lag reaches zero (or the explicitly approved deployment threshold) and search resolves a recent base64 node block hash, transaction hash and seeded contract address.
