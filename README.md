# TOSCAN

TOSCAN is the official read-only explorer for TOS Network. It combines node-authoritative block, account and token state with a durable `tosctld` discovery index, so people can follow both ordinary chain activity and the contracts that make TOS an agent economy.

The application is an original Vue 3 implementation designed specifically for TOS Network. Its information architecture, components, typography and artwork are maintained as an independent TOS ecosystem product.

## Product coverage

| Area | Routes | Coverage |
| --- | --- | --- |
| Overview and search | `/`, `/search` | Chain tip, recent activity, keyboard-first typed suggestions, recent browser-local searches, exact canonical resolution and evidence-backed public-label search |
| Blocks | `/blocks`, `/block/:workchain/:shard/:seqno` | Chain-wide indexed pagination, canonical hashes and time, headers, logical-time range, complete paginated transactions |
| Transactions and messages | `/transactions`, `/tx/:account/:lt/:hash`, `/message/:hash` | Chain-wide keyset pagination, compute/action outcomes and message causality |
| Accounts | `/address/:address` | Balance, complete indexed transaction history, wallet events, Jetton/NFT ownership, programmable authority, evidence-backed public labels and browser-private personal labels |
| Assets | `/assets`, `/assets/activity`, `/token/:address` | Position-backed Jetton/NFT discovery, paginated holders and collection items, durable ownership observations, node-authoritative getters and safe metadata display |
| Agent economy | `/economy`, `/agents`, `/agent/:address`, `/tasks`, `/task/:address`, `/disputes`, `/dispute/:address`, `/services`, `/service/:address` | Market totals, lifecycle distribution, chain-wide discovery, policy boundaries, evidence and rulings |
| Consensus, staking and governance | `/network`, `/validators`, `/validator/:publicKey`, `/staking`, `/staking/pool/:address`, `/governance` | Health, current/next proof-decoded validator sets, round progress, searchable/sortable/exportable weight directory, validator selection history, realized Elector reward cycles, pool stake/member history, code-verified Nominator Pools, observed signatures and retained configuration history |
| Analytics and exports | `/analytics` plus list-page CSV actions | Chain-derived 24-hour/7-day/30-day/90-day activity series and auditable CSV exports of the currently loaded evidence window |
| Contract evidence | `/contracts/verified`, `/contracts/verified/:address` | Directory and detail pages for offline-imported, byte-identical deployed-code build attestations |
| Personal and developer tools | `/watchlist`, `/api-docs`, `/diagnostics` | Browser-local evidence-change watchlist, OpenAPI 3.1 read API reference and private client error/performance diagnostics |

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
- discovers Jetton/NFT contracts from node-verified account positions, maintains owner-to-asset edges and retains appearance/removal observations without mislabelling them as decoded transfers;
- snapshots proof-backed configuration cells so governance changes can be compared without inventing authors or votes;
- detects a canonical masterchain root change and rebuilds chain-derived state from genesis;
- exposes only public, read-only `/explorer/*` routes to TOSCAN;
- reports the node head, indexed head and lag for operational visibility.

The source index's canonical replay and the query service's ordered PostgreSQL migrations are independently versioned. PostgreSQL migration version 7 adds asset-position events and governance snapshots to messages/execution, asset discovery, matched-build attestations, staking reward/pool history, validator-set snapshots and curated address labels; startup refuses a database created by a newer unsupported service.

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
- `VITE_PUBLIC_ORIGIN` — canonical HTTPS public origin used for share metadata and the generated sitemap.

Run `pnpm production:validate` against the release environment before building. It rejects preview mode, development hosts, a non-HTTPS public origin and known development database credentials. After deployment, run `TOSCAN_SMOKE_ORIGIN=https://… pnpm production:smoke`. The container exposes port `8080`, includes `/healthz`, immutable asset caching, SPA routing, request-size/time limits and security headers.

The gateway does **not** proxy the node's general `/jsonRPC` endpoint. It exposes exact POST REST paths for only the read methods TOSCAN uses. Transaction submission, delegation/session/agent mutation and every `tosctld` operator route remain unreachable from the public explorer origin.

The query service exposes `/healthz`, a projection-aware `/readyz`, and Prometheus `/metrics`. Readiness fails closed before the first cycle, while the source is unhealthy, when projection is stale, or when lag exceeds the configured SLO. Metrics include bounded route-template request latency, projection-cycle duration, lag and source health. The optional monitoring overlay provisions Prometheus alerts and a Grafana dashboard with `docker compose -f compose.yaml -f compose.monitoring.yaml up --build -d`. Canonical replacement, transactions, messages and checkpoint updates commit atomically; a confirmed masterchain reorg resets and replays the recoverable projection.

Matched contract builds are imported offline with `pnpm verification:import <manifest.json>`. The importer reads deployed code from the node and records an attestation only when the manifest's code BOC is byte-for-byte identical. The public explorer exposes read-only results and has no verification upload endpoint.

Curated public address labels are also an offline, reviewed data product: `DATABASE_URL=… pnpm labels:import <manifest.json>`. Every record names its evidence source and optional HTTPS source URL. Personal labels never enter TOSCAN servers; they remain in the current browser's local storage.

See [Production Operations](docs/OPERATIONS.md) for topology, scaling, alerts, backups and recovery, [P0/P1/P2 Production Readiness](docs/PRODUCTION_READINESS.md) for the release acceptance matrix, and [Staking Data Provenance](docs/STAKING_DATA_PROVENANCE.md) for the staking research and TOS evidence model.

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
- `/explorer/assets/activity`, `/explorer/assets/{address}/holders`, `/explorer/assets/{address}/items`;
- `/explorer/economy`, `/explorer/verifications`, `/explorer/verifications/{address}`;
- `/explorer/staking` (Elector election/reward state plus code-verified Nominator Pool totals);
- `/explorer/staking/pools/{address}` (retained on-chain pool observations and current members);
- `/explorer/validators` (proof-decoded current/next sets, round timing and a joined network-level Elector summary);
- `/explorer/validators/{publicKey}` (retained current/next selection observations, weight history, membership state and explicitly non-attributed reward/signature context);
- `/explorer/analytics?window=24h|7d|30d|90d` (chain-derived activity buckets);
- `/explorer/labels/{address}` (reviewed public address-label evidence);
- `/explorer/governance/history` (retained raw configuration commitments);
- `/explorer/contracts/{kind}`, `/explorer/contracts/{kind}/{address}`;
- `/explorer/search`, `/explorer/search/suggest`.

Page components depend only on normalized models in `src/api/`; transport and chain DTO differences stay inside the adapter.

## Evidence boundaries

1. The index is complete only after every shard checkpoint reaches its reported head. TOSCAN displays this lag instead of claiming completeness early.
2. Current and next validator membership/weight come from proof-extracted configuration parameters #34 and #36. Proof-link signer counts are separate finalized network evidence, not live catchain/gossip telemetry or per-validator uptime.
3. Token metadata is untrusted contract data. Remote image references are shown as text and are not automatically loaded.
4. An observed asset holder is a node-verified position, not a balance claim; live balances remain contract-getter data.
5. A “Build matched” badge proves deployed code BOC equality with the submitted build artifact. Source reproducibility still depends on the displayed compiler, commit, digest and build instructions.
6. Off-chain AI execution is not inferred from a contract status. TOSCAN distinguishes chain-enforced commercial state from optional evidence or attestation commitments.
7. Staking APR/APY is an annualization of rewards already recorded by Elector. It is historical evidence, not a promised future or marginal deposit return. The Elector-derived `surplus_earns` flag is the UI authority: when false, stake above `effective_stake_cap` is returned and earns no additional reward. Pool contracts enter the view only after their deployed code hash matches the canonical TOS Nominator Pool code.
8. Validator-set membership, ADNL identity and weight are attributable to a validator public key. The current projection retains proof-link signatures only as network-level evidence and does not claim a proved public-key-to-signature mapping. Individual validator rewards are not exposed until the chain supplies an attributable payout ledger; TOSCAN does not divide aggregate rewards by weight and present that estimate as fact.
9. CSV export contains only the currently loaded evidence window and names the export time; it is not silently presented as an all-history dump.
10. TOSCAN is read-only. It deliberately contains no wallet connection, signing or transaction-submission path.
11. Asset activity records verified position appearance/removal. It is not presented as a transfer ledger until the chain exposes a canonical decoded source, destination and amount.
12. Governance history proves configuration-cell changes only. It does not claim proposal authors, off-chain deliberation or individual votes that the current evidence cannot attribute.

## Quality gates

```bash
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
QUERY_RECOVERY_DATABASE_URL=postgresql://… pnpm test:query:recovery
QUERY_SCALE_DATABASE_URL=postgresql://… QUERY_SCALE_ROWS=1000000 pnpm test:query:scale
NODE_ENV=production VITE_ENABLE_PREVIEW=false … pnpm production:validate
TOSCAN_SMOKE_ORIGIN=https://… pnpm production:smoke
docker build -t toscan:verify .
docker build -f Dockerfile.query -t toscan-query:verify .
```

CI is deliberately independent of a running TOS node. It enforces linting, TypeScript checks, unit tests, ordered PostgreSQL migration/integration tests, deterministic reopen/failover recovery, a one-million-transaction keyset/latency gate, the production build, desktop/mobile browser journeys, serious/critical accessibility checks and production container builds. Separate security gates reject high-severity production dependency advisories, generate a CycloneDX SBOM and scan the filesystem and both images. Tagged releases publish provenance-bearing images, sign their immutable digests with GitHub OIDC and attach GitHub build attestations.

Real-chain validation remains available as an explicit local or deployment-stage exercise through `pnpm test:e2e:real-chain` and `scripts/real-chain-browser-gate.py`. It is useful when a TOS node, indexer or API contract changes, but it is not part of pull-request, main-branch or image-release workflows; those workflows never compile or boot a native node.

The interface includes a skip link, semantic navigation and tables, keyboard search (`/`), visible focus states, responsive layouts, reduced-motion handling and persistent light/dark/system themes.

## License

TOSCAN uses the same license as TOS: GNU General Public License v3.0 or later. See [LICENSE](./LICENSE).
