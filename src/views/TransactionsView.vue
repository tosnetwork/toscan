<script setup lang="ts">
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import TransactionRows from "@/components/TransactionRows.vue";
import { getTransactionsPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { useCursorPagination } from "@/composables/useCursorPagination";

const limit = 40;
const { cursor, offset, navigate } = useCursorPagination(limit);
const { data, loading, error, refresh } = useAsyncData(
  () => getTransactionsPage(offset.value, limit, cursor.value),
  [cursor],
  { refreshInterval: 10_000 },
);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Transactions" description="Recent account state changes observed in finalized blocks." eyebrow="Chain" />
    <section class="surface page-surface">
      <div class="table-caption"><span>Chain-wide activity</span><span>{{ data?.complete ? `${data.total.toLocaleString()} indexed` : "Rolling node window" }}</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.items.length" @retry="refresh"><TransactionRows :transactions="data?.items ?? []" /></LoadState>
      <PaginationBar v-if="data" :total="data.total" :offset="offset" :limit="data.limit" :complete="data.complete" cursor-mode :next-cursor="data.nextCursor" @navigate="(direction) => navigate(direction, data?.nextCursor)" />
    </section>
  </div>
</template>
