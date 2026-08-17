<script setup lang="ts">
import BlockRows from "@/components/BlockRows.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import { getBlocksPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { useCursorPagination } from "@/composables/useCursorPagination";

const limit = 20;
const { cursor, offset, navigate } = useCursorPagination(limit);
const { data, loading, error, refresh } = useAsyncData(
  () => getBlocksPage(offset.value, limit, cursor.value),
  [cursor],
  { refreshInterval: 10_000 },
);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Blocks" description="Finalized blocks across all indexed shards, newest first." eyebrow="Chain" />
    <section class="surface page-surface">
      <div class="table-caption"><span>All indexed shards</span><span>{{ data?.total?.toLocaleString() ?? "—" }} blocks</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.items.length" @retry="refresh"><BlockRows :blocks="data?.items ?? []" /></LoadState>
      <PaginationBar
        v-if="data"
        :total="data.total"
        :offset="offset"
        :limit="data.limit"
        :complete="data.complete"
        cursor-mode
        :next-cursor="data.nextCursor"
        @navigate="(direction) => navigate(direction, data?.nextCursor)"
      />
    </section>
  </div>
</template>
