<script setup lang="ts">
import { ref } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getAssetActivityPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger } from "@/utils/format";

const offset = ref(0);
const kind = ref<"" | "jetton" | "nft_item">("");
const limit = 50;
const { data, loading, error, refresh } = useAsyncData(
  () => getAssetActivityPage(offset.value, limit, undefined, kind.value || undefined),
  [offset, kind],
);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Asset activity" description="Durably observed Jetton and NFT ownership-position changes." eyebrow="On-chain assets">
      <label class="select-control">Asset type<select v-model="kind" @change="offset = 0"><option value="">All</option><option value="jetton">Jetton</option><option value="nft_item">NFT</option></select></label>
    </PageHeading>
    <LoadState :loading="loading" :error="error" :empty="!data?.items.length" @retry="refresh">
      <section v-if="data?.items.length" class="surface page-surface">
        <div class="table-caption"><span>Ownership observations</span><span>{{ formatInteger(data.total) }} records</span></div>
        <div class="evidence-list">
          <article v-for="item in data.items" :key="item.id" class="evidence-row">
            <StatusBadge :status="item.event_type" />
            <span><strong><RouterLink class="detail-link mono" :to="`/token/${item.asset_address}`">{{ compact(item.asset_address, 13, 10) }}</RouterLink></strong><small>{{ item.kind.replace('_', ' ') }}</small></span>
            <span><small>Owner</small><RouterLink class="detail-link mono" :to="`/address/${item.owner_address}`">{{ compact(item.owner_address, 12, 9) }}</RouterLink></span>
            <span><small>Logical time</small><strong class="mono">{{ item.last_lt }}</strong></span>
            <span><small>Observed</small><strong>{{ formatDate(item.observed_at) }}</strong></span>
          </article>
        </div>
        <PaginationBar :total="data.total" :offset="data.offset" :limit="data.limit" :complete="data.complete" @change="offset = $event" />
      </section>
    </LoadState>
    <aside class="truth-note"><strong>Transfer evidence boundary</strong><p>This feed records node-verified ownership-position appearance and removal. TOSCAN does not label these observations as token transfers until TOS exposes a canonical decoded transfer event with attributable source, destination and amount.</p></aside>
  </div>
</template>
