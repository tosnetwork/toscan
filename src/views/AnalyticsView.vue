<script setup lang="ts">
import { computed, ref } from "vue";
import ExportButton from "@/components/ExportButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import TrendChart from "@/components/TrendChart.vue";
import { getNetworkAnalytics } from "@/api/explorer";
import type { NetworkAnalytics } from "@/api/types";
import { useAsyncData } from "@/composables/useAsyncData";
import { formatDate, formatInteger, formatTos } from "@/utils/format";

const window = ref<NetworkAnalytics["window"]>("7d");
const { data, loading, error, refresh } = useAsyncData(() => getNetworkAnalytics(window.value), [window], { refreshInterval: 30_000 });
const totals = computed(() => ({
  blocks: data.value?.activity.reduce((sum, point) => sum + point.blocks, 0) ?? 0,
  transactions: data.value?.activity.reduce((sum, point) => sum + point.transactions, 0) ?? 0,
  fees: data.value?.activity.reduce((sum, point) => sum + BigInt(point.fees), 0n).toString() ?? "0",
}));
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Network analytics" description="Chain-derived activity trends without off-chain estimates." eyebrow="Historical telemetry"><div class="heading-actions"><label class="select-control">Window<select v-model="window"><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option></select></label><ExportButton v-if="data" :filename="`toscan-network-${window}`" :headers="['Bucket','Blocks','Transactions','Fees']" :rows="data.activity.map((point) => [point.bucket,point.blocks,point.transactions,point.fees])" /></div></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="metric-strip"><div><small>Blocks</small><strong>{{ formatInteger(totals.blocks) }}</strong><span>Across {{ data.activity.length }} buckets</span></div><div><small>Transactions</small><strong>{{ formatInteger(totals.transactions) }}</strong><span>Canonical indexed history</span></div><div><small>Fees</small><strong>{{ formatTos(totals.fees) }}</strong><span>TOS recorded by execution</span></div><div><small>Bucket width</small><strong>{{ formatInteger(data.bucket_seconds / 3600) }}h</strong><span>{{ window }} window</span></div></section>
        <section class="surface page-surface chart-grid-layout"><TrendChart :values="data.activity.map((point) => point.transactions)" :labels="data.activity.map((point) => formatDate(point.bucket))" title="Transaction activity" value-label="Transactions per bucket" :format="(value) => formatInteger(value)" /><TrendChart :values="data.activity.map((point) => Number(point.fees) / 1_000_000_000)" :labels="data.activity.map((point) => formatDate(point.bucket))" title="Execution fees" value-label="TOS per bucket" :format="(value) => `${value.toFixed(3)} TOS`" /></section>
        <section class="analytics-breakdown"><article class="surface"><h2>Contract composition</h2><dl class="detail-list"><div v-for="item in data.contracts" :key="item.kind"><dt>{{ item.kind }}</dt><dd>{{ formatInteger(item.count) }}</dd></div></dl></article><article class="surface"><h2>Asset composition</h2><dl class="detail-list"><div v-for="item in data.assets" :key="item.kind"><dt>{{ item.kind }}</dt><dd>{{ formatInteger(item.count) }}</dd></div></dl></article></section>
        <p class="surface evidence-note"><strong>Evidence boundary.</strong> Every point comes from canonical blocks and transactions already committed to the PostgreSQL projection. Missing history produces an empty interval; TOSCAN does not interpolate activity.</p>
      </template>
    </LoadState>
  </div>
</template>
