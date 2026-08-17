<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import WatchButton from "@/components/WatchButton.vue";
import { getIndexedContract } from "@/api/explorer";
import type { Dispute } from "@/api/types";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, timeAgo } from "@/utils/format";

const route = useRoute();
const address = computed(() => String(route.params.address));
const { data, loading, error, refresh } = useAsyncData(
  () => getIndexedContract<Dispute>("dispute", address.value),
  [address],
  { refreshInterval: 15_000 },
);
const fingerprint = computed(() => data.value ? JSON.stringify([data.value.updated_at, data.value.status, data.value.data]) : null);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/tasks">Tasks</RouterLink><AppIcon name="chevron" :size="13" /><span>Dispute {{ compact(address) }}</span></nav>
    <PageHeading title="Dispute" description="On-chain review of a contested autonomous-work outcome." eyebrow="Accountability"><div class="heading-actions"><StatusBadge :status="data?.data.status ?? 'indexed'" /><WatchButton kind="dispute" :identity="address" label="Dispute" :route="`/dispute/${address}`" :fingerprint="fingerprint" /></div></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh"><template v-if="data">
      <section class="surface transaction-hero-card"><span class="entity-glyph entity-glyph--transaction"><AppIcon name="task" :size="24" /></span><div><small>Dispute address</small><p class="mono">{{ data.address }}</p></div><CopyButton :value="data.address" label="dispute address" /></section>
      <section class="detail-grid">
        <div class="surface detail-summary"><h2>Parties and reviewer</h2><dl class="detail-list">
          <div><dt>Claimant</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.data.claimant } }">{{ compact(data.data.claimant, 12, 10) }}</RouterLink></dd></div>
          <div><dt>Respondent</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.data.respondent } }">{{ compact(data.data.respondent, 12, 10) }}</RouterLink></dd></div>
          <div><dt>Reviewer</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.data.reviewer } }">{{ compact(data.data.reviewer, 12, 10) }}</RouterLink></dd></div>
          <div><dt>Deadline</dt><dd>{{ formatDate(data.data.deadline) }}</dd></div>
        </dl></div>
        <div class="surface detail-summary"><h2>Ruling</h2><dl class="detail-list">
          <div><dt>Status</dt><dd><StatusBadge :status="data.data.status" /></dd></div>
          <div><dt>Ruling code</dt><dd>{{ data.data.ruling }}</dd></div>
          <div><dt>Claimant split</dt><dd>{{ (data.data.split_bps / 100).toFixed(2) }}%</dd></div>
          <div><dt>Subject commitment</dt><dd class="mono">{{ data.data.subject_hash }}</dd></div>
          <div><dt>Indexed</dt><dd>Block {{ formatInteger(data.last_seqno) }} · {{ timeAgo(data.updated_at) }}</dd></div>
        </dl></div>
      </section>
    </template></LoadState>
  </div>
</template>
