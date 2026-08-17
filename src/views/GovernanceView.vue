<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getGovernanceConfig, getGovernanceHistory } from "@/api/explorer";
import type { GovernanceSnapshot } from "@/api/types";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger } from "@/utils/format";

const { data, loading, error, refresh } = useAsyncData(getGovernanceConfig, [], { refreshInterval: 30_000 });
const { data: history } = useAsyncData(() => getGovernanceHistory(0, 50), [], { refreshInterval: 30_000 });

function changedParameters(snapshot: GovernanceSnapshot, older?: GovernanceSnapshot): number[] {
  if (!older) return snapshot.parameters.filter((item) => item.bytes).map((item) => item.id);
  const previous = new Map(older.parameters.map((item) => [item.id, item.bytes]));
  return snapshot.parameters.filter((item) => previous.get(item.id) !== item.bytes).map((item) => item.id);
}
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
        <section v-if="history" class="surface page-surface">
          <div class="table-caption"><span>Retained configuration history</span><span>{{ history.total }} snapshots</span></div>
          <div class="evidence-list">
            <article v-for="(snapshot, index) in history.items" :key="snapshot.observed_mc_seqno" class="evidence-row">
              <span class="entity-glyph entity-glyph--block"><AppIcon name="block" :size="17" /></span>
              <span><strong>Masterchain #{{ formatInteger(snapshot.observed_mc_seqno) }}</strong><small>{{ formatDate(snapshot.observed_at) }}</small></span>
              <span><small>Changed parameters</small><strong>{{ changedParameters(snapshot, history.items[index + 1]).length }}</strong></span>
              <span><small>Parameter IDs</small><strong class="mono">{{ changedParameters(snapshot, history.items[index + 1]).join(', ') || 'No change' }}</strong></span>
            </article>
            <p v-if="!history.items.length" class="inline-empty">No retained configuration snapshots are available yet.</p>
          </div>
        </section>
        <aside class="truth-note"><strong>Proof boundary</strong><p>The node extracts each cell from masterchain state and configuration proofs. TOSCAN deliberately shows the raw commitment when it does not yet have a version-safe semantic decoder.</p></aside>
        <aside class="truth-note"><strong>Governance attribution boundary</strong><p>This timeline proves configuration-cell changes. It does not invent proposal authors, off-chain deliberation or individual votes because those identities are not exposed by the currently indexed chain evidence.</p></aside>
      </template>
    </LoadState>
  </div>
</template>
