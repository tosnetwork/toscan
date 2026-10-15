# Native PQ RPC integration

TOSCAN consumes the versioned native explorer interfaces from the TOS
`feat/explorer-pq-rpc-validation` implementation branch. Native integration was
measured against merge commit `8d8a065227c6c83f5686e56c3da783132f4745f2` (including
main `19473401a`). Deploy the node interface and both TOSCAN frontend/query
services together. Older nodes that ignore typed opt-ins report an explicit
unsupported view; malformed or unavailable evidence never falls back to a local
account decoder or a fabricated successful PQ result.

This supersedes the node RPC limitations recorded in the earlier
[parity assessment](post-quantum-parity.md). Those original source pins and
validation records remain historical observations.

| Interface | TOSCAN use | Boundary |
| --- | --- | --- |
| R1 signatures | Masterchain block details show stable signer IDs, suite, historical set source, verified weight and node trust anchor; proof downloads are explicit | Full immutable target ID, duplicate/length/suite/session/weight checks; historical keys are not inferred from the latest set |
| R2 public authorization | Account details use `include_pq:true` for all six native code families, unknown code and no-active-code states | Canonical requested account and workchain, complete masterchain binding, schema/role validation, no partial fields after failure |
| R3 proof transport | Developer API page submits one bounded native TL query and downloads its reply | Exact POST REST allowlist; node enforces the native read-only query allowlist; API key stays in the reverse proxy |
| R4 typed policy | Network view uses Config 8/43/47/48 with `include_decoded:true` | Same full block/global ID/chain time/VM version; authenticated absence, frozen AUTH profile and deadline, native effective limits/defaults |

The node performs cryptographic verification. Wire checks and node-reported
`state_verified`/`node_verified` are not independent browser proof verification,
key possession, account admission, safe LMS signer state or release approval.
Binary identifiers and public bytes use canonical base64; uint64 values stay
exact decimal strings. Unknown schema versions/families fail closed.

## Resource behavior

- The typed browser adapter dispatches at most two inspections concurrently and
  queues at most eight. Saturation reports an error. There are no automatic PQ
  retries; users can explicitly retry a failed view.
- Policy refresh runs once per minute while the page is visible. Account/finality
  metadata loads once per selected identity. Proof downloads are user initiated,
  cache only the same observation and do not continue after navigation/unmount.
  Raw proof bytes are downloaded rather than inserted into the DOM.
- Normal browser and query RPC responses have a 16 MiB streamed byte limit,
  checked with and without Content-Length. The explicit proof relay has a 64 MiB
  JSON response limit and a 16 KiB decoded request limit. The browser's JSON cap
  can reject a large reply before the node's 64 MiB decoded-reply maximum.
- Account proofs are capped at 4 MiB decoded, finality proofs at 8 MiB. Public
  authority fields have fixed schemas and public-key sizes. Signer arrays are
  capped at 400 and displayed 20 at a time.
- Query snapshots retain PQ signature count, stable signer IDs and historical
  verification context, not repeated raw PQ signature/proof payloads. The
  `signature_count` field is authoritative for these compact snapshots;
  `signature_payloads_retained:false` distinguishes them from classical arrays.
  Historical per-validator signature attribution remains unavailable.
- The home/network counters poll a compact indexed summary (five-second cache with coalesced database reads), rather than downloading and verifying full native signature carriers per visitor. The displayed counter names its indexed block. Native carrier acquisition remains at the query projector's existing snapshot cadence (default 30 seconds), bounded to 16 MiB per response.
- Existing query rate scheduling and bounded 429 retries remain in force. New
  structured native failures are preserved and are not disguised as legacy
  unsupported responses. Preview mode never invents native PQ evidence, and an
  explicit preview-disable setting is honored in development too.

Config 43 labels native defaults separately from committed fields. Message
sizes are bits/cells, `max_ext_msg_size` is bytes, depth fields are depths and
other fields are counts. The masterchain account-cell limit applies from VM 12;
aggregate message limits apply from VM 15. These are limits, not gas/fee quotes
or execution guarantees. Verifier gates and AUTH retirement are separate policy.

## Validation and reproduction

On macOS arm64, `pnpm check` passes lint, frontend/query typechecks, **78 unit
tests**, and both production builds. The isolated PostgreSQL 16 integration suite passes **16 tests**, including real
SQL for compact PQ counts, legacy arrays and unavailable evidence. Recovery and
scale gates are not rerun locally in this update and remain assigned to the
existing PR CI. Database suites are skipped by the default check without their
isolated database variables.

The existing deterministic Chromium desktop/mobile suite passes **11 tests**, with
one pre-existing mobile accessibility skip. A fresh native three-validator VM18
candidate passes **six desktop/mobile browser tests**, covering signer identities,
full-ID proof download, native Quantum roles, account proof download, effective
configuration defaults, malformed recognized state, no preview substitution and
no page-wide viewport overflow. VM18 and VM16 read-only probes both pass native
finality (including proof export), typed policy and Config8 proof relay. VM18 also
checks six recognized public account families and unknown code, with proof export.
These are synthetic public test genesis allocations, not signed deployments.

```sh
pnpm check
pnpm test:e2e
# Start a separate native TOS localnet with an absolute workdir; preserve existing nodes.
TOS_RPC_UPSTREAM=http://127.0.0.1:54747 TOSCAN_EXPORT_PROOF=true \
  TOSCAN_PQ_ACCOUNTS=/absolute/path/to/public-addresses.json \
  pnpm exec tsx scripts/verify-pq-localnet.ts /tmp/toscan-pq-public-evidence.json
TOS_RPC_UPSTREAM=http://127.0.0.1:54747 \
  TOSCAN_PQ_ACCOUNTS=/absolute/path/to/public-addresses.json \
  pnpm exec playwright test --config playwright.pq-rpc.config.ts
```

The public address map can be produced by the pinned native
`scripts/test-explorer-pq-rpc.py` fixture builder. Optional
`TOSCAN_QUERY_ORIGIN` also checks the query service readiness endpoint. The
standalone native browser suite does not claim PostgreSQL-backed query readiness.

The frozen public response fixture and manifest in `src/api/fixtures/` pin the
original native receipt source. Guard-removal checks for full block binding and
duplicate signers both fail at the intended assertion and pass after exact source
restoration. See [the evidence index](native-pq-rpc-validation.json) for hashes,
retention and measured source. Bulky public receipts and screenshots are retained
outside Git. No node runtime, database, generated credential or signer key is
included in the index or committed. No production deployment is performed.
