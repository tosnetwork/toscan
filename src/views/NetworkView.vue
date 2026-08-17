<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import BlockRows from "@/components/BlockRows.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getExplorerStatus, getHome } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { formatInteger, timeAgo } from "@/utils/format";

const { data, loading, error, refresh } = useAsyncData(getHome, [], { refreshInterval: 10_000 });
const { data: indexStatus, refresh: refreshIndex } = useAsyncData(getExplorerStatus, [], { refreshInterval: 10_000 });
const networkName = (import.meta.env.VITE_TOS_NETWORK || "mainnet").toUpperCase();
function refreshAll() { void refresh(); void refreshIndex(); }
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Network" description="Current chain tip, durable index progress, consensus evidence and source health." eyebrow="Observability"><div class="heading-actions"><RouterLink class="button button--secondary" to="/analytics">Analytics</RouterLink><RouterLink class="button button--secondary" to="/validators">Validators</RouterLink><RouterLink class="button button--secondary" to="/governance">Governance</RouterLink><button class="button button--secondary" type="button" @click="refreshAll"><AppIcon name="refresh" :size="17" />Refresh</button></div></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="network-overview">
          <div class="surface network-state"><span class="network-pulse"><i></i><i></i><b></b></span><div><small>Configured network</small><h2>{{ networkName }}</h2><p>Chain data is read directly from the configured TOS JSON-RPC node.</p></div><span class="status-badge" data-tone="positive">Connected</span></div>
          <div class="surface network-metric"><small>Chain tip</small><strong>{{ formatInteger(data.blocks[0]?.seqno) }}</strong><span>{{ timeAgo(data.blocks[0]?.time) }}</span></div>
          <div class="surface network-metric"><small>Consensus block</small><strong>{{ formatInteger(data.consensusBlock ?? undefined) }}</strong><span>Node-reported</span></div>
          <div class="surface network-metric"><small>Observed signers</small><strong>{{ formatInteger(data.signers ?? undefined) }}</strong><span>Proof-chain signatures</span></div>
        </section>
        <section v-if="indexStatus" class="index-health" aria-label="Explorer index health">
          <div class="surface"><small>Indexed blocks</small><strong>{{ formatInteger(indexStatus.blocks) }}</strong><span>{{ formatInteger(indexStatus.transactions) }} transactions</span></div>
          <div class="surface"><small>Indexed contracts</small><strong>{{ formatInteger(indexStatus.contracts) }}</strong><span>Recognized TOS contracts</span></div>
          <div class="surface"><small>Masterchain lag</small><strong>{{ formatInteger(indexStatus.masterchain_lag ?? undefined) }}</strong><span>{{ indexStatus.masterchain_lag === 0 ? 'Fully caught up' : 'Blocks behind head' }}</span></div>
          <div class="surface"><small>Last indexed</small><strong>{{ timeAgo(indexStatus.latest_indexed_at ?? undefined) }}</strong><span>{{ indexStatus.checkpoints.length }} shard checkpoints</span></div>
        </section>
        <section class="surface page-surface">
          <header class="section-heading"><div><h2>Recent finality</h2><p>Masterchain blocks in the current polling window</p></div><span class="live-label"><i></i>Current</span></header>
          <BlockRows :blocks="data.blocks" />
        </section>
        <section class="provenance-grid">
          <article class="surface"><span class="feature-icon"><AppIcon name="network" :size="20" /></span><h3>Chain-reported</h3><p>Block identifiers, account state and transaction records come from the configured node’s local liteserver state.</p></article>
          <article class="surface"><span class="feature-icon"><AppIcon name="block" :size="20" /></span><h3>Reconstructed consensus</h3><p>Signer counts reflect signatures recovered from proof links. They are not a live catchain telemetry stream.</p></article>
          <article class="surface"><span class="feature-icon"><AppIcon name="agent" :size="20" /></span><h3>Indexer-observed AI</h3><p>Task and service listings reflect the configured tosctld indexer’s coverage and checkpoint.</p></article>
        </section>
      </template>
    </LoadState>
  </div>
</template>
