<script setup lang="ts">
import { computed, ref, watch } from "vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import { getAssetsPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { useCursorPagination } from "@/composables/useCursorPagination";
import { compact, formatInteger, timeAgo } from "@/utils/format";

const kind = ref("");
const limit = 50;
const pagination = useCursorPagination(limit);
const dependency = computed(() => `${kind.value}:${pagination.cursor.value ?? "first"}`);
const { data, loading, error, refresh } = useAsyncData(
  () => getAssetsPage(pagination.offset.value, limit, kind.value || undefined, pagination.cursor.value),
  [dependency],
);
watch(kind, () => pagination.reset());
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Assets" description="Jetton masters, NFT items and collections discovered from verified account positions." eyebrow="On-chain assets">
      <select v-model="kind" class="filter-select" aria-label="Filter asset kind"><option value="">All assets</option><option value="jetton">Jettons</option><option value="nft_item">NFT items</option><option value="nft_collection">NFT collections</option></select>
    </PageHeading>
    <section class="surface page-surface">
      <LoadState :loading="loading" :error="error" :empty="Boolean(data && !data.items.length)" empty-title="No assets discovered yet" @retry="refresh">
        <template v-if="data?.items.length">
          <div class="table-caption"><span>{{ formatInteger(data.total) }} indexed assets</span><span>Position-backed discovery</span></div>
          <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Asset</th><th>Kind</th><th>Holders</th><th>Last discovered</th></tr></thead><tbody>
            <tr v-for="asset in data.items" :key="asset.address">
              <td><RouterLink class="table-entity" :to="{ name: 'token', params: { address: asset.address } }"><span class="asset-symbol" :class="{ 'asset-symbol--nft': asset.kind !== 'jetton' }">{{ asset.kind === 'jetton' ? 'J' : 'N' }}</span><span><strong>{{ String(asset.data.jetton_name ?? (asset.kind === 'jetton' ? 'Jetton master' : asset.kind === 'nft_item' ? 'NFT item' : 'NFT collection')) }}</strong><small class="mono">{{ compact(asset.address, 12, 10) }}</small></span></RouterLink></td>
              <td>{{ asset.kind.replace('_', ' ') }}</td><td>{{ formatInteger(asset.holder_count) }}</td><td>{{ timeAgo(asset.updated_at) }}</td>
            </tr>
          </tbody></table></div>
          <PaginationBar :offset="pagination.offset.value" :limit="data.limit" :total="data.total" :complete="data.complete" cursor-mode :next-cursor="data.nextCursor" @navigate="(direction) => pagination.navigate(direction, data?.nextCursor)" />
        </template>
      </LoadState>
    </section>
    <aside class="truth-note"><strong>Discovery boundary</strong><p>An asset appears here only after the node has verified a wallet position or recognized the asset contract. TOSCAN does not infer token identity from names, images or untrusted metadata.</p></aside>
  </div>
</template>
