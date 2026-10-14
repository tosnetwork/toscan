# Local PQ validation — 2026-10-14

Source pins and protocol boundaries are in [the parity document](post-quantum-parity.md).
Validation ran on macOS/ARM using native PostgreSQL and Chromium desktop/Pixel 7
layout emulation. No production or physical-device acceptance is implied.

## Results

| Check | Result |
| --- | --- |
| `pnpm check` | ESLint, Vue/Query type checking, 49 unit tests, frontend/Query builds passed |
| PostgreSQL integration/recovery/scale | 20 tests passed on isolated `toscan_pq_tests`; scale fixture used 100,000 rows |
| Existing deterministic browser suite | 11 passed; existing mobile accessibility test intentionally skipped |
| VM 16 PQ real-chain browser suite | Desktop and mobile membership/protocol checks passed; candidate-account checks intentionally excluded |
| VM 18 candidate real-chain browser suite | 4 passed: desktop/mobile protocol, stable validator detail, Quantum wallet/vault public state |
| Production dependency audit | No known vulnerabilities reported |
| Read-only parity probes | VM 16 block 2151 and VM 18 block 100: three ML-DSA members, pinned config decoding, healthy Query |

The unit suite's 20 PostgreSQL tests are skipped without database environment
variables; they were run separately with all three test database variables set.
The million-row setup was interrupted after local setup/IO delays. The passing
100,000-row run is not a million-row performance release gate.
The existing seeded AI-economy real-chain suite was not run against these PQ
fixtures; its expected seeded task/service/pool accounts are absent.

## Bugs corrected

- PQ descriptors have `public_key: null`. Classical-only identity/search handling
  crashed or lost validator detail/history. Stable `validator_id` now drives routes
  and rotation history, while `key_id` identifies the current key.
- PQ block signatures currently return a specific unsupported-carrier node RPC
  error. That prevented validator projection. It now records unavailable evidence
  and displays a dash, never a fabricated zero count. Unrelated RPC failures still fail.
- Optional Config 43 was absent on the legacy localnet and blocked governance
  projection. Exact missing-parameter responses are distinguished from failures.
- Index catch-up exceeded node RPC rate limits. Query now schedules requests and
  retries only HTTP 429, including plain-text rate-limit responses, within a bounded budget.
- Hidden copy labels escaped the horizontally scrolling validator table and
  enlarged the mobile layout viewport. Positioning the hidden labels fixes actual
  touch clicks; live E2E also asserts no page-wide overflow.
- Explicit `VITE_ENABLE_PREVIEW=false` was overridden by development mode. It now
  disables fallback so live validation cannot silently display preview records.

Negative checks cover nullable keys, stable-ID key rotation, malformed key chains,
unknown contract code, nonzero inert V5 authority, policy profile mismatch, mixed
configuration blocks, missing mandatory AUTH policy, unrelated signature RPC errors
and bounded rate-limit retries. Compiled contract fixtures and public state came
from the pinned TOS source and native SDK example.

## Live candidate accounts

Namespace: global ID 1, network tag `42` repeated 32 bytes, VM 18. The following
are fixed-public-key test genesis allocations, not signed deployment receipts:

- Wallet: `0:9c6dd1077dcf149b76db770af3338fb47ecc3b255c358c8d861f831d82a96a2e`
- Module: `0:1992a93d262ff996af774b1ded529cbebf038ce1058a9f913e45aab915b9fcfa`
- Fee vault: `0:79772af999d920d8ff5b59a01bdc3cbaaa7b5a70271e7dceee358193eaa78eeb`

Local runtimes, public evidence JSON, compiler manifests and logs remain under
`.local/pq-validation/`. Node databases, generated credentials and full runtime
logs are excluded from Git. Existing mobile-validation databases were preserved.

## Remaining upstream boundary

`getMasterchainBlockSignatures` does not yet serialize the post-quantum signature
carrier. TOSCAN cannot supply raw PQ consensus signatures that the node does not
expose. Browser observations rely on the node's proof verification and explicitly
state that they are not independent consensus-signature verification.
Falcon verifier availability starts at VM 19; this validation used VM 16 and 18.
No Falcon signature execution, Quantum release approval, safe LMS signer lifecycle,
remote deployment or mainnet activation is claimed.
