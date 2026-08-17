<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getGovernanceConfig } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger } from "@/utils/format";

const { data, loading, error, refresh } = useAsyncData(getGovernanceConfig, [], { refreshInterval: 30_000 });
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Governance configuration" description="Proof-backed network authority, protocol and validator configuration cells." eyebrow="On-chain governance"><button class="button button--secondary" type="button" @click="refresh"><AppIcon name="refresh" :size="17" />Refresh</button></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface governance-head"><div><small>Configuration observed at masterchain block</small><strong>#{{ formatInteger(data.seqno) }}</strong></div><RouterLink class="button button--secondary" to="/validators">View validator evidence</RouterLink></section>
        <section class="governance-grid">
          <article v-for="parameter in data.parameters" :key="parameter.id" class="surface governance-card">
            <header><span>#{{ parameter.id }}</span><div><h2>{{ parameter.name }}</h2><p>{{ parameter.description }}</p></div><span class="status-badge" :data-tone="parameter.bytes ? 'positive' : 'neutral'">{{ parameter.bytes ? 'Committed' : 'Absent' }}</span></header>
            <div v-if="parameter.bytes" class="config-cell"><small>Proof-extracted TVM cell BOC</small><p class="mono">{{ compact(parameter.bytes, 34, 22) }}</p><CopyButton :value="parameter.bytes" :label="`${parameter.name} cell`" /></div>
            <p v-else class="config-absent">This optional parameter is not committed at the observed block.</p>
          </article>
        </section>
        <aside class="truth-note"><strong>Proof boundary</strong><p>The node extracts each cell from masterchain state and configuration proofs. TOSCAN deliberately shows the raw commitment when it does not yet have a version-safe semantic decoder.</p></aside>
      </template>
    </LoadState>
  </div>
</template>
