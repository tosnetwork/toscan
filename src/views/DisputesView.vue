<script setup lang="ts">
import { ref } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getDisputesPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate } from "@/utils/format";

const offset = ref(0);
const limit = 50;
const { data, loading, error, refresh } = useAsyncData(
  () => getDisputesPage(offset.value, limit),
  [offset],
  { refreshInterval: 20_000 },
);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/tasks">Tasks</RouterLink><span>·</span><span>Disputes</span></nav>
    <PageHeading title="Disputes" description="Contested autonomous-work outcomes and their accountable review state." eyebrow="AI economy" />
    <section class="surface page-surface">
      <div class="table-caption"><span>Dispute contracts</span><span>{{ data?.total ?? 0 }} indexed</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.items.length" empty-title="No disputes indexed" @retry="refresh">
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Dispute</th><th>Claimant</th><th>Respondent</th><th>Reviewer</th><th>Deadline</th><th>Status</th></tr></thead><tbody>
          <tr v-for="dispute in data?.items" :key="dispute.address">
            <td><RouterLink class="table-entity" :to="{ name: 'dispute', params: { address: dispute.address } }"><span class="avatar avatar--task">D</span><span><strong class="mono">{{ compact(dispute.address, 9, 7) }}</strong><small class="mono">{{ compact(dispute.subject_hash) }}</small></span></RouterLink></td>
            <td><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: dispute.claimant } }">{{ compact(dispute.claimant) }}</RouterLink></td>
            <td><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: dispute.respondent } }">{{ compact(dispute.respondent) }}</RouterLink></td>
            <td><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: dispute.reviewer } }">{{ compact(dispute.reviewer) }}</RouterLink></td>
            <td>{{ formatDate(dispute.deadline) }}</td>
            <td><StatusBadge :status="dispute.status" /></td>
          </tr>
        </tbody></table></div>
      </LoadState>
      <PaginationBar v-if="data" :total="data.total" :offset="data.offset" :limit="data.limit" :complete="data.complete" @change="offset = $event" />
    </section>
  </div>
</template>
