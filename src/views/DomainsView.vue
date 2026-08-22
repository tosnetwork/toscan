<script setup lang="ts">
import { computed, ref, watch } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getDnsDomainsPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger } from "@/utils/format";

const status = ref("");
const safe = ref("");
const offset = ref(0);
const limit = 50;
const dependency = computed(() => `${status.value}:${safe.value}:${offset.value}`);
const { data, loading, error, refresh } = useAsyncData(
  () => getDnsDomainsPage(offset.value, limit, status.value || undefined,
    safe.value === "" ? undefined : safe.value === "true"),
  [dependency],
);
watch([status, safe], () => { offset.value = 0; });
</script>

<template>
  <div class="container page-container">
    <PageHeading title=".tos domains" description="Canonical Domain Items observed at finalized masterchain checkpoints." eyebrow="TOS DNS">
      <div class="heading-actions">
        <select v-model="status" class="filter-select" aria-label="Filter DNS lifecycle"><option value="">All lifecycle states</option><option value="auction">Auction</option><option value="auction-ended-unfinalized">Ended, unfinalized</option><option value="leased">Leased</option><option value="releasable">Releasable</option></select>
        <select v-model="safe" class="filter-select" aria-label="Filter resolution safety"><option value="">All records</option><option value="true">Safe to resolve</option><option value="false">Unsafe to resolve</option></select>
      </div>
    </PageHeading>
    <section class="surface page-surface">
      <LoadState :loading="loading" :error="error" :empty="Boolean(data && !data.items.length)" empty-title="No .tos domains indexed yet" @retry="refresh">
        <template v-if="data?.items.length">
          <div class="table-caption"><span>{{ formatInteger(data.total) }} canonical domains</span><span>Checkpoint-bound history</span></div>
          <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Lifecycle</th><th>Owner</th><th>Renewal deadline</th><th>Checkpoint</th></tr></thead><tbody>
            <tr v-for="domain in data.items" :key="domain.address">
              <td><RouterLink class="table-entity" :to="{ name: 'domain', params: { name: domain.name } }"><span><strong>{{ domain.name }}</strong><small class="mono">{{ compact(domain.address, 12, 10) }}</small></span></RouterLink></td>
              <td><StatusBadge :status="domain.status" /></td>
              <td class="mono">{{ domain.owner ? compact(domain.owner, 10, 8) : 'Unassigned' }}</td>
              <td>{{ domain.renewal_deadline ? formatDate(domain.renewal_deadline) : 'After finalization' }}</td>
              <td>#{{ formatInteger(domain.observed_mc_seqno) }}</td>
            </tr>
          </tbody></table></div>
          <PaginationBar :offset="offset" :limit="data.limit" :total="data.total" :complete="data.complete" @change="(nextOffset) => { offset = nextOffset; }" />
        </template>
      </LoadState>
    </section>
    <aside class="truth-note"><strong>Authority boundary</strong><p>A name is discovery metadata, never identity or authorization. “Safe to resolve” means only that the Domain Item is finalized and within its inherited 366-day renewal window at the displayed checkpoint.</p></aside>
  </div>
</template>
