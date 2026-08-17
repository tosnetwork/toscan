<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import WatchButton from "@/components/WatchButton.vue";
import { getAssetActivityPage, getAssetHoldersPage, getCollectionItemsPage, getIndexedAsset, getToken } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger } from "@/utils/format";

const route = useRoute();
const address = computed(() => String(route.params.address));
const holderOffset = ref(0);
const itemOffset = ref(0);
const activityOffset = ref(0);
const pageLimit = 25;
const hint = computed(() => String(route.query.kind || ""));
const { data, loading, error, refresh } = useAsyncData(
  () => getToken(address.value, hint.value),
  [address, hint],
  { refreshInterval: 30_000 },
);
const { data: indexed } = useAsyncData(() => getIndexedAsset(address.value), [address]);
const { data: holders } = useAsyncData(() => getAssetHoldersPage(address.value, holderOffset.value, pageLimit), [address, holderOffset]);
const { data: items } = useAsyncData(() => getCollectionItemsPage(address.value, itemOffset.value, pageLimit), [address, itemOffset]);
const { data: activity } = useAsyncData(() => getAssetActivityPage(activityOffset.value, pageLimit, address.value), [address, activityOffset]);
const jetton = computed(() => data.value?.["@type"] === "ext.tokens.jettonMasterData" ? data.value : null);
const nft = computed(() => data.value?.["@type"] === "ext.tokens.nftItemData" ? data.value : null);
const collection = computed(() => data.value?.["@type"] === "ext.tokens.nftCollectionData" ? data.value : null);
const kind = computed(() => jetton.value ? "Jetton master" : nft.value ? "NFT item" : "NFT collection");
const fingerprint = computed(() => indexed.value ? JSON.stringify([indexed.value.updated_at, indexed.value.holder_count, indexed.value.data]) : null);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/assets">Assets</RouterLink><AppIcon name="chevron" :size="13" /><span>{{ kind }}</span></nav>
    <PageHeading :title="jetton?.jetton_name || kind" description="Node-authoritative token contract data and committed metadata." eyebrow="Assets">
      <div class="heading-actions"><StatusBadge :status="jetton?.mintable ? 'mintable' : nft?.init ? 'initialized' : 'on chain'" /><WatchButton kind="asset" :identity="address" :label="jetton?.jetton_name || kind" :route="`/token/${address}`" :fingerprint="fingerprint" /></div>
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card">
          <span class="asset-symbol" :class="{ 'asset-symbol--nft': !jetton }">{{ jetton ? 'J' : 'N' }}</span>
          <div><small>{{ kind }} address</small><p class="mono">{{ address }}</p></div>
          <CopyButton :value="address" label="token address" />
        </section>

        <section v-if="jetton" class="detail-grid">
          <div class="surface detail-summary"><h2>Supply and control</h2><dl class="detail-list">
            <div><dt>Symbol</dt><dd>{{ jetton.jetton_symbol || 'Not committed' }}</dd></div>
            <div><dt>Decimals</dt><dd>{{ jetton.jetton_decimals || 'Not committed' }}</dd></div>
            <div><dt>Total supply (raw)</dt><dd class="mono">{{ jetton.total_supply }}</dd></div>
            <div><dt>Mintable</dt><dd>{{ jetton.mintable ? 'Yes' : 'No' }}</dd></div>
            <div><dt>Administrator</dt><dd><RouterLink v-if="jetton.admin_address" class="mono detail-link" :to="{ name: 'address', params: { address: jetton.admin_address } }">{{ compact(jetton.admin_address, 12, 10) }}</RouterLink><span v-else>None</span></dd></div>
          </dl></div>
          <div class="surface detail-summary"><h2>On-chain metadata</h2><dl class="detail-list">
            <div><dt>Name</dt><dd>{{ jetton.jetton_name || 'Not committed' }}</dd></div>
            <div><dt>Description</dt><dd>{{ jetton.jetton_description || 'Not committed' }}</dd></div>
            <div><dt>Image reference</dt><dd class="mono">{{ jetton.jetton_image || 'Not committed' }}</dd></div>
          </dl></div>
        </section>

        <section v-else-if="nft" class="detail-grid">
          <div class="surface detail-summary"><h2>NFT state</h2><dl class="detail-list">
            <div><dt>Initialized</dt><dd>{{ nft.init ? 'Yes' : 'No' }}</dd></div>
            <div><dt>Collection index</dt><dd>{{ formatInteger(nft.index) }}</dd></div>
            <div><dt>Owner</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: nft.owner_address } }">{{ compact(nft.owner_address, 12, 10) }}</RouterLink></dd></div>
            <div><dt>Collection</dt><dd><RouterLink v-if="nft.collection_address" class="mono detail-link" :to="{ name: 'token', params: { address: nft.collection_address } }">{{ compact(nft.collection_address, 12, 10) }}</RouterLink><span v-else>Standalone</span></dd></div>
          </dl></div>
          <div class="surface evidence-card"><h2>Individual content commitment</h2><p class="mono raw-value">{{ nft.individual_content || 'No content cell' }}</p></div>
        </section>

        <section v-else-if="collection" class="detail-grid">
          <div class="surface detail-summary"><h2>Collection state</h2><dl class="detail-list">
            <div><dt>Next item index</dt><dd>{{ formatInteger(collection.next_item_index) }}</dd></div>
            <div><dt>Owner</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: collection.owner_address } }">{{ compact(collection.owner_address, 12, 10) }}</RouterLink></dd></div>
          </dl></div>
          <div class="surface evidence-card"><h2>Collection content commitment</h2><p class="mono raw-value">{{ collection.collection_content || 'No content cell' }}</p></div>
        </section>

        <section v-if="holders" class="surface page-surface asset-holders">
          <header class="section-heading"><div><h2>Observed holders</h2><p>{{ indexed?.holder_count ?? holders.total }} owners discovered from node-verified wallet positions</p></div></header>
          <div class="mini-list">
            <RouterLink v-for="holder in holders.items" :key="`${holder.owner_address}:${holder.position_address}`" :to="{ name: 'address', params: { address: holder.owner_address } }">
              <span><strong class="mono">{{ compact(holder.owner_address, 14, 12) }}</strong><small>{{ holder.kind.replace('_', ' ') }} position</small></span>
              <span><small>Last logical time</small><strong class="mono">{{ holder.last_lt }}</strong></span>
            </RouterLink>
            <p v-if="!holders.items.length" class="inline-empty">No owner positions are currently indexed.</p>
          </div>
          <PaginationBar :total="holders.total" :offset="holders.offset" :limit="holders.limit" :complete="holders.complete" @change="holderOffset = $event" />
        </section>

        <section v-if="collection && items" class="surface page-surface">
          <header class="section-heading"><div><h2>Collection items</h2><p>NFT items whose verified collection address points to this contract.</p></div></header>
          <div class="mini-list">
            <RouterLink v-for="item in items.items" :key="item.address" :to="`/token/${item.address}?kind=nft`"><span><strong class="mono">{{ compact(item.address, 14, 12) }}</strong><small>NFT item</small></span><span><small>Observed holders</small><strong>{{ item.holder_count }}</strong></span></RouterLink>
            <p v-if="!items.items.length" class="inline-empty">No collection items are currently indexed.</p>
          </div>
          <PaginationBar :total="items.total" :offset="items.offset" :limit="items.limit" :complete="items.complete" @change="itemOffset = $event" />
        </section>

        <section v-if="activity" class="surface page-surface">
          <header class="section-heading"><div><h2>Ownership observations</h2><p>Durable position appearance and removal records for this asset.</p></div><RouterLink class="detail-link" to="/assets/activity">All asset activity</RouterLink></header>
          <div class="mini-list">
            <article v-for="event in activity.items" :key="event.id"><span><StatusBadge :status="event.event_type" /><strong class="mono">{{ compact(event.owner_address, 14, 12) }}</strong></span><span><small>Logical time</small><strong class="mono">{{ event.last_lt }}</strong></span></article>
            <p v-if="!activity.items.length" class="inline-empty">No retained ownership changes are available yet.</p>
          </div>
          <PaginationBar :total="activity.total" :offset="activity.offset" :limit="activity.limit" :complete="activity.complete" @change="activityOffset = $event" />
        </section>

        <aside class="truth-note"><strong>Evidence boundary</strong><p>TOSCAN displays chain-returned metadata as text and never calls ownership observations “transfers” without a canonical decoded event that attributes source, destination and amount.</p></aside>
      </template>
    </LoadState>
  </div>
</template>
