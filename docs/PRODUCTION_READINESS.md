# TOSCAN P0/P1/P2 Production Readiness

This document is the acceptance contract for the chain-authority closure (P0), production-hardening (P1) and product-completeness (P2) increments. A checked item means the implementation and its automated gate live in this repository; it never permits the UI to manufacture evidence that the authoritative TOS node does not expose.

## P0 — chain authority and release closure

| Capability | Implementation | Release evidence |
| --- | --- | --- |
| Real-chain vertical path | Pinned TOS revision boots a native validator, source index, PostgreSQL projection, gateway and desktop/mobile browser with preview disabled | `real-chain-browser` CI job asserts required TOS capabilities before running the browser gate |
| Production configuration | Explicit mainnet/testnet label, canonical HTTPS origin, preview disabled, private upstreams and non-development PostgreSQL credentials | `pnpm production:validate` runs in CI and is required before a production build |
| Deployment smoke | Gateway liveness, ordinary and `/assets/*` SPA fallbacks, explorer status, security headers and negative tests for mutation/operator routes | `TOSCAN_SMOKE_ORIGIN=https://… pnpm production:smoke` |
| Superseded-run control | New commits cancel obsolete CI/security runs on the same ref | Workflow concurrency groups prevent stale native builds from consuming the release queue |

## P1 — production hardening

| Capability | Implementation | Release evidence |
| --- | --- | --- |
| Million-row behavior | Opaque keyset pagination and indexed recent-history queries | `pnpm test:query:scale` inserts 1,000,000 transactions, walks 5,000 unique rows across 25 pages, inserts a concurrent head row, checks the query plan and enforces a 1-second local p95 ceiling |
| Restart and disaster recovery | Ordered migrations, atomic checkpoints, canonical reset/replay and PostgreSQL advisory writer lease | `pnpm test:query:recovery` performs five close/reopen cycles, reset/replay with curated-label preservation and writer failover |
| Fail-closed health | `/healthz`, projection-aware `/readyz`, source health, lag and stale-cycle thresholds | Query integration tests and production container health checks |
| Operations telemetry | Prometheus counters, gauges and bounded-cardinality latency/cycle histograms; six alert rules; provisioned Grafana dashboard | Official `promtool` configuration/rule validation; `compose.monitoring.yaml` |
| Supply-chain security | Production dependency audit, CycloneDX SBOM, filesystem/image scanning, signed GHCR digests, BuildKit provenance and GitHub attestations | `.github/workflows/security.yml` and `.github/workflows/release.yml`; both runtime images contain no known fixed High/Critical findings at acceptance time |
| Real-network browser coverage | Desktop and Pixel 7 projects with preview disabled, overflow checks and validator/pool/analytics journeys | `pnpm test:e2e:real-chain`, called by the pinned native-chain CI gate after P0 capabilities pass |
| Production discoverability | Per-route titles/descriptions/canonical links, Open Graph/Twitter metadata, manifest, robots policy and build-generated sitemap | Production build emits `sitemap.xml`; browser journeys assert route canonical metadata |
| Frontend diagnostics | Browser-local bounded error/rejection/LCP/CLS records with no automatic network export | `/diagnostics`; diagnostics are capped at 100 and clearable on device |

## P2 — explorer completeness

| Capability | User-visible result | Evidence boundary |
| --- | --- | --- |
| Staking depth | Reward-rate history charts, Nominator Pool detail, members, stake history and CSV | Pools require canonical code-hash classification; network rewards are not presented as pool payouts |
| Validator depth | Current/next proof-decoded sets, live round progress, Elector summary, searchable/sortable/paginated directory, detail membership, selection/weight history and CSV | Proof signatures and rewards stay network-level until a public-key signer mapping and validator payout ledger are independently provable; country/version/wallet/uptime are not invented |
| Network analytics | 24-hour, 7-day, 30-day and 90-day block/transaction/fee trends plus contract/asset composition | Buckets are derived only from committed canonical projection data; missing intervals are not interpolated |
| Address labels | Reviewed public evidence labels, code-hash-derived labels and private personal browser labels | Public imports are offline/transactional and source-attributed; personal labels never leave local storage |
| Data portability | CSV actions on blocks, transactions, assets, agents, staking, pools, validators and analytics | Exports identify and contain the currently loaded evidence window, not an implied full-history dump |
| Localization | Persisted English, Simplified Chinese and Japanese navigation/core journeys | Technical identifiers and raw proof fields remain unchanged |
| Accessible visualization | Semantic summaries, accessible SVG trend charts, keyboard journeys, reduced motion and responsive layouts | Canvas-only or hover-only information is not used |
| Advanced search | Debounced typed suggestions for labels, contracts, assets, transactions, messages, blocks and verified builds; keyboard navigation and recent searches | Query integration and desktop/mobile Playwright journeys |
| Verified contracts | Paginated directory and source/build/manifest detail for offline-imported byte-identical attestations | Verification imports remain offline; public routes are read-only |
| Asset depth | Paginated holders, collection items and durable owner-position appearance/removal history | Position observations are explicitly not labelled as decoded transfers |
| Governance history | Retained raw configuration snapshots and changed-parameter timeline | No proposal author or vote attribution is shown without attributable chain evidence |
| Private watchlist | Addresses, assets, validators, pools and Agent Economy identities can be fingerprinted for changes | Data remains in browser local storage; no account or off-device notification is implied |
| Public API reference | Human-readable endpoint catalog and OpenAPI 3.1 document | Documents only allowlisted read projection routes |

## Required release commands

```bash
pnpm check
pnpm test:e2e
NODE_ENV=production VITE_ENABLE_PREVIEW=false … pnpm production:validate
QUERY_INTEGRATION_DATABASE_URL=postgresql://… pnpm test:query:integration
QUERY_RECOVERY_DATABASE_URL=postgresql://… pnpm test:query:recovery
QUERY_SCALE_DATABASE_URL=postgresql://… QUERY_SCALE_ROWS=1000000 pnpm test:query:scale
docker compose build
TOSCAN_SMOKE_ORIGIN=https://… pnpm production:smoke
```

For a release candidate, the native-chain CI job must also pass with preview disabled. Promotion uses signed image digests only after projection readiness is green and the browser resolves recent real-chain block, transaction, validator and Nominator Pool evidence.
