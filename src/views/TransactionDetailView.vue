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
    <PageHeading title="Transaction" description="A transaction included in finalized TOS Network history." eyebrow="Chain"><span class="status-badge" data-tone="positive">Included</span></PageHeading>
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
              <div><dt>Chain status</dt><dd><span class="status-badge" data-tone="positive">Included</span></dd></div>
              <div><dt>Account</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.account } }">{{ compact(data.account, 12, 10) }}</RouterLink></dd></div>
              <div><dt>Logical time</dt><dd class="mono">{{ data.lt }}</dd></div>
              <div><dt>Timestamp</dt><dd>{{ formatDate(data.time) }}</dd></div>
              <div><dt>Total fee</dt><dd>{{ data.raw.fee ? `${formatTos(data.raw.fee)} TOS` : "Not reported" }}</dd></div>
              <div v-if="data.block"><dt>Block</dt><dd><RouterLink class="detail-link" :to="{ name: 'block', params: data.block }">{{ data.block.workchain }}:{{ compact(data.block.shard, 7, 5) }}:{{ data.block.seqno }}</RouterLink></dd></div>
              <div><dt>Inbound messages</dt><dd>{{ data.raw.in_msg ? 1 : 0 }}</dd></div>
              <div><dt>Outbound messages</dt><dd>{{ data.raw.out_msgs?.length ?? 0 }}</dd></div>
            </dl>
          </div>
          <div class="surface detail-hashes">
            <h2>Messages</h2>
            <div class="message-summary">
              <small>Inbound message</small>
              <template v-if="data.raw.in_msg">
                <p class="mono">{{ data.raw.in_msg.hash ?? "Hash unavailable" }}</p>
                <dl class="detail-list detail-list--compact">
                  <div><dt>Kind</dt><dd>{{ data.raw.in_msg.kind }}</dd></div>
                  <div v-if="data.raw.in_msg.source"><dt>From</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.raw.in_msg.source } }">{{ compact(data.raw.in_msg.source, 10, 8) }}</RouterLink></dd></div>
                  <div v-if="data.raw.in_msg.destination"><dt>To</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.raw.in_msg.destination } }">{{ compact(data.raw.in_msg.destination, 10, 8) }}</RouterLink></dd></div>
                  <div v-if="data.raw.in_msg.value"><dt>Value</dt><dd>{{ formatTos(data.raw.in_msg.value) }} TOS</dd></div>
                  <div v-if="data.raw.in_msg.created_lt"><dt>Created LT</dt><dd class="mono">{{ data.raw.in_msg.created_lt }}</dd></div>
                </dl>
              </template>
              <p v-else class="muted">No inbound message.</p>
            </div>
            <div class="message-summary">
              <small>Outbound messages · {{ data.raw.out_msgs?.length ?? 0 }}</small>
              <article v-for="(message, index) in data.raw.out_msgs ?? []" :key="message.hash ?? index" class="message-item">
                <p class="mono">{{ message.hash ?? `Message ${index + 1}` }}</p>
                <span>{{ message.kind }}<template v-if="message.value"> · {{ formatTos(message.value) }} TOS</template></span>
                <span v-if="message.destination">To <RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: message.destination } }">{{ compact(message.destination, 10, 8) }}</RouterLink></span>
              </article>
              <p v-if="!data.raw.out_msgs?.length" class="muted">No outbound messages.</p>
            </div>
          </div>
        </section>
        <details class="surface raw-details"><summary>Raw transaction response</summary><pre>{{ JSON.stringify(data.raw, null, 2) }}</pre></details>
      </template>
    </LoadState>
  </div>
</template>
