<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import CopyButton from "@/components/CopyButton.vue";
import ExportButton from "@/components/ExportButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import TrendChart from "@/components/TrendChart.vue";
import { getValidatorDetail } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, formatTos, ratioPercent } from "@/utils/format";

const route = useRoute();
const publicKey = computed(() => String(route.params.publicKey));
const { data, loading, error, refresh } = useAsyncData(() => getValidatorDetail(publicKey.value), [publicKey], { refreshInterval: 15_000 });
const chronological = computed(() => [...(data.value?.history ?? [])].reverse());
const rewards = computed(() => [...(data.value?.network_reward_cycles ?? [])].reverse());
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Validator" description="Proof-extracted membership, selection history and voting weight without invented operator or reward attribution." eyebrow="Consensus evidence">
      <RouterLink class="button button--secondary" to="/validators">All validators</RouterLink>
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card validator-identity"><div><small>Validator public key</small><p class="mono">{{ data.public_key }}</p><div class="validator-membership-badges"><StatusBadge :status="data.currently_selected ? 'active' : 'not active'" /><StatusBadge v-if="data.selected_for_next_set" status="next set" /></div></div><CopyButton :value="data.public_key" label="validator public key" /></section>
        <section class="metric-strip">
          <div><small>Latest observed weight</small><strong>{{ ratioPercent(data.current.weight, data.current.total_weight).toFixed(2) }}%</strong><span>{{ data.current.weight }} raw weight</span></div>
          <div><small>Retained selections</small><strong>{{ formatInteger(data.selected_sets) }}</strong><span>First seen {{ formatDate(data.first_observed_at) }}</span></div>
          <div><small>Latest proof block</small><strong>{{ formatInteger(data.latest_observed_mc_seqno) }}</strong><span>{{ formatInteger(data.observed_signature_count) }} signatures on proof link</span></div>
          <div><small>ADNL identity</small><strong class="mono compact-value">{{ compact(data.current.adnl_address, 10, 8) }}</strong><span>Consensus network identity</span></div>
        </section>

        <section class="surface validator-membership">
          <div><small>Current set</small><strong>{{ data.currently_selected ? 'Selected' : 'Not selected' }}</strong><span>{{ data.current_set_valid_until ? `Valid until ${formatDate(data.current_set_valid_until)}` : 'No active-set timing available' }}</span></div>
          <div><small>Next set</small><strong>{{ data.selected_for_next_set ? 'Selected' : 'Not selected' }}</strong><span>{{ data.next_set_valid_from ? `${formatDate(data.next_set_valid_from)} → ${formatDate(data.next_set_valid_until ?? undefined)}` : 'No committed successor membership' }}</span></div>
          <div><small>Last retained observation</small><strong>{{ formatDate(data.last_observed_at) }}</strong><span>Projection block {{ formatInteger(data.current.observed_mc_seqno) }}</span></div>
        </section>

        <section v-if="data.effective_stake" class="surface validator-cap-note" :class="{ 'validator-cap-note--binding': data.effective_stake.surplus_earns === false }" role="note">
          <div><small>Effective-stake policy</small><strong>{{ data.effective_stake.surplus_earns === false ? 'Capital above the effective cap earns zero marginal reward' : 'Reward-bearing stake policy' }}</strong><span v-if="data.effective_stake.effective_stake_cap">Network cap {{ formatTos(data.effective_stake.effective_stake_cap) }} TOS — not this validator’s attributable stake</span></div>
          <RouterLink to="/staking">Network rewards only</RouterLink>
        </section>

        <section class="surface page-surface chart-grid-layout">
          <TrendChart :values="chronological.map((point) => ratioPercent(point.weight, point.total_weight))" :labels="chronological.map((point) => `Block ${point.observed_mc_seqno}`)" title="Voting-weight history" value-label="Share of proved validator set" :format="(value) => `${value.toFixed(2)}%`" />
          <TrendChart :values="rewards.map((cycle) => cycle.reward_rate * 100)" :labels="rewards.map((cycle) => `Election ${cycle.election_id}`)" title="Network reward history" value-label="Network-wide realized rate — not individual payout" :format="(value) => `${value.toFixed(2)}%`" />
        </section>
        <section class="surface page-surface"><header class="section-heading"><div><h2>Selection observations</h2><p>Every retained proved set in which this public key appeared</p></div><ExportButton :filename="`toscan-validator-${data.public_key.slice(-10)}-history`" :headers="['Observed block','Observed at','Weight','Total weight','Weight share','ADNL']" :rows="data.history.map((point) => [point.observed_mc_seqno,point.observed_at,point.weight,point.total_weight,ratioPercent(point.weight,point.total_weight),point.adnl_address])" /></header><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Block</th><th>Observed</th><th>Weight</th><th>Share</th><th>ADNL</th></tr></thead><tbody><tr v-for="point in data.history" :key="point.observed_mc_seqno"><td>{{ formatInteger(point.observed_mc_seqno) }}</td><td>{{ formatDate(point.observed_at) }}</td><td class="mono">{{ point.weight }}</td><td>{{ ratioPercent(point.weight,point.total_weight).toFixed(2) }}%</td><td class="mono">{{ compact(point.adnl_address,12,10) }}</td></tr></tbody></table></div></section>
        <p class="surface evidence-note"><strong>Evidence boundary.</strong> TOSCAN proves set membership, timing, ADNL identity and weight from configuration cells. Proof signatures are shown only as network-level evidence because the current explorer projection does not retain a proved public-key-to-signature mapping. Elector exposes aggregate reward cycles, not a validator-address payout ledger; no network reward is attributed to this validator.</p>
      </template>
    </LoadState>
  </div>
</template>
