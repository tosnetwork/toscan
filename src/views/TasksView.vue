<script setup lang="ts">
import { ref, watch } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getTasksPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { useCursorPagination } from "@/composables/useCursorPagination";
import { compact, formatDate, formatTos } from "@/utils/format";

const filter = ref("all");
const limit = 50;
const { cursor, offset, navigate, reset } = useCursorPagination(limit);
const { data, loading, error, refresh } = useAsyncData(
  () => getTasksPage(offset.value, limit, filter.value === "all" ? undefined : filter.value, cursor.value),
  [cursor, filter],
  { refreshInterval: 15_000 },
);
watch(filter, reset);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Tasks" description="Escrow-backed work between people, agents, verifiers and services." eyebrow="AI economy">
      <div class="heading-actions"><RouterLink class="button button--secondary" to="/disputes">Disputes</RouterLink><select v-model="filter" class="filter-select" aria-label="Filter tasks by status"><option value="all">All statuses</option><option value="open">Open</option><option value="accepted">Accepted</option><option value="result_submitted">Result submitted</option><option value="settled">Settled</option><option value="disputed">Disputed</option></select></div>
    </PageHeading>
    <section class="surface page-surface">
      <div class="table-caption"><span>Task escrows</span><span>{{ data?.total ?? 0 }} indexed</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.items.length" empty-title="No matching tasks" @retry="refresh">
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Task</th><th>Budget</th><th>Assigned agent</th><th>Deadline</th><th>Status</th></tr></thead><tbody>
          <tr v-for="task in data?.items" :key="task.address">
            <td><RouterLink class="table-entity" :to="{ name: 'task', params: { address: task.address } }"><span class="avatar avatar--task">T</span><span><strong>{{ task.name || "Unnamed task" }}</strong><small class="mono">{{ compact(task.address, 10, 7) }}</small></span></RouterLink></td>
            <td><strong>{{ formatTos(task.budget) }} TOS</strong></td>
            <td><RouterLink v-if="task.assigned_agent" class="mono detail-link" :to="{ name: 'agent', params: { address: task.assigned_agent } }">{{ compact(task.assigned_agent) }}</RouterLink><span v-else>Unassigned</span></td>
            <td>{{ formatDate(task.deadline) }}</td><td><StatusBadge :status="task.status" /></td>
          </tr>
        </tbody></table></div>
      </LoadState>
      <PaginationBar v-if="data" :total="data.total" :offset="offset" :limit="data.limit" :complete="data.complete" cursor-mode :next-cursor="data.nextCursor" @navigate="(direction) => navigate(direction, data?.nextCursor)" />
    </section>
  </div>
</template>
