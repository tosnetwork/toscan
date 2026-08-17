<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getMessage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatTos } from "@/utils/format";

const route = useRoute();
const hash = computed(() => String(route.params.hash));
const { data, loading, error, refresh } = useAsyncData(() => getMessage(hash.value), [hash]);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/transactions">Transactions</RouterLink><AppIcon name="chevron" :size="13" /><span>{{ compact(hash) }}</span></nav>
    <PageHeading title="Message" description="Every indexed occurrence of this message across the transaction graph." eyebrow="Chain flow" />
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card">
          <span class="entity-glyph entity-glyph--transaction"><AppIcon name="transaction" :size="24" /></span>
          <div><small>Message hash</small><p class="mono">{{ data.hash }}</p></div><CopyButton :value="data.hash" label="message hash" />
        </section>
        <section class="surface page-surface">
          <header class="section-heading"><div><h2>Message path</h2><p>{{ data.occurrences.length }} indexed transaction occurrence{{ data.occurrences.length === 1 ? "" : "s" }}</p></div></header>
          <ol class="message-path">
            <li v-for="occurrence in data.occurrences" :key="`${occurrence.transaction_hash}:${occurrence.direction}`">
              <span class="flow-direction" :data-direction="occurrence.direction">{{ occurrence.direction === "in" ? "Consumed" : "Created" }}</span>
              <div class="flow-card">
                <header><strong>{{ occurrence.kind }} message</strong><span v-if="occurrence.created_at">{{ formatDate(occurrence.created_at) }}</span></header>
                <dl class="detail-list detail-list--compact">
                  <div v-if="occurrence.source"><dt>Source</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: occurrence.source } }">{{ compact(occurrence.source, 12, 10) }}</RouterLink></dd></div>
                  <div v-if="occurrence.destination"><dt>Destination</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: occurrence.destination } }">{{ compact(occurrence.destination, 12, 10) }}</RouterLink></dd></div>
                  <div><dt>Value</dt><dd>{{ occurrence.value ? `${formatTos(occurrence.value)} TOS` : "Not reported" }}</dd></div>
                  <div><dt>Transaction</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'transaction', params: { account: occurrence.account, lt: occurrence.transaction_lt, hash: occurrence.transaction_hash } }">{{ compact(occurrence.transaction_hash, 12, 10) }}</RouterLink></dd></div>
                  <div><dt>Block</dt><dd><RouterLink class="detail-link" :to="{ name: 'block', params: { workchain: occurrence.workchain, shard: occurrence.shard, seqno: occurrence.seqno } }">{{ occurrence.workchain }}:{{ compact(occurrence.shard, 7, 5) }}:{{ occurrence.seqno }}</RouterLink></dd></div>
                </dl>
              </div>
            </li>
          </ol>
        </section>
      </template>
    </LoadState>
  </div>
</template>
