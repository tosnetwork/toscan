# Post-quantum explorer parity

**Native RPC follow-up:** [versioned native integration](native-pq-rpc.md) replaces
the browser-decoder path and unsupported-signature limitation described below.
This document retains the original assessment and source baseline.

TOS source baseline: `d41eae93dbbcb2af730b4ff5015458794ef04cb1` (2026-10-14).
TOSCAN base: `68a8cb680a9be6a7d2ec190fed41ab9e3ef86d07`.

This update reconciles explorer assumptions with the protocol work added after
2026-08-20. It reads public chain state; it does not execute contracts, sign
transactions or establish production release approval.

| Protocol change | Explorer behavior | Source in TOS |
| --- | --- | --- |
| PQ validator descriptor | Stable membership ID routes/history; current key ID and algorithm shown separately; nullable classical public key supported | `crypto/block/block.tlb`, `validator-engine/json-rpc-server-config.cpp` |
| Consensus key rotation | History and CSV retain key IDs and signature suites under the stable identity | `validator-engine/json-rpc-server-config.cpp` |
| PQ signature carrier RPC gap | Membership continues indexing; signatures explicitly unavailable; timeouts and unrelated failures still fail | `validator-engine/json-rpc-server-parse.cpp` |
| VM verifier gates | ML-DSA/SLH-DSA/HSS-LMS at VM 16, fee-hash gate at 17, Falcon candidate verifier at 19 | `crypto/vm/pqops.h` |
| Config 8 | Exact global-version cell and uint64 capabilities | `crypto/block/block.tlb` |
| Config 47 | Bounded controller code allowlist; no deployed-authority inference | `crypto/block/block.tlb` |
| Config 48 | Frozen AUTH profile, namespace, policy sequence, retirement flags/deadline; required at VM 17+ | `crypto/block/auth-policy.h` |
| Large PQ state/messages | Governance history includes raw Config 43 commitment | `crypto/block/block.tlb` |
| ML-DSA/Falcon modules and PQ highload | Exact compiled code hash followed by bounded public state decoding | `crypto/smartcont/mldsa44-auth-module.fc`, `falcon512-auth-module.fc`, `pq-highload-wallet-code.fc` |
| Quantum wallet/module/vault | Daily, rescue and stateful fee roles shown separately; inert V5 field is never labeled an Ed25519 authority | `crypto/smartcont/wallet-quantum-state.fc`, `wallet-quantum-identity.fc`, `wallet-quantum-fee-vault.fc` |

Configuration observations request `with_proof: true` at one masterchain seqno.
TOSCAN checks header/config block hashes against that observation. Proof checking
is delegated to the node; the browser does not independently verify consensus.
Only the exact node response for a missing optional parameter permits absence.
Malformed cells, unknown policy profiles and mixed-block evidence are rejected.

The code registry is intentionally finite. Unknown code stays unknown, including
future compiler outputs and upgraded contracts. Known code with malformed public
storage shows an error and no decoded authority fields. The Quantum contracts and
authorization modules are labeled review candidates. A match does not prove key
possession, safe LMS leaf state, network admission or release approval.

## Compiled public fixture provenance

`src/utils/pq-code-registry.json` pins the source commit and exact code hashes.
`pq-code-fixtures.json` contains public compiled BOCs, not signer material.
`quantum-state-fixture.json` contains SDK-generated public test state with fixed
public key bytes; these are encoding fixtures and have no signature claim.

The module fixtures were compiled with:

```sh
"$TOS_REPO/.venv/bin/python" "$TOS_REPO/test/falcon-auth/build_contracts.py" \
  --build "$TOS_REPO/build" --out "$PWD/.local/auth-contracts"
```

Quantum code was built with `scripts/build-wallet-quantum-bundle.py` in TOS,
and public genesis state with the `contracts` package's `quantum_genesis_encode`
example. The source's `scripts/build-quantum-basechain-fixture.py` allocated those
states on an isolated candidate network. Genesis allocation is not a deployment
transaction or a wallet transaction acceptance test.

Regenerate and review code hashes whenever source/compiler outputs change. Do
not identify a new contract solely by storage shape or an RPC wallet-type label.

## Local validation

Existing nodes and databases are preserved. Validation used separate workdirs
under `.local/pq-validation`; no Cloudflare or remote server deployment occurred.

| Stack | Node RPC ports | Controller | Source explorer | Query | Web |
| --- | --- | --- | --- | --- | --- |
| VM 16 / three ML-DSA validators | 19445–19447 | 19645 | 19450 | 19454 | 19455 |
| VM 18 isolated candidate / three ML-DSA validators | 20445–20447 | 20645 | 20450 | 20454 | 20455 |

Source scanning uses node 1, Query uses node 2, and frontend RPC uses node 3.
Query's default request rate is 40/s with at most three HTTP 429 retries
(1/2/4 seconds); the node's rate limit remains enabled. Other errors are not
silently retried as rate limiting. Configure `QUERY_RPC_REQUESTS_PER_SECOND` from
1 to 100 for the node budget, including other clients.

Disable development preview fallback during live validation:

```sh
TOS_RPC_PROXY_TARGET=http://127.0.0.1:19447 \
TOS_SERVICE_PROXY_TARGET=http://127.0.0.1:19454 \
VITE_ENABLE_PREVIEW=false VITE_TOS_NETWORK=localnet \
pnpm dev --host 127.0.0.1 --port 19455
```

The read-only probe checks pinned configuration, actual PQ membership, signature
availability and Query readiness, and optionally decodes public candidate accounts:

```sh
TOS_RPC_UPSTREAM=http://127.0.0.1:19447 \
TOSCAN_QUERY_ORIGIN=http://127.0.0.1:19454 \
pnpm exec tsx scripts/verify-pq-localnet.ts .local/pq-evidence.json

TOSCAN_REAL_WEB_ORIGIN=http://127.0.0.1:19455 TOSCAN_EXPECT_VM=16 \
pnpm exec playwright test --config playwright.real-chain.config.ts e2e/pq-chain.spec.ts
```

For the candidate stack use its own ports and database. Set
`TOSCAN_QUANTUM_WALLET` and `TOSCAN_QUANTUM_VAULT` to addresses from its public
`quantum-basechain/accounts.json`, plus `TOSCAN_EXPECT_VM=18`, to run the live
account checks. Never connect a candidate frontend to a different chain's Query.

The upstream localnet runner requires an absolute `--workdir`. For an existing
runtime use `--reuse` and omit fresh-only genesis flags. A new candidate requires
`--quantum-admission-candidate`; optional `--basechain-fixture` is test-only.
Keep RPC/controller ports separate: three validators consume three consecutive
RPC ports. Do not reset an existing runtime to upgrade a test fixture.

See [the validation record](post-quantum-validation-20261014.md) for observed
results and remaining node-side limitations.
