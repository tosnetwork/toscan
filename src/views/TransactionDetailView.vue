<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getTransaction } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatTos } from "@/utils/format";

const route = useRoute();
const identity = computed(() => `${route.params.account}:${route.params.lt}:${route.params.hash}`);
const { data, loading, error, refresh } = useAsyncData(() => getTransaction(
  String(route.params.account), String(route.params.lt), String(route.params.hash),
), [identity]);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/transactions">Transactions</RouterLink><AppIcon name="chevron" :size="13" /><span>{{ compact(String(route.params.hash)) }}</span></nav>
    <PageHeading title="Transaction" description="A committed account-state transition on TOS Network." eyebrow="Chain"><span class="status-badge" data-tone="positive">Success</span></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card">
          <span class="entity-glyph entity-glyph--transaction"><AppIcon name="transaction" :size="24" /></span>
          <div><small>Transaction hash</small><p class="mono">{{ data.hash }}</p></div><CopyButton :value="data.hash" label="transaction hash" />
        </section>
        <section class="detail-grid">
          <div class="surface detail-summary">
            <h2>Overview</h2>
            <dl class="detail-list">
              <div><dt>Status</dt><dd><span class="status-badge" data-tone="positive">Committed</span></dd></div>
              <div><dt>Account</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.account } }">{{ compact(data.account, 12, 10) }}</RouterLink></dd></div>
              <div><dt>Logical time</dt><dd class="mono">{{ data.lt }}</dd></div>
              <div><dt>Timestamp</dt><dd>{{ formatDate(data.time) }}</dd></div>
              <div><dt>Total fee</dt><dd>{{ formatTos(data.raw.fee) }} TOS</dd></div>
              <div><dt>Storage fee</dt><dd>{{ formatTos(data.raw.storage_fee) }} TOS</dd></div>
              <div><dt>Other fees</dt><dd>{{ formatTos(data.raw.other_fee) }} TOS</dd></div>
            </dl>
          </div>
          <div class="surface detail-hashes">
            <h2>Messages</h2>
            <div class="message-summary"><small>Inbound message</small><pre>{{ JSON.stringify(data.raw.in_msg ?? null, null, 2) }}</pre></div>
            <div class="message-summary"><small>Outbound messages</small><pre>{{ JSON.stringify(data.raw.out_msgs ?? [], null, 2) }}</pre></div>
          </div>
        </section>
        <details class="surface raw-details"><summary>Raw transaction response</summary><pre>{{ JSON.stringify(data.raw, null, 2) }}</pre></details>
      </template>
    </LoadState>
  </div>
</template>
