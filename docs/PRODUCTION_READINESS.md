# TOSCAN P1/P2 Production Readiness

This document is the acceptance contract for the production-hardening (P1) and product-completeness (P2) increments. A checked item means the implementation and its automated gate live in this repository; it does not weaken the separate P0 requirement that the authoritative TOS node expose the required proof-backed data.

## P1 — production hardening

| Capability | Implementation | Release evidence |
| --- | --- | --- |
| Million-row behavior | Opaque keyset pagination and indexed recent-history queries | `pnpm test:query:scale` inserts 1,000,000 transactions, walks 5,000 unique rows across 25 pages, inserts a concurrent head row, checks the query plan and enforces a 1-second local p95 ceiling |
| Restart and disaster recovery | Ordered migrations, atomic checkpoints, canonical reset/replay and PostgreSQL advisory writer lease | `pnpm test:query:recovery` performs five close/reopen cycles, reset/replay with curated-label preservation and writer failover |
| Fail-closed health | `/healthz`, projection-aware `/readyz`, source health, lag and stale-cycle thresholds | Query integration tests and production container health checks |
| Operations telemetry | Prometheus counters, gauges and bounded-cardinality latency/cycle histograms; six alert rules; provisioned Grafana dashboard | Official `promtool` configuration/rule validation; `compose.monitoring.yaml` |
| Supply-chain security | Production dependency audit, CycloneDX SBOM, filesystem/image scanning, signed GHCR digests, BuildKit provenance and GitHub attestations | `.github/workflows/security.yml` and `.github/workflows/release.yml`; both runtime images contain no known fixed High/Critical findings at acceptance time |
| Real-network browser coverage | Desktop and Pixel 7 projects with preview disabled, overflow checks and validator/pool/analytics journeys | `pnpm test:e2e:real-chain`, called by the pinned native-chain CI gate after P0 capabilities pass |

## P2 — explorer completeness

| Capability | User-visible result | Evidence boundary |
| --- | --- | --- |
| Staking depth | Reward-rate history charts, Nominator Pool detail, members, stake history and CSV | Pools require canonical code-hash classification; network rewards are not presented as pool payouts |
| Validator depth | Current proof-decoded set, validator detail, selection/weight history, proof-signature context and CSV | Individual rewards remain explicitly unavailable until attributable chain evidence exists |
| Network analytics | 24-hour, 7-day, 30-day and 90-day block/transaction/fee trends plus contract/asset composition | Buckets are derived only from committed canonical projection data; missing intervals are not interpolated |
| Address labels | Reviewed public evidence labels, code-hash-derived labels and private personal browser labels | Public imports are offline/transactional and source-attributed; personal labels never leave local storage |
| Data portability | CSV actions on blocks, transactions, assets, agents, staking, pools, validators and analytics | Exports identify and contain the currently loaded evidence window, not an implied full-history dump |
| Localization | Persisted English, Simplified Chinese and Japanese navigation/core journeys | Technical identifiers and raw proof fields remain unchanged |
| Accessible visualization | Semantic summaries, accessible SVG trend charts, keyboard journeys, reduced motion and responsive layouts | Canvas-only or hover-only information is not used |

## Required release commands

```bash
pnpm check
pnpm test:e2e
QUERY_INTEGRATION_DATABASE_URL=postgresql://… pnpm test:query:integration
QUERY_RECOVERY_DATABASE_URL=postgresql://… pnpm test:query:recovery
QUERY_SCALE_DATABASE_URL=postgresql://… QUERY_SCALE_ROWS=1000000 pnpm test:query:scale
docker compose build
```

For a release candidate, the native-chain CI job must also pass with preview disabled. Promotion uses signed image digests only after projection readiness is green and the browser resolves recent real-chain block, transaction, validator and Nominator Pool evidence.
