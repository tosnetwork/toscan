# TOSCAN Production Operations

## Deployment topology

TOSCAN has four independently scalable layers:

1. one or more archival TOS nodes exposing read-only JSON-RPC behind a private network;
2. an explorer-only `tosctl explorer` source index with persistent SQLite storage;
3. the TOSCAN query service backed by PostgreSQL;
4. stateless Nginx/Vue gateways behind the public load balancer.

Only the gateway is public. It allowlists the exact node read methods and `/explorer/*` query paths used by the UI. The node's general JSON-RPC endpoint, `tosctld` authentication/operator routes, PostgreSQL and query-service metrics remain private.

Query-service replicas coordinate with a PostgreSQL advisory lease. Exactly one replica projects at a time; every replica can serve reads. A failed writer releases the lease with its database connection, so another replica resumes from the committed masterchain checkpoint. Each projection batch commits blocks, replacement deletions, transaction execution, message edges, changed asset-scan accounts and the checkpoint atomically.

## Configuration

Required production values:

- `DATABASE_URL`: TLS-enabled PostgreSQL connection string supplied by the secret manager;
- `TOS_RPC_UPSTREAM`: private read-only node REST origin;
- `TOS_SOURCE_EXPLORER`: private explorer-only `tosctld` origin;
- `TOS_SERVICE_UPSTREAM`: query-service origin used by the public gateway;
- `TOS_RPC_API_KEY`: node read key, held only by backend services and the gateway.
- `VITE_PUBLIC_ORIGIN`: canonical HTTPS public origin used at build time for metadata and sitemap output;
- `VITE_TOS_NETWORK`: explicit `mainnet` or `testnet` public network label;
- `VITE_ENABLE_PREVIEW=false`: required fail-closed production setting.

Capacity controls:

- `QUERY_PROJECT_BATCH` (default `64`): concurrent masterchain heights fetched during catch-up;
- `QUERY_DB_POOL_SIZE` (default `20`): PostgreSQL connections per query replica;
- `QUERY_POLL_MS` (default `1000`): delay between projection cycles;
- `QUERY_CONTRACT_SYNC_MS` (default `30000`): contract-state refresh interval;
- `QUERY_ASSET_SCAN_BATCH` (default `16`): changed accounts scanned for Jetton/NFT positions per cycle;
- `QUERY_READY_MAX_LAG` (default `2`): maximum masterchain lag accepted by readiness;
- `QUERY_READY_MAX_STALE_SECONDS` (default `30`): maximum age of the last healthy cycle;
- `TOS_RPC_TIMEOUT_MS` (default `15000`): individual node request timeout.

Tune projection concurrency against a replica/archive node rather than the validator's consensus-critical RPC capacity.

The same `QUERY_CONTRACT_SYNC_MS` interval refreshes Elector reward cycles and Nominator Pool state. A failed staking source refresh marks the projection source unhealthy, so readiness fails closed instead of serving a silently stale rewards page.

## Health and monitoring

- `/healthz` proves the query HTTP process is alive.
- `/readyz` requires PostgreSQL, a healthy source, a recent successful projection/observer cycle and lag within the configured threshold.
- `/metrics` exposes the node head, projected head, lag, projection cycles/errors, query request count and last successful projection time.
- request latency uses stable Fastify route templates rather than raw URLs, preventing an address/hash from creating an unbounded Prometheus label;
- projection-cycle duration exposes catch-up and source-refresh regressions without putting account identities in telemetry;
- `/explorer/status` adds durable block/transaction/contract/asset totals and per-shard heads for the product UI.
- `/explorer/staking` serves the last committed Elector/pool projection. Its `updated_at` is the evidence freshness boundary shown to clients.

Recommended alerts:

- `toscan_projection_errors_total` increases in two consecutive evaluation windows;
- `toscan_projection_last_success_unixtime` is older than 60 seconds;
- `toscan_projection_lag` grows for 10 minutes or exceeds the network's agreed freshness SLO;
- query `/readyz` has no healthy replica;
- PostgreSQL storage exceeds 75% or replication lag breaches the database SLO.

The repository includes a local production-equivalent observability overlay:

```bash
docker compose -f compose.yaml -f compose.monitoring.yaml up --build -d
```

Prometheus is bound to `127.0.0.1:19090` and Grafana to `127.0.0.1:13000` by default. Override `PROMETHEUS_PORT`, `GRAFANA_PORT`, `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`; never expose the local default password. The provisioned `TOSCAN / Projection and serving` dashboard covers lag, source health, cycle errors, projection duration and public query p95. Six checked alert rules cover missing telemetry, source failure, stale/lagging projection, repeated projection errors and high query latency.

Validate the configuration before deployment:

```bash
docker run --rm -v "$PWD/monitoring/prometheus:/etc/prometheus:ro" \
  --entrypoint promtool prom/prometheus:v3.5.0 check config /etc/prometheus/prometheus.yml
```

## Recovery

PostgreSQL is a rebuildable read projection. Back it up for fast recovery, but never treat it as ledger truth. If it is lost or corrupted:

1. point a clean query service at a fresh database;
2. let migrations create the schema;
3. project from genesis and monitor lag to zero;
4. switch public traffic only after recent transaction/block searches match the node.

The node-local `tosctl-indexer.db` is also rebuildable. Schema migrations that change canonical meaning intentionally clear chain-derived tables and checkpoints, then replay. Preserve the validator/archive database and genesis configuration; they are the recovery authority.

A confirmed masterchain root mismatch causes both index paths to discard chain-derived state and replay. Block replacement deletes transactions retired by the old block before the canonical identities are inserted.

Curated public address labels are operational metadata, not chain-derived state, and survive canonical reset/replay. Back up their reviewed manifest alongside the release. Import it transactionally with:

```bash
DATABASE_URL=postgresql://… pnpm labels:import ./labels.production.json
```

The manifest must be version 1. Each raw TOS address may appear once and includes `label`, `category`, `source`, optional HTTPS `source_url`, `verified`, and optional Unix `updated_at`. Validation rejects markup, control characters, duplicate addresses and non-HTTPS evidence links. Personal browser labels never enter PostgreSQL.

## Release gate

Before promotion:

```bash
pnpm check
pnpm test:e2e
NODE_ENV=production VITE_ENABLE_PREVIEW=false VITE_TOS_NETWORK=mainnet \
  VITE_PUBLIC_ORIGIN=https://explorer.example TOS_RPC_UPSTREAM=http://tos-rpc:8011 \
  TOS_SERVICE_UPSTREAM=http://query:8081 TOS_SOURCE_EXPLORER=http://tos-service:8080 \
  DATABASE_URL=postgresql://toscan:…@postgres:5432/toscan pnpm production:validate
QUERY_INTEGRATION_DATABASE_URL=postgresql://toscan:toscan-local-only@127.0.0.1:55432/toscan_test pnpm test:query:integration
QUERY_RECOVERY_DATABASE_URL=postgresql://toscan:toscan-local-only@127.0.0.1:55432/toscan_test pnpm test:query:recovery
QUERY_SCALE_DATABASE_URL=postgresql://toscan:toscan-local-only@127.0.0.1:55432/toscan_test QUERY_SCALE_ROWS=1000000 pnpm test:query:scale
docker compose build
TOSCAN_SMOKE_ORIGIN=https://explorer.example pnpm production:smoke
```

The scale gate inserts one million transactions, verifies thousands of unique keyset-paginated records while concurrent newer rows arrive, requires the intended index plan, and enforces a one-second local p95 budget. The recovery gate repeatedly closes and reopens the projection database, verifies canonical reset/replay and tests advisory-lease takeover. Treat both as release gates, not optional benchmarks.

The TOS repository must also pass `cargo test -p service` and `uv run python scripts/toscan-explorer-e2e.py`. TOSCAN CI invokes that native-chain gate with the browser hook, so validator → source index → PostgreSQL → gateway → browser is release-gated as one path.

Promote only when PostgreSQL projection lag reaches zero (or the explicitly approved deployment threshold) and search resolves a recent base64 node block hash, transaction hash and seeded contract address.

## Supply-chain release

Every pull request and main-branch change runs production dependency audit, filesystem scanning and both production-image scans. A version tag publishes `toscan` and `toscan-query` to GHCR with BuildKit SBOM/provenance, signs each immutable digest keylessly through GitHub OIDC, and publishes a GitHub build attestation. Promotion must use the signed digest, never a mutable tag alone.
