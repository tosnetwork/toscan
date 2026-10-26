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
metadata. It does not call this local decoder as a fallback. Native
`getAccountCapability` self-pay family support, strict shared wire validation,
new real-node recordings and UI acceptance are still required before this
adaptation is complete. Existing module/fee-vault evidence remains separate.
