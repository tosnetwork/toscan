<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AddressLabelEditor from "@/components/AddressLabelEditor.vue";
import CopyButton from "@/components/CopyButton.vue";
import ExportButton from "@/components/ExportButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import TrendChart from "@/components/TrendChart.vue";
import { getAddressLabel, getNominatorPoolDetail } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, formatTos } from "@/utils/format";

const route = useRoute();
const address = computed(() => String(route.params.address));
const { data, loading, error, refresh } = useAsyncData(() => getNominatorPoolDetail(address.value), [address], { refreshInterval: 15_000 });
const { data: publicLabel } = useAsyncData(() => getAddressLabel(address.value), [address]);
const chronological = computed(() => [...(data.value?.history ?? [])].reverse());
const rewardCycles = computed(() => [...(data.value?.network_reward_cycles ?? [])].reverse());
const tosNumber = (value: string | number) => Number(value) / 1_000_000_000;
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Nominator Pool" description="Current membership, stake exposure and retained on-chain observations." eyebrow="Staking evidence">
      <StatusBadge v-if="data" :status="data.pool.status ?? 'unknown'" />
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface account-card pool-identity">
          <div class="account-identity"><div><small>Pool address</small><p class="mono">{{ data.pool.address }}</p><AddressLabelEditor :address="data.pool.address" :public-label="publicLabel" /></div><CopyButton :value="data.pool.address" label="pool address" /></div>
          <div class="account-balance"><small>Total balance at risk</small><strong>{{ formatTos(data.pool.data.total_balance_at_risk) }} <em>TOS</em></strong><span>Observed {{ formatDate(data.pool.updated_at) }}</span></div>
        </section>
        <section class="metric-strip">
          <div><small>Nominators</small><strong>{{ formatInteger(data.pool.data.nominators_count) }}</strong><span>Maximum {{ formatInteger(data.pool.data.max_nominators_count) }}</span></div>
          <div><small>Validator stake</small><strong>{{ formatTos(data.pool.data.validator_amount) }}</strong><span>{{ (data.pool.data.validator_reward_share_bps / 100).toFixed(2) }}% reward share</span></div>
          <div><small>Nominator stake</small><strong>{{ formatTos(data.pool.data.nominator_stake) }}</strong><span>Minimum {{ formatTos(data.pool.data.min_nominator_stake) }}</span></div>
          <div><small>Set changes</small><strong>{{ formatInteger(data.pool.data.validator_set_changes_count) }}</strong><span>Held {{ formatInteger(data.pool.data.stake_held_for) }} seconds</span></div>
        </section>
        <section class="surface page-surface chart-grid-layout">
          <TrendChart :values="chronological.map((point) => tosNumber(point.data.total_balance_at_risk))" :labels="chronological.map((point) => formatDate(point.observed_at))" title="Pool stake history" value-label="TOS at risk" :format="(value) => `${value.toLocaleString()} TOS`" />
          <TrendChart :values="rewardCycles.map((cycle) => cycle.reward_rate * 100)" :labels="rewardCycles.map((cycle) => `Election ${cycle.election_id}`)" title="Network reward environment" value-label="Realized network rate — not this pool’s payout" :format="(value) => `${value.toFixed(2)}%`" />
        </section>
        <section class="surface page-surface">
          <header class="section-heading"><div><h2>Nominator positions</h2><p>Amounts and withdrawal intent returned by the pool’s get-methods</p></div><ExportButton :filename="`toscan-pool-${data.pool.address.slice(-8)}-nominators`" :headers="['Address','Amount','Pending deposit','Withdraw requested']" :rows="data.pool.data.nominators.map((item) => [item.address,item.amount,item.pending_deposit,item.withdraw_requested])" /></header>
          <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Address</th><th>Amount</th><th>Pending</th><th>Withdrawal</th></tr></thead><tbody>
            <tr v-for="position in data.pool.data.nominators" :key="position.address"><td><RouterLink class="mono" :to="`/address/${position.address}`">{{ compact(position.address, 16, 12) }}</RouterLink></td><td>{{ formatTos(position.amount) }}</td><td>{{ formatTos(position.pending_deposit) }}</td><td><StatusBadge :status="position.withdraw_requested ? 'requested' : 'staked'" /></td></tr>
          </tbody></table></div>
        </section>
        <p class="surface evidence-note"><strong>Evidence boundary.</strong> Historical points are observations retained by TOSCAN, not a second ledger. Network reward cycles provide context only; the chain does not currently expose a cryptographic per-pool reward attribution, so TOSCAN does not manufacture one.</p>
      </template>
    </LoadState>
  </div>
</template>
