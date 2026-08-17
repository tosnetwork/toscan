<script setup lang="ts">
import { ref } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getAgentsPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger, formatTos } from "@/utils/format";

const offset = ref(0);
const limit = 50;
const { data, loading, error, refresh } = useAsyncData(
  () => getAgentsPage(offset.value, limit),
  [offset],
  { refreshInterval: 20_000 },
);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Agents" description="Chain-wide Agent Accounts with owner, controller and spending boundaries." eyebrow="AI economy">
      <span class="source-label">Contract index</span>
    </PageHeading>
    <section class="surface page-surface">
      <div class="table-caption"><span>Agent accounts</span><span>{{ data?.total ?? 0 }} indexed</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.items.length" empty-title="No Agent Accounts indexed" @retry="refresh">
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Agent</th><th>Owner</th><th>Spent today</th><th>Daily limit</th><th>Active tasks</th><th>Status</th></tr></thead><tbody>
          <tr v-for="agent in data?.items" :key="agent.address">
            <td><RouterLink class="table-entity" :to="{ name: 'agent', params: { address: agent.address } }"><span class="avatar avatar--agent">AI</span><span><strong class="mono">{{ compact(agent.address, 9, 7) }}</strong><small>Seqno {{ formatInteger(agent.seqno) }}</small></span></RouterLink></td>
            <td><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: agent.owner } }">{{ compact(agent.owner) }}</RouterLink></td>
            <td>{{ formatTos(agent.spent_today) }} TOS</td><td>{{ formatTos(agent.daily_limit) }} TOS</td><td>{{ agent.activeTasks ?? 0 }}</td><td><StatusBadge status="active" /></td>
          </tr>
        </tbody></table></div>
      </LoadState>
      <PaginationBar v-if="data" :total="data.total" :offset="data.offset" :limit="data.limit" :complete="data.complete" @change="offset = $event" />
    </section>
    <aside class="truth-note"><strong>Discovery scope</strong><p>Agent Accounts are classified by their on-chain code hash while the indexer walks every shard. Full state remains authoritative on the TOS node; this listing is the durable discovery layer.</p></aside>
  </div>
</template>
