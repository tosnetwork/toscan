# TOSCAN

TOSCAN is the official read-only explorer for TOS Network. It combines node-authoritative block, account and token state with a durable `tosctld` discovery index, so people can follow both ordinary chain activity and the contracts that make TOS an agent economy.

The application is an original Vue 3 implementation designed specifically for TOS Network. Its information architecture, components, typography and artwork are maintained as an independent TOS ecosystem product.

## Product coverage

| Area | Routes | Coverage |
| --- | --- | --- |
| Overview and search | `/`, `/search` | Chain tip, recent activity, exact transaction/block hash and evidence-backed public-label search, address routing, Agent/Task/Service summaries |
| Blocks | `/blocks`, `/block/:workchain/:shard/:seqno` | Chain-wide indexed pagination, canonical hashes and time, headers, logical-time range, complete paginated transactions |
| Transactions and messages | `/transactions`, `/tx/:account/:lt/:hash`, `/message/:hash` | Chain-wide keyset pagination, compute/action outcomes and message causality |
| Accounts | `/address/:address` | Balance, complete indexed transaction history, wallet events, Jetton/NFT ownership, programmable authority, evidence-backed public labels and browser-private personal labels |
| Assets | `/assets`, `/token/:address` | Position-backed Jetton/NFT discovery, observed holders, node-authoritative getters and safe metadata display |
| Agent economy | `/economy`, `/agents`, `/agent/:address`, `/tasks`, `/task/:address`, `/disputes`, `/dispute/:address`, `/services`, `/service/:address` | Market totals, lifecycle distribution, chain-wide discovery, policy boundaries, evidence and rulings |
| Consensus, staking and governance | `/network`, `/validators`, `/validator/:publicKey`, `/staking`, `/staking/pool/:address`, `/governance` | Health, proof-decoded validator membership and selection history, realized Elector reward cycles, pool stake/member history, code-verified Nominator Pools, observed signatures and configuration cells |
| Analytics and exports | `/analytics` plus list-page CSV actions | Chain-derived 24-hour/7-day/30-day/90-day activity series and auditable CSV exports of the currently loaded evidence window |

All durable list pages use versioned opaque keyset cursors, so concurrent new blocks do not duplicate or skip older rows while a user paginates. Time-sensitive pages poll while visible and pause in background tabs. The interface ships English, Simplified Chinese and Japanese navigation/core journeys, responsive desktop/mobile layouts and accessible SVG charts. Preview data is permitted only when explicitly enabled and is always identified by a persistent banner.

## Architecture

```text
Browser
  ├─ /tos-rpc/<allowlisted-read-method> ──► TOS node JSON-RPC REST adapter
  └─ /tos-service-api/explorer/* ─────────► PostgreSQL query projection
                                                ▲
                                                │ parallel canonical projection
                                            TOS node + tosctld source index
```

The TOS node remains authoritative for complete block headers, transaction bodies, account state, capability state and token getters. A node-local SQLite `tosctld` index is the deterministic recovery source. The production query service projects that source and canonical node history into PostgreSQL for horizontally scalable public search and pagination; losing PostgreSQL does not lose chain truth.

The indexer:

- advances on the masterchain timeline and indexes the exact shard heads referenced by each masterchain block, including shards created by split/merge at a non-zero height;
- stores every block and transaction identity, full unsigned 64-bit logical times, execution phases, fees and inbound/outbound message edges;
- classifies Agent Account, Task Escrow, Dispute, Service Actor, Capability Registry, AIPoW and Nominator Pool contracts by code hash;
- discovers Jetton/NFT contracts from node-verified account positions and maintains owner-to-asset edges without trusting metadata;
- detects a canonical masterchain root change and rebuilds chain-derived state from genesis;
- exposes only public, read-only `/explorer/*` routes to TOSCAN;
- reports the node head, indexed head and lag for operational visibility.

The source index's canonical replay and the query service's ordered PostgreSQL migrations are independently versioned. PostgreSQL migration version 6 covers messages/execution, asset discovery, matched-build attestations, staking reward/pool history, validator-set snapshots and curated address labels; startup refuses a database created by a newer unsupported service.

## Local development

Requirements: Node.js 20+ and pnpm 9.15+.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open `http://localhost:4173`. Vite proxies `/jsonRPC` to the node at `127.0.0.1:8011` and `/tos-service-api` to `tosctld` at `127.0.0.1:8080` by default. Override the non-browser `TOS_RPC_PROXY_TARGET` and `TOS_SERVICE_PROXY_TARGET` variables when necessary.

`VITE_ENABLE_PREVIEW=true` provides a clearly labelled design/demo fallback when a local backend is absent. Production builds disable it.

For the complete persistent development chain (native validator, explorer-only `tosctld`, PostgreSQL projection, five real Agent Economy contracts, a real Nominator Pool and the production-style Vue gateway), place the TOS and TOSCAN repositories next to each other and run:

```bash
pnpm stack:up
pnpm stack:status
# data survives this stop/start cycle
pnpm stack:stop
pnpm stack:up --no-seed
```

`pnpm stack:seed` is idempotent. `pnpm stack:reset` is the explicit destructive reset. Native state/logs live under `.local/stack`; PostgreSQL and gateway state use the named Compose volume and containers. Both stores survive `stack:stop`.

## Production container

The production Compose stack builds the UI gateway and PostgreSQL query service, provisions PostgreSQL with a persistent volume, and starts health-gated dependencies:

```bash
docker compose up --build -d
curl --fail http://localhost:4173/healthz
```

Configure these server-side values in the deployment environment:

- `TOS_RPC_UPSTREAM` — node HTTP origin, for example `http://tos-node:8011`;
- `TOS_RPC_API_KEY` — optional node API key, injected by the proxy and never shipped to the browser;
- `TOS_SOURCE_EXPLORER` — the explorer-only `tosctld` recovery/source API;
- `DATABASE_URL` (or the Compose `POSTGRES_*` values) — shared PostgreSQL projection store;
- `TOS_SERVICE_UPSTREAM` — optional gateway override; Compose routes it to the query service;
- `QUERY_PROJECT_BATCH` — number of masterchain blocks fetched concurrently per catch-up cycle;
- `QUERY_READY_MAX_LAG` / `QUERY_READY_MAX_STALE_SECONDS` — fail-closed serving thresholds;
- `QUERY_ASSET_SCAN_BATCH` — changed accounts inspected for verified asset positions per cycle;
- `VITE_TOS_NETWORK` — build-time public network label.

Terminate TLS at the ingress/load balancer. The container exposes port `8080`, includes `/healthz`, immutable asset caching, SPA routing, request-size/time limits and security headers.

The gateway does **not** proxy the node's general `/jsonRPC` endpoint. It exposes exact POST REST paths for only the read methods TOSCAN uses. Transaction submission, delegation/session/agent mutation and every `tosctld` operator route remain unreachable from the public explorer origin.

The query service exposes `/healthz`, a projection-aware `/readyz`, and Prometheus `/metrics`. Readiness fails closed before the first cycle, while the source is unhealthy, when projection is stale, or when lag exceeds the configured SLO. Metrics include bounded route-template request latency, projection-cycle duration, lag and source health. The optional monitoring overlay provisions Prometheus alerts and a Grafana dashboard with `docker compose -f compose.yaml -f compose.monitoring.yaml up --build -d`. Canonical replacement, transactions, messages and checkpoint updates commit atomically; a confirmed masterchain reorg resets and replays the recoverable projection.

Matched contract builds are imported offline with `pnpm verification:import <manifest.json>`. The importer reads deployed code from the node and records an attestation only when the manifest's code BOC is byte-for-byte identical. The public explorer exposes read-only results and has no verification upload endpoint.

Curated public address labels are also an offline, reviewed data product: `DATABASE_URL=… pnpm labels:import <manifest.json>`. Every record names its evidence source and optional HTTPS source URL. Personal labels never enter TOSCAN servers; they remain in the current browser's local storage.

See [Production Operations](docs/OPERATIONS.md) for topology, scaling, alerts, backups and recovery, [P1/P2 Production Readiness](docs/PRODUCTION_READINESS.md) for the release acceptance matrix, and [Staking Data Provenance](docs/STAKING_DATA_PROVENANCE.md) for the staking research and TOS evidence model.

## Data contracts

Node reads include:

- blocks: `getMasterchainInfo`, `lookupBlock`, `getBlockHeader`, `getBlockTransactions`, `getBlockTransactionsExt`;
- transactions/accounts: `getTransactions`, `getAddressInformation`;
- authority: `getAccountCapability`, `getAccountAgents`;
- wallet index: `getAccountEvents`, `getAccountJettons`, `getAccountNfts`;
- tokens: `getTokenData`;
- finality and governance: `getConsensusBlock`, `getMasterchainBlockSignatures`, `getConfigParam`.

Public `tosctld` reads include:

- `/explorer/status`;
- `/explorer/blocks`, `/explorer/block`;
- `/explorer/transactions`, `/explorer/transaction`;
- `/explorer/message`, `/explorer/assets`, `/explorer/assets/{address}`;
- `/explorer/economy`, `/explorer/verifications/{address}`;
- `/explorer/staking` (Elector election/reward state plus code-verified Nominator Pool totals);
- `/explorer/staking/pools/{address}` (retained on-chain pool observations and current members);
- `/explorer/validators`, `/explorer/validators/{publicKey}` (proof-decoded validator set history and observed proof signatures);
- `/explorer/analytics?window=24h|7d|30d|90d` (chain-derived activity buckets);
- `/explorer/labels/{address}` (reviewed public address-label evidence);
- `/explorer/contracts/{kind}`, `/explorer/contracts/{kind}/{address}`;
- `/explorer/search`.

Page components depend only on normalized models in `src/api/`; transport and chain DTO differences stay inside the adapter.

## Evidence boundaries

1. The index is complete only after every shard checkpoint reaches its reported head. TOSCAN displays this lag instead of claiming completeness early.
2. Validator membership/weight comes from proof-extracted configuration parameter #34. Proof-link signer counts are separate finalized evidence, not live catchain/gossip telemetry.
3. Token metadata is untrusted contract data. Remote image references are shown as text and are not automatically loaded.
4. An observed asset holder is a node-verified position, not a balance claim; live balances remain contract-getter data.
5. A “Build matched” badge proves deployed code BOC equality with the submitted build artifact. Source reproducibility still depends on the displayed compiler, commit, digest and build instructions.
6. Off-chain AI execution is not inferred from a contract status. TOSCAN distinguishes chain-enforced commercial state from optional evidence or attestation commitments.
7. Staking APR/APY is an annualization of rewards already recorded by Elector. It is historical evidence, not a promised future return. Pool contracts enter the view only after their deployed code hash matches the canonical TOS Nominator Pool code.
8. Validator-set membership, weight and observed proof signatures are attributable to a validator public key. Individual validator rewards are not exposed until the chain supplies equally attributable evidence; TOSCAN does not divide aggregate rewards by weight and present that estimate as fact.
9. CSV export contains only the currently loaded evidence window and names the export time; it is not silently presented as an all-history dump.
10. TOSCAN is read-only. It deliberately contains no wallet connection, signing or transaction-submission path.

## Quality gates

```bash
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
QUERY_INTEGRATION_DATABASE_URL=postgresql://… pnpm test:query:recovery
QUERY_INTEGRATION_DATABASE_URL=postgresql://… pnpm test:query:scale
docker build -t toscan:verify .
docker build -f Dockerfile.query -t toscan-query:verify .
```

CI enforces linting, TypeScript checks, unit tests, ordered PostgreSQL migration/integration tests, deterministic reopen/failover recovery, a one-million-transaction keyset/latency gate, the production build, desktop/mobile browser journeys, serious/critical accessibility checks and production container builds. Separate security gates reject high-severity production dependency advisories, generate a CycloneDX SBOM and scan the filesystem and both images. Tagged releases publish provenance-bearing images, sign their immutable digests with GitHub OIDC and attach GitHub build attestations.

The real-chain browser gate builds and boots a native validator, deploys all five Agent Economy contracts and a funded Nominator Pool, catches PostgreSQL up to zero lag, then drives the Vue UI through execution, message paths, economy, validators and staking with preview disabled. The TOS data-path gate also verifies route isolation, decoded validator configuration, Elector reward delivery, code-hash pool discovery and durable explorer restart recovery.

The interface includes a skip link, semantic navigation and tables, keyboard search (`/`), visible focus states, responsive layouts, reduced-motion handling and persistent light/dark/system themes.

## License

TOSCAN uses the same license as TOS: GNU General Public License v3.0 or later. See [LICENSE](./LICENSE).
