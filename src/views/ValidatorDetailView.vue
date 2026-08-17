<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import CopyButton from "@/components/CopyButton.vue";
import ExportButton from "@/components/ExportButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import TrendChart from "@/components/TrendChart.vue";
import { getValidatorDetail } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, ratioPercent } from "@/utils/format";

const route = useRoute();
const publicKey = computed(() => String(route.params.publicKey));
const { data, loading, error, refresh } = useAsyncData(() => getValidatorDetail(publicKey.value), [publicKey], { refreshInterval: 15_000 });
const chronological = computed(() => [...(data.value?.history ?? [])].reverse());
const rewards = computed(() => [...(data.value?.network_reward_cycles ?? [])].reverse());
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Validator" description="Proof-extracted selection history and voting weight." eyebrow="Consensus evidence" />
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card"><div><small>Validator public key</small><p class="mono">{{ data.public_key }}</p></div><CopyButton :value="data.public_key" label="validator public key" /></section>
        <section class="metric-strip">
          <div><small>Current weight</small><strong>{{ ratioPercent(data.current.weight, data.current.total_weight).toFixed(2) }}%</strong><span>{{ data.current.weight }} raw weight</span></div>
          <div><small>Retained selections</small><strong>{{ formatInteger(data.selected_sets) }}</strong><span>First seen {{ formatDate(data.first_observed_at) }}</span></div>
          <div><small>Last proof block</small><strong>{{ formatInteger(data.current.observed_mc_seqno) }}</strong><span>{{ formatDate(data.last_observed_at) }}</span></div>
          <div><small>ADNL identity</small><strong class="mono compact-value">{{ compact(data.current.adnl_address, 10, 8) }}</strong><span>Network identity</span></div>
        </section>
        <section class="surface page-surface chart-grid-layout">
          <TrendChart :values="chronological.map((point) => ratioPercent(point.weight, point.total_weight))" :labels="chronological.map((point) => `Block ${point.observed_mc_seqno}`)" title="Voting-weight history" value-label="Share of proved validator set" :format="(value) => `${value.toFixed(2)}%`" />
          <TrendChart :values="rewards.map((cycle) => cycle.reward_rate * 100)" :labels="rewards.map((cycle) => `Election ${cycle.election_id}`)" title="Network reward history" value-label="Network-wide realized rate — not individual payout" :format="(value) => `${value.toFixed(2)}%`" />
        </section>
        <section class="surface page-surface"><header class="section-heading"><div><h2>Selection observations</h2><p>Every retained proved set in which this public key appeared</p></div><ExportButton :filename="`toscan-validator-${data.public_key.slice(-10)}-history`" :headers="['Observed block','Observed at','Weight','Total weight','Weight share','ADNL']" :rows="data.history.map((point) => [point.observed_mc_seqno,point.observed_at,point.weight,point.total_weight,ratioPercent(point.weight,point.total_weight),point.adnl_address])" /></header><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Block</th><th>Observed</th><th>Weight</th><th>Share</th><th>ADNL</th></tr></thead><tbody><tr v-for="point in data.history" :key="point.observed_mc_seqno"><td>{{ formatInteger(point.observed_mc_seqno) }}</td><td>{{ formatDate(point.observed_at) }}</td><td class="mono">{{ point.weight }}</td><td>{{ ratioPercent(point.weight,point.total_weight).toFixed(2) }}%</td><td class="mono">{{ compact(point.adnl_address,12,10) }}</td></tr></tbody></table></div></section>
        <p class="surface evidence-note"><strong>Evidence boundary.</strong> TOSCAN proves set membership and weight from configuration cells. Elector currently exposes aggregate reward cycles, not a validator-address payout ledger; the reward chart is network context and is deliberately not attributed to this validator.</p>
      </template>
    </LoadState>
  </div>
</template>
