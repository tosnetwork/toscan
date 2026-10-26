# Quantum self-pay observation

The self-pay wallet has code hash
`4f4d4d55622992eeee9b4db05c2b447ca05d9c49e6ad5d027c7f9b16d759b93b`.
Its public state contains a version, seqno, wallet ID, retirement flags,
authority epoch, two role nonces and one authority reference. That authority
contains the signed network ID, namespace, ML-DSA-44 key, SLH-DSA-SHA2-128s
key and rescue policy. The wallet pays its own fees; this state has no fee
signer or module StateInit identity.

The local bounded decoder and registry provide a reference for public fixture
validation. They reject unsupported versions, retirement bits, policies,
noncanonical key chains and trailing state. uint64 values remain decimal
strings. Identification by code hash does not prove signatures, possession,
admission, a deployed account or release approval.

`quantum-self-pay-state-fixture.json` retains the public genesis state from
the TOS artifact at `1aa8821c0c208d09796b897b158c45203c99da51`, its file hash
and its historical generation commit. This frozen input is not a new RPC
recording. The registry entry has its own source commit; the registry's
top-level source commit continues to describe older entries.

The production Account cryptography panel consumes authenticated native RPC
metadata, including the `quantum_self_pay_v1` family. It does not call the local
decoder as a fallback. The shared query/browser wire validator enforces the
closed self-pay schema, exact role key lengths, retirement bits and uint64
strings. The main card retains the inexpensive legacy classification request; detailed
self-pay roles are shown only by the validated native cryptography panel.
Classification failures display an explicit unavailable state.

`pq-native.json` contains fresh public three-validator RPC observations from
TOS `7405aeebfede3dce8dec6f090585e67c6a808b97`, based on main `1aa8821c`.
Both networks use VM16, with distinct CP48 namespaces (42 and 43). The self-pay
account uses namespace43 and ready rescue policy, whose namespace differs from the candidate network's CP48 policy;
no CP48 eligibility is asserted. The manifest identifies the native binary source and the separately
hashed harness. Historical VM16/VM18 configuration recordings are labelled in
`pq-legacy-configs.json`; they are not attributed to the new node. CP47 is retired,
CP48 is mandatory from VM16, and current size-limit projections include the two
outbound queue limits. Existing module/fee-vault evidence remains separate.

Synthetic public genesis allocations and node-verified read-only observations
do not prove signed deployment, payment, rescue or migration. Fresh native read-only probe and ten desktop/mobile browser tests passed,
including self-pay rendering and pinned account-proof download. The live suite
uses no query service; optional indexed requests report connection failures and
do not establish PostgreSQL/query readiness. Full local checks passed: lint,
frontend/query typechecks and builds, 88 unit tests; 21 database integration
tests skipped. Removing retirement validation makes the new assertion fail;
restoration passes. A third-party review rejected the prior main-card opt-in because it duplicated
expensive requests and hid errors. The corrected main-card path has a failing
before/passing after test, plus live busy-state coverage on both viewports.
Final re-review, remote CI and cross-repository acceptance
remain separate gates. See [the evidence index](quantum-self-pay-validation.json).
