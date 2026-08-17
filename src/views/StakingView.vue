<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "@/components/AppIcon.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import ExportButton from "@/components/ExportButton.vue";
import TrendChart from "@/components/TrendChart.vue";
import { getStakingData } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, formatTos } from "@/utils/format";

const { data, loading, error, refresh } = useAsyncData(getStakingData, [], { refreshInterval: 15_000 });
const latestCycle = computed(() => data.value?.cycles[0] ?? null);
const cycleChart = computed(() => [...(data.value?.cycles ?? [])].reverse());

function percent(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(2)}%`;
}

</script>

<template>
  <div class="container page-container">
    <PageHeading title="Staking" description="Network rewards and Nominator Pools, reconstructed from Elector state and canonical pool contracts." eyebrow="Chain-derived rewards">
      <button class="button button--secondary" type="button" @click="refresh"><AppIcon name="refresh" :size="17" />Refresh</button>
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="metric-strip" aria-label="Staking summary">
          <div><small>Current election stake</small><strong>{{ data.current_election_available ? formatTos(data.current_election_stake) : '—' }}</strong><span>{{ data.current_election_available ? `${formatInteger(data.current_participants)} participants` : 'No active election published' }}</span></div>
          <div><small>Latest realized APY</small><strong>{{ percent(latestCycle?.compounded_apy) }}</strong><span>{{ latestCycle ? `Election ${latestCycle.election_id}` : 'Awaiting a completed cycle' }}</span></div>
          <div><small>Nominator Pool stake</small><strong>{{ formatTos(data.total_pool_stake) }}</strong><span>{{ formatInteger(data.active_pools) }} active of {{ formatInteger(data.pools) }} pools</span></div>
          <div><small>Nominators</small><strong>{{ formatInteger(data.nominators) }}</strong><span>Minimum {{ formatTos(data.minimum_stake) }}</span></div>
        </section>

        <section class="surface page-surface staking-cycle-card">
          <header class="section-heading"><div><h2>Completed reward cycles</h2><p>Realized Elector bonuses divided by stake, annualized over each recorded holding period</p></div><div class="heading-actions"><ExportButton filename="toscan-staking-cycles" :headers="['Election','Total stake','Rewards','Reward rate','APR','APY','Validators','Unfreeze at']" :rows="data.cycles.map((cycle) => [cycle.election_id,cycle.total_stake,cycle.rewards,cycle.reward_rate,cycle.annualized_apr,cycle.compounded_apy,cycle.validator_count,cycle.unfreeze_at])" /><RouterLink to="/validators">Validators <AppIcon name="chevron" :size="15" /></RouterLink></div></header>
          <TrendChart :values="cycleChart.map((cycle) => cycle.reward_rate * 100)" :labels="cycleChart.map((cycle) => `Election ${cycle.election_id}`)" title="Realized reward-rate history" value-label="Percent per completed holding period" :format="(value) => `${value.toFixed(2)}%`" />
          <div class="data-table-wrap">
            <table class="data-table staking-table">
              <thead><tr><th>Election</th><th>Total stake</th><th>Rewards</th><th>Reward rate</th><th>APR</th><th>APY</th><th>Validators</th><th>Unfreezes</th></tr></thead>
              <tbody>
                <tr v-for="cycle in data.cycles" :key="cycle.election_id">
                  <td class="mono">{{ cycle.election_id }}</td>
                  <td>{{ formatTos(cycle.total_stake) }}</td>
                  <td class="positive-value">+{{ formatTos(cycle.rewards) }}</td>
                  <td>{{ percent(cycle.reward_rate) }}</td>
                  <td>{{ percent(cycle.annualized_apr) }}</td>
                  <td>{{ percent(cycle.compounded_apy) }}</td>
                  <td>{{ formatInteger(cycle.validator_count) }}</td>
                  <td>{{ formatDate(cycle.unfreeze_at) }}</td>
                </tr>
                <tr v-if="!data.cycles.length"><td colspan="8" class="inline-empty">{{ data.reward_history_available ? 'No completed election rewards have been committed yet.' : 'Reward history is not available from Elector yet.' }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="surface page-surface">
          <header class="section-heading"><div><h2>Nominator Pools</h2><p>Code-hash-verified pools discovered from canonical block activity</p></div></header>
          <div class="staking-pool-list">
            <article v-for="pool in data.pool_records" :key="pool.address">
              <div class="staking-pool-main">
                <StatusBadge :status="pool.status ?? 'unknown'" />
                <RouterLink class="mono" :to="{ name: 'staking-pool', params: { address: pool.address } }">{{ compact(pool.address, 16, 12) }}</RouterLink>
                <small>Validator {{ compact(pool.data.validator_address, 12, 10) }}</small>
              </div>
              <dl>
                <div><dt>Pool stake</dt><dd>{{ formatTos(pool.data.total_balance_at_risk) }}</dd></div>
                <div><dt>Nominators</dt><dd>{{ pool.data.nominators_count }} / {{ pool.data.max_nominators_count }}</dd></div>
                <div><dt>Validator share</dt><dd>{{ (pool.data.validator_reward_share_bps / 100).toFixed(2) }}%</dd></div>
                <div><dt>Minimum nomination</dt><dd>{{ formatTos(pool.data.min_nominator_stake) }}</dd></div>
              </dl>
            </article>
            <p v-if="!data.pool_records.length" class="inline-empty">No Nominator Pool contract has appeared in indexed chain activity yet.</p>
          </div>
        </section>

        <p class="surface evidence-note"><strong>Evidence boundary.</strong> Stake, rewards and election timing come from the Elector contract. Pools are admitted only when their deployed code hash matches the TOS Nominator Pool code; balances and memberships come from each pool’s get-methods. APR and APY are deterministic annualizations of realized on-chain rewards, not promised returns.</p>
      </template>
    </LoadState>
  </div>
</template>
