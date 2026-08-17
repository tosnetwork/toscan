# Staking Data Provenance

## Why this exists

TOSCAN's Staking page must be reproducible from TOS chain evidence. It must not publish an unexplained APY value, treat an arbitrary account as a pool, or imply that a historical return is guaranteed.

## Reference design analysis

A mature public staking explorer commonly combines three data paths:

1. an indexed rewards-statistics service supplies the historical total-stake and APY series;
2. Elector account transactions, Elector state and network configuration parameters supply election timing, participants, stake and reward evidence;
3. deterministic browser code computes cycle reward ratios and annualized APR/APY, and projects the current cycle.

This is a hybrid chain-data design: indexed API history for efficient charts, contract/config decoding for current truth, and deterministic presentation math. It is not a single manually maintained "staking rate" endpoint.

## TOS source contract

TOSCAN uses the same sound separation while keeping TOS as the authority:

```text
TOS node / Elector
  ├─ elections_info() ─────────► current election stake and participants
  └─ past_elections() ─────────► completed stake, rewards and holding time

Canonical block activity
  └─ deployed code hash ───────► identify canonical Nominator Pool contracts
                                      │
                                      ├─ get_pool_data()
                                      └─ list_nominators()

tosctl explorer source index
  └─ /explorer/staking ────────► PostgreSQL staking projection ─► Vue /staking
```

The source index admits a pool only when its deployed code hash equals the Nominator Pool code shipped by TOS. It then records pool state, validator, commission, capacity, minimum stakes, current principal, pending deposits and withdrawal requests from contract get-methods. Display metadata cannot create or alter a pool record.

## Reward formulas

For a completed Elector cycle:

```text
cycle_rate = recorded_rewards / recorded_total_stake
periods_per_year = 31,557,600 / recorded_stake_held_seconds
annualized_apr = cycle_rate × periods_per_year
compounded_apy = (1 + cycle_rate) ^ periods_per_year - 1
```

The page labels these values as realized annualizations. A value is omitted when its inputs cannot produce a finite result. TOSCAN does not predict validator uptime, penalties, future participation, pool commission changes or future network issuance.

## Effective-stake cap

Historical APR/APY does not mean every additional pool deposit is reward-bearing. The source `/explorer/staking` response publishes the Elector-derived policy as a direct UI contract:

```json
{
  "effective_stake": {
    "max_stake_factor": 1.0,
    "effective_stake_cap": "10000000000000",
    "surplus_earns": false
  }
}
```

TOSCAN uses `surplus_earns` as the presentation predicate; it does not reimplement Elector selection math in the browser. When it is false, stake above `effective_stake_cap` is returned and earns no additional reward, so the marginal yield of further deposits beyond the cap is zero. The staking overview and every pool detail must display this constraint beside historical reward information.

Changing `max_stake_factor` is a protocol-governance action, not a pool optimization. The current proposal gate requires at least eight independent validators; the TOS operator workflow is implemented by `propose-stake-factor.sh`. TOSCAN remains read-only and does not imply that a pool operator can lift the cap by aggregating more deposits.

## Durable projection and recovery

The query service stores one current overview row and an upserted row per completed election. Pool records remain in the existing code-hash-classified contract table. Projection refresh happens under the same PostgreSQL writer lease as chain history, and readiness fails closed after a source error. PostgreSQL is a rebuildable read model: Elector state, canonical blocks and contract code/state remain the recovery authority.

## Product evidence boundary

- Current election totals and completed rewards are Elector evidence.
- Pool identity is deployed-code evidence.
- Pool balances and memberships are get-method evidence at the reported refresh time.
- APR/APY is deterministic derived data, not a promise or financial recommendation.
- `surplus_earns` is the authoritative UI predicate for marginal-reward disclosure; when false, capital above the effective cap has zero marginal yield.
- TOSCAN is read-only; joining, depositing, withdrawing and signing remain wallet/operator workflows outside the explorer.

## Implementation material

The implementation authority is the TOS node, Elector state, canonical Nominator Pool code shipped by TOS, and the read-only explorer contracts documented in this repository.
