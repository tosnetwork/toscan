<script setup lang="ts">
import { computed, ref } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getTasks } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatTos } from "@/utils/format";

const filter = ref("all");
const { data, loading, error, refresh } = useAsyncData(() => getTasks(100));
const tasks = computed(() => filter.value === "all" ? data.value ?? [] : data.value?.filter((task) => task.status === filter.value) ?? []);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Tasks" description="Escrow-backed work between people, agents, verifiers and services." eyebrow="AI economy">
      <select v-model="filter" class="filter-select" aria-label="Filter tasks by status"><option value="all">All statuses</option><option value="open">Open</option><option value="accepted">Accepted</option><option value="result_submitted">Result submitted</option><option value="settled">Settled</option><option value="disputed">Disputed</option></select>
    </PageHeading>
    <section class="surface page-surface">
      <div class="table-caption"><span>Task escrows</span><span>{{ tasks.length }} shown</span></div>
      <LoadState :loading="loading" :error="error" :empty="!tasks.length" empty-title="No matching tasks" @retry="refresh">
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Task</th><th>Budget</th><th>Assigned agent</th><th>Deadline</th><th>Status</th></tr></thead><tbody>
          <tr v-for="task in tasks" :key="task.address">
            <td><RouterLink class="table-entity" :to="{ name: 'address', params: { address: task.address } }"><span class="avatar avatar--task">T</span><span><strong>{{ task.name || "Unnamed task" }}</strong><small class="mono">{{ compact(task.address, 10, 7) }}</small></span></RouterLink></td>
            <td><strong>{{ formatTos(task.budget) }} TOS</strong></td>
            <td><RouterLink v-if="task.assigned_agent" class="mono detail-link" :to="{ name: 'address', params: { address: task.assigned_agent } }">{{ compact(task.assigned_agent) }}</RouterLink><span v-else>Unassigned</span></td>
            <td>{{ formatDate(task.deadline) }}</td><td><StatusBadge :status="task.status" /></td>
          </tr>
        </tbody></table></div>
      </LoadState>
    </section>
  </div>
</template>
