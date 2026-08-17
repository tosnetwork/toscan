<script setup lang="ts">
import { ref } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getServicesPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger, formatTos } from "@/utils/format";

const offset = ref(0);
const limit = 50;
const { data, loading, error, refresh } = useAsyncData(
  () => getServicesPage(offset.value, limit),
  [offset],
  { refreshInterval: 15_000 },
);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Services" description="Indexed Service Actor contracts that agents can call and pay." eyebrow="AI economy" />
    <section class="surface page-surface">
      <div class="table-caption"><span>Service actors</span><span>{{ data?.total ?? 0 }} indexed</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.items.length" empty-title="No service actors indexed" @retry="refresh">
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Service</th><th>Owner</th><th>Price / call</th><th>Capacity</th><th>Revenue counter</th><th>Status</th></tr></thead><tbody>
          <tr v-for="service in data?.items" :key="service.address">
            <td><RouterLink class="table-entity" :to="{ name: 'service', params: { address: service.address } }"><span class="avatar avatar--service">S</span><span><strong class="mono">{{ compact(service.address, 9, 7) }}</strong><small>{{ service.open_access ? "Open access" : "Restricted" }}</small></span></RouterLink></td>
            <td><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: service.owner } }">{{ compact(service.owner) }}</RouterLink></td>
            <td><strong>{{ formatTos(service.price_per_call) }} TOS</strong></td><td>{{ service.pending_count }} pending · {{ formatInteger(service.rate_limit_per_day) }}/day</td><td>{{ formatTos(service.withdrawable_revenue) }} TOS</td><td><StatusBadge :status="service.status" /></td>
          </tr>
        </tbody></table></div>
      </LoadState>
      <PaginationBar v-if="data" :total="data.total" :offset="data.offset" :limit="data.limit" :complete="data.complete" @change="offset = $event" />
    </section>
    <aside class="truth-note"><strong>Evidence boundary</strong><p>A Service Actor contract proves its on-chain price, access policy, requests and settlement state. It does not by itself prove which physical machine or model executed the off-chain work.</p></aside>
  </div>
</template>
