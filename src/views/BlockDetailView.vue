<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import TransactionRows from "@/components/TransactionRows.vue";
import { getBlock, getBlockTransactionsPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger } from "@/utils/format";

const route = useRoute();
const identity = computed(() => `${route.params.workchain}:${route.params.shard}:${route.params.seqno}`);
const chainLabel = computed(() => Number(route.params.workchain) === -1 ? "Masterchain" : `Workchain ${route.params.workchain}`);
const { data, loading, error, refresh } = useAsyncData(() => getBlock(
  Number(route.params.workchain), String(route.params.shard), Number(route.params.seqno),
), [identity]);
const transactionOffset = ref(0);
const transactionLimit = 50;
const {
  data: transactionPage,
  loading: transactionsLoading,
  error: transactionsError,
  refresh: refreshTransactions,
} = useAsyncData(() => getBlockTransactionsPage(
  Number(route.params.workchain),
  String(route.params.shard),
  Number(route.params.seqno),
  transactionOffset.value,
  transactionLimit,
), [identity, transactionOffset]);
watch(identity, () => { transactionOffset.value = 0; });
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/blocks">Blocks</RouterLink><AppIcon name="chevron" :size="13" /><span>#{{ formatInteger(Number(route.params.seqno)) }}</span></nav>
    <PageHeading :title="`Block ${formatInteger(Number(route.params.seqno))}`" description="Finalized block and its indexed transactions." :eyebrow="chainLabel">
      <span v-if="data" class="status-badge" data-tone="positive">Finalized</span>
    </PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="detail-grid">
          <div class="surface detail-summary">
            <h2>Overview</h2>
            <dl class="detail-list">
              <div><dt>Sequence number</dt><dd>{{ formatInteger(data.summary.seqno) }}</dd></div>
              <div><dt>Generated</dt><dd>{{ formatDate(data.summary.time) }}</dd></div>
              <div><dt>Transactions</dt><dd>{{ transactionPage?.total ?? data.summary.txCount }}</dd></div>
              <div><dt>Workchain</dt><dd>{{ data.summary.workchain }}</dd></div>
              <div><dt>Shard</dt><dd class="mono">{{ data.summary.shard }}</dd></div>
              <div><dt>Logical time</dt><dd class="mono">{{ data.header.start_lt }} → {{ data.header.end_lt }}</dd></div>
              <div><dt>Key block</dt><dd>{{ data.header.is_key_block ? "Yes" : "No" }}</dd></div>
              <div><dt>Catchain seqno</dt><dd>{{ formatInteger(data.header.catchain_seqno) }}</dd></div>
            </dl>
          </div>
          <div class="surface detail-hashes">
            <h2>Identifiers</h2>
            <div class="hash-field"><small>Root hash</small><p class="mono">{{ data.summary.root_hash }}</p><CopyButton :value="data.summary.root_hash" label="root hash" /></div>
            <div class="hash-field"><small>File hash</small><p class="mono">{{ data.summary.file_hash }}</p><CopyButton :value="data.summary.file_hash" label="file hash" /></div>
            <div class="hash-field"><small>Validator list hash</small><p class="mono">{{ data.header.validator_list_hash_short }}</p></div>
            <div v-if="data.header.prev_blocks[0]" class="previous-block">
              <small>Previous block</small>
              <RouterLink :to="{ name: 'block', params: { workchain: data.header.prev_blocks[0].workchain, shard: data.header.prev_blocks[0].shard, seqno: data.header.prev_blocks[0].seqno } }">
                #{{ formatInteger(data.header.prev_blocks[0].seqno) }} · {{ compact(data.header.prev_blocks[0].root_hash) }} <AppIcon name="chevron" :size="14" />
              </RouterLink>
            </div>
          </div>
        </section>
        <section class="surface page-surface detail-transactions">
          <header class="section-heading"><div><h2>Transactions</h2><p>{{ transactionPage?.complete === false ? "A bounded node window" : "Complete indexed block history" }}</p></div><span>{{ transactionPage?.total ?? 0 }} indexed</span></header>
          <LoadState :loading="transactionsLoading" :error="transactionsError" :empty="!transactionPage?.items.length" @retry="refreshTransactions">
            <TransactionRows v-if="transactionPage?.items.length" :transactions="transactionPage.items" />
          </LoadState>
          <PaginationBar
            v-if="transactionPage"
            :total="transactionPage.total"
            :offset="transactionPage.offset"
            :limit="transactionPage.limit"
            :complete="transactionPage.complete"
            @change="(value) => transactionOffset = value"
          />
        </section>
      </template>
    </LoadState>
  </div>
</template>
