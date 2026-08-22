<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { getDnsDomain } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger } from "@/utils/format";

const route = useRoute();
const name = computed(() => String(route.params.name));
const { data, loading, error, refresh } = useAsyncData(() => getDnsDomain(name.value), [name]);
</script>

<template>
  <div class="container page-container">
    <PageHeading :title="name" description="Auction, ownership, renewal and record-commitment history for one canonical Domain Item." eyebrow="TOS DNS" />
    <LoadState :loading="loading" :error="error" :empty="!data" empty-title="Domain not indexed" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card"><div><small>Permanent Domain Item address</small><p class="mono">{{ data.current.address }}</p></div><CopyButton :value="data.current.address" label="Domain Item address" /></section>
        <section class="detail-grid">
          <div class="surface detail-summary"><h2>Current lifecycle</h2><dl class="detail-list">
            <div><dt>Status</dt><dd><StatusBadge :status="data.current.status" /></dd></div>
            <div><dt>Owner</dt><dd><RouterLink v-if="data.current.owner" class="detail-link mono" :to="`/address/${data.current.owner}`">{{ data.current.owner }}</RouterLink><span v-else>Unassigned</span></dd></div>
            <div><dt>Last top-up / bid</dt><dd>{{ formatDate(data.current.data.last_fill_up_time) }}</dd></div>
            <div><dt>Renewal deadline</dt><dd>{{ data.current.renewal_deadline ? formatDate(data.current.renewal_deadline) : 'Unavailable during auction' }}</dd></div>
          </dl></div>
          <div class="surface detail-summary"><h2>Checkpoint provenance</h2><dl class="detail-list">
            <div><dt>Masterchain</dt><dd>#{{ formatInteger(data.current.observed_mc_seqno) }}</dd></div>
            <div><dt>Observed at</dt><dd>{{ formatDate(data.current.observed_at) }}</dd></div>
            <div><dt>Root hash</dt><dd class="mono raw-value">{{ data.current.root_hash }}</dd></div>
            <div><dt>File hash</dt><dd class="mono raw-value">{{ data.current.file_hash }}</dd></div>
          </dl></div>
        </section>
        <section class="surface page-surface"><div class="table-caption"><span>State history</span><span>{{ data.history.length }} observed transitions</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Checkpoint</th><th>Owner / bidder</th><th>Auction end</th><th>Renewal deadline</th><th>Record commitment</th></tr></thead><tbody>
          <tr v-for="entry in data.history" :key="`${entry.observed_mc_seqno}:${entry.address}`"><td>#{{ formatInteger(entry.observed_mc_seqno) }}<br><small>{{ formatDate(entry.observed_at) }}</small></td><td class="mono">{{ compact(entry.data.owner ?? entry.data.max_bid_address ?? 'unassigned', 10, 8) }}</td><td>{{ entry.data.auction_end_time ? formatDate(entry.data.auction_end_time) : 'Finalized' }}</td><td>{{ entry.data.renewal_deadline ? formatDate(entry.data.renewal_deadline) : '—' }}</td><td class="mono">{{ compact(entry.data.content_hash, 12, 10) }}</td></tr>
        </tbody></table></div></section>
        <aside class="truth-note"><strong>Records are not authority</strong><p>The content hash proves which record dictionary the Item committed to. Security-sensitive clients must still use the quorum resolver and re-derive Native object identity; TOSCAN display is not a signing or payment confirmation.</p></aside>
      </template>
    </LoadState>
  </div>
</template>
