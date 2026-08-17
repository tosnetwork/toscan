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
import type { Task } from "@/api/types";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, formatTos, timeAgo } from "@/utils/format";

const lifecycle = ["open", "accepted", "result_submitted", "settled"];
const route = useRoute();
const address = computed(() => String(route.params.address));
const { data, loading, error, refresh } = useAsyncData(
  () => getIndexedContract<Task>("task_escrow", address.value),
  [address],
  { refreshInterval: 12_000 },
);
const reached = (step: string) => data.value ? lifecycle.indexOf(step) <= lifecycle.indexOf(data.value.data.status) : false;
const fingerprint = computed(() => data.value ? JSON.stringify([data.value.updated_at, data.value.status, data.value.data]) : null);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/tasks">Tasks</RouterLink><AppIcon name="chevron" :size="13" /><span>{{ compact(address) }}</span></nav>
    <PageHeading :title="data?.data.name || 'Task Escrow'" description="Escrow-backed work from creation through evidence, review and settlement." eyebrow="Autonomous work"><div class="heading-actions"><StatusBadge :status="data?.data.status ?? 'indexed'" /><WatchButton kind="task" :identity="address" :label="data?.data.name || 'Task Escrow'" :route="`/task/${address}`" :fingerprint="fingerprint" /></div></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card"><span class="entity-glyph"><AppIcon name="task" :size="24" /></span><div><small>Task Escrow address</small><p class="mono">{{ data.address }}</p></div><CopyButton :value="data.address" label="task address" /></section>
        <ol class="surface lifecycle" aria-label="Task lifecycle">
          <li v-for="step in lifecycle" :key="step" :class="{ reached: reached(step), current: data.data.status === step }"><i></i><span>{{ step.replace('_', ' ') }}</span></li>
        </ol>
        <section class="detail-grid">
          <div class="surface detail-summary"><h2>Commercial terms</h2><dl class="detail-list">
            <div><dt>Budget</dt><dd><strong>{{ formatTos(data.data.budget) }} TOS</strong></dd></div>
            <div><dt>Creator</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.data.creator } }">{{ compact(data.data.creator, 12, 10) }}</RouterLink></dd></div>
            <div><dt>Assigned agent</dt><dd><RouterLink v-if="data.data.assigned_agent" class="mono detail-link" :to="{ name: 'agent', params: { address: data.data.assigned_agent } }">{{ compact(data.data.assigned_agent, 12, 10) }}</RouterLink><span v-else>Unassigned</span></dd></div>
            <div><dt>Verifier</dt><dd><RouterLink v-if="data.data.verifier" class="mono detail-link" :to="{ name: 'address', params: { address: data.data.verifier } }">{{ compact(data.data.verifier, 12, 10) }}</RouterLink><span v-else>None</span></dd></div>
            <div><dt>Deadline</dt><dd>{{ formatDate(data.data.deadline) }}</dd></div>
            <div><dt>Review deadline</dt><dd>{{ formatDate(data.data.review_deadline) }}</dd></div>
          </dl></div>
          <div class="surface detail-summary"><h2>Chain evidence</h2><dl class="detail-list">
            <div><dt>Result hash</dt><dd class="mono">{{ data.data.result_hash || 'Not submitted' }}</dd></div>
            <div><dt>Evidence hash</dt><dd class="mono">{{ data.data.evidence_hash || 'Not submitted' }}</dd></div>
            <div><dt>Settlement policy</dt><dd class="mono">{{ data.data.settlement_policy_hash || 'Not committed' }}</dd></div>
            <div><dt>Permission</dt><dd class="mono">{{ data.data.permission_hash || 'Not committed' }}</dd></div>
            <div><dt>Dispute</dt><dd class="mono">{{ data.data.dispute_hash || 'None' }}</dd></div>
            <div><dt>Indexed</dt><dd>Block {{ formatInteger(data.last_seqno) }} · {{ timeAgo(data.updated_at) }}</dd></div>
          </dl></div>
        </section>
      </template>
    </LoadState>
  </div>
</template>
