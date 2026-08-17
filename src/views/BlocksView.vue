<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import BlockRows from "@/components/BlockRows.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import { getBlocksPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";

const route = useRoute();
const offset = ref(Math.max(0, Number(route.query.offset) || 0));
const limit = 20;
const { data, loading, error, refresh } = useAsyncData(
  () => getBlocksPage(offset.value, limit),
  [offset],
  { refreshInterval: 10_000 },
);
watch(() => route.query.offset, (value) => { offset.value = Math.max(0, Number(value) || 0); });
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
        :offset="data.offset"
        :limit="data.limit"
        :complete="data.complete"
        @change="(value) => offset = value"
      />
    </section>
  </div>
</template>
