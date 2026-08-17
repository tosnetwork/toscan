<script setup lang="ts">
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getAgents } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger, formatTos } from "@/utils/format";

const { data, loading, error, refresh } = useAsyncData(() => getAgents(100));
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Agents" description="Agent Accounts referenced by indexed tasks, with live spending boundaries." eyebrow="AI economy">
      <span class="source-label">Derived from task index</span>
    </PageHeading>
    <section class="surface page-surface">
      <div class="table-caption"><span>Agent accounts</span><span>{{ data?.length ?? 0 }} discovered</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.length" empty-title="No assigned agents discovered" @retry="refresh">
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Agent</th><th>Owner</th><th>Spent today</th><th>Daily limit</th><th>Active tasks</th><th>Status</th></tr></thead><tbody>
          <tr v-for="agent in data" :key="agent.address">
            <td><RouterLink class="table-entity" :to="{ name: 'address', params: { address: agent.address } }"><span class="avatar avatar--agent">AI</span><span><strong class="mono">{{ compact(agent.address, 9, 7) }}</strong><small>Seqno {{ formatInteger(agent.seqno) }}</small></span></RouterLink></td>
            <td><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: agent.owner } }">{{ compact(agent.owner) }}</RouterLink></td>
            <td>{{ formatTos(agent.spent_today) }} TOS</td><td>{{ formatTos(agent.daily_limit) }} TOS</td><td>{{ agent.activeTasks ?? 0 }}</td><td><StatusBadge status="active" /></td>
          </tr>
        </tbody></table></div>
      </LoadState>
    </section>
    <aside class="truth-note"><strong>Discovery scope</strong><p>The current API does not enumerate every Agent Account chain-wide. TOSCAN derives this list from agents assigned to tasks returned by the configured indexer, then reads each account’s authoritative contract state.</p></aside>
  </div>
</template>
