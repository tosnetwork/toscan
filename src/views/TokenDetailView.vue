<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getIndexedAsset, getToken } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger } from "@/utils/format";

const route = useRoute();
const address = computed(() => String(route.params.address));
const hint = computed(() => String(route.query.kind || ""));
const { data, loading, error, refresh } = useAsyncData(
  () => getToken(address.value, hint.value),
  [address, hint],
  { refreshInterval: 30_000 },
);
const { data: indexed } = useAsyncData(() => getIndexedAsset(address.value), [address]);
const jetton = computed(() => data.value?.["@type"] === "ext.tokens.jettonMasterData" ? data.value : null);
const nft = computed(() => data.value?.["@type"] === "ext.tokens.nftItemData" ? data.value : null);
const collection = computed(() => data.value?.["@type"] === "ext.tokens.nftCollectionData" ? data.value : null);
const kind = computed(() => jetton.value ? "Jetton master" : nft.value ? "NFT item" : "NFT collection");
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/assets">Assets</RouterLink><AppIcon name="chevron" :size="13" /><span>{{ kind }}</span></nav>
    <PageHeading :title="jetton?.jetton_name || kind" description="Node-authoritative token contract data and committed metadata." eyebrow="Assets">
      <StatusBadge :status="jetton?.mintable ? 'mintable' : nft?.init ? 'initialized' : 'on chain'" />
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

        <section v-if="indexed" class="surface page-surface asset-holders">
          <header class="section-heading"><div><h2>Observed holders</h2><p>{{ indexed.holder_count }} owners discovered from node-verified wallet positions</p></div></header>
          <div class="mini-list">
            <RouterLink v-for="holder in indexed.holders" :key="holder.owner_address" :to="{ name: 'address', params: { address: holder.owner_address } }">
              <span><strong class="mono">{{ compact(holder.owner_address, 14, 12) }}</strong><small>{{ holder.kind.replace('_', ' ') }} position</small></span>
              <span><small>Last logical time</small><strong class="mono">{{ holder.last_lt }}</strong></span>
            </RouterLink>
            <p v-if="!indexed.holders.length" class="inline-empty">No owner positions are currently indexed.</p>
          </div>
        </section>

        <aside class="truth-note"><strong>Metadata safety</strong><p>TOSCAN displays the chain-returned metadata reference as text and does not automatically load untrusted remote token images.</p></aside>
      </template>
    </LoadState>
  </div>
</template>
