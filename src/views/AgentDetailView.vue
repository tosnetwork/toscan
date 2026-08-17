<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getIndexedContract } from "@/api/explorer";
import type { Agent } from "@/api/types";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger, formatTos, ratioPercent, timeAgo } from "@/utils/format";

const route = useRoute();
const address = computed(() => String(route.params.address));
const { data, loading, error, refresh } = useAsyncData(
  () => getIndexedContract<Agent>("agent_account", address.value),
  [address],
  { refreshInterval: 15_000 },
);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/agents">Agents</RouterLink><AppIcon name="chevron" :size="13" /><span>{{ compact(address) }}</span></nav>
    <PageHeading title="Agent Account" description="Persistent on-chain identity, controller and autonomous spending policy." eyebrow="AI economy">
      <StatusBadge :status="data?.status ?? 'indexed'" />
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card">
          <span class="entity-glyph entity-glyph--account"><AppIcon name="agent" :size="24" /></span>
          <div><small>Agent address</small><p class="mono">{{ data.address }}</p></div><CopyButton :value="data.address" label="agent address" />
        </section>
        <section class="detail-grid">
          <div class="surface detail-summary">
            <h2>Authority and policy</h2>
            <dl class="detail-list">
              <div><dt>Owner</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.data.owner } }">{{ compact(data.data.owner, 12, 10) }}</RouterLink></dd></div>
              <div><dt>Controller key</dt><dd class="mono">{{ data.data.controller_pubkey }}</dd></div>
              <div><dt>Sequence</dt><dd>{{ formatInteger(data.data.seqno) }}</dd></div>
              <div><dt>Default task timeout</dt><dd>{{ formatInteger(data.data.default_task_timeout_secs) }} seconds</dd></div>
              <div><dt>Last chain update</dt><dd>Block {{ formatInteger(data.last_seqno) }} · {{ timeAgo(data.updated_at) }}</dd></div>
            </dl>
          </div>
          <div class="surface detail-summary">
            <h2>Spending boundary</h2>
            <dl class="detail-list">
              <div><dt>Spent today</dt><dd><strong>{{ formatTos(data.data.spent_today) }} TOS</strong></dd></div>
              <div><dt>Maximum per transaction</dt><dd>{{ formatTos(data.data.max_per_tx) }} TOS</dd></div>
              <div><dt>Daily limit</dt><dd>{{ formatTos(data.data.daily_limit) }} TOS</dd></div>
              <div><dt>Spend day</dt><dd>{{ formatInteger(data.data.spend_day) }}</dd></div>
            </dl>
            <div class="policy-meter" :style="{ '--progress': `${Math.min(100, ratioPercent(data.data.spent_today, data.data.daily_limit))}%` }"><i></i></div>
          </div>
        </section>
        <section class="surface evidence-card">
          <h2>Committed metadata</h2>
          <div class="evidence-grid"><div><small>Metadata hash</small><p class="mono">{{ data.data.metadata_hash || 'Not committed' }}</p></div><div><small>Service endpoint hash</small><p class="mono">{{ data.data.service_endpoint_hash || 'Not committed' }}</p></div></div>
        </section>
      </template>
    </LoadState>
  </div>
</template>
