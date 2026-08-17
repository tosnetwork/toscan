<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "@/components/AppIcon.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getEconomyStats } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { formatInteger, formatTos } from "@/utils/format";

const { data, loading, error, refresh } = useAsyncData(getEconomyStats, [], { refreshInterval: 15_000 });
const maxStatus = computed(() => Math.max(1, ...(data.value?.task_statuses.map((status) => status.count) ?? [1])));
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Agent economy" description="A chain-derived view of autonomous work, capacity, settlement and disputes." eyebrow="TOS economy"><button class="button button--secondary" type="button" @click="refresh"><AppIcon name="refresh" :size="17" />Refresh</button></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="metric-strip" aria-label="Agent economy summary">
          <div><small>Registered agents</small><strong>{{ formatInteger(data.agents) }}</strong><span>On-chain authorities</span></div>
          <div><small>Task budget</small><strong>{{ formatTos(data.total_task_budget) }}</strong><span>TOS committed to work</span></div>
          <div><small>Service revenue</small><strong>{{ formatTos(data.service_revenue) }}</strong><span>TOS withdrawable</span></div>
          <div><small>Disputes</small><strong>{{ formatInteger(data.disputes) }}</strong><span>Indexed proceedings</span></div>
        </section>
        <section class="detail-grid economy-grid">
          <div class="surface">
            <header class="section-heading"><div><h2>Task lifecycle</h2><p>Distribution of the complete indexed task set</p></div><RouterLink to="/tasks">Open tasks <AppIcon name="chevron" :size="15" /></RouterLink></header>
            <div class="status-bars">
              <div v-for="status in data.task_statuses" :key="status.status ?? 'unknown'" class="status-bar">
                <span>{{ status.status ?? "unknown" }}</span><div><i :style="{ width: `${status.count / maxStatus * 100}%` }"></i></div><strong>{{ formatInteger(status.count) }}</strong>
              </div>
              <p v-if="!data.task_statuses.length" class="inline-empty">No indexed task lifecycle data yet.</p>
            </div>
          </div>
          <div class="surface">
            <h2>Market structure</h2>
            <dl class="detail-list">
              <div><dt>All tasks</dt><dd>{{ formatInteger(data.tasks) }}</dd></div>
              <div><dt>Open tasks</dt><dd>{{ formatInteger(data.open_tasks) }}</dd></div>
              <div><dt>Settled tasks</dt><dd>{{ formatInteger(data.settled_tasks) }}</dd></div>
              <div><dt>Service actors</dt><dd>{{ formatInteger(data.services) }}</dd></div>
              <div><dt>Settlement rate</dt><dd>{{ data.tasks ? `${(data.settled_tasks / data.tasks * 100).toFixed(1)}%` : "—" }}</dd></div>
            </dl>
            <p class="data-provenance">These totals are calculated from contracts the configured TOS indexer has durably projected. They are measurements, not estimates.</p>
          </div>
        </section>
      </template>
    </LoadState>
  </div>
</template>
