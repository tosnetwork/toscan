<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import BlockRows from "@/components/BlockRows.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getBlocks } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";

const route = useRoute();
const { data, loading, error, refresh } = useAsyncData(() => getBlocks(20));
const target = computed(() => Number(route.query.seqno));
const blocks = computed(() => {
  if (!data.value || !Number.isFinite(target.value)) return data.value ?? [];
  return [...data.value].sort((left, right) => left.seqno === target.value ? -1 : right.seqno === target.value ? 1 : 0);
});
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Blocks" description="Recent finalized masterchain blocks, newest first." eyebrow="Chain" />
    <section class="surface page-surface">
      <div class="table-caption"><span>Masterchain</span><span>Showing the latest 20 blocks</span></div>
      <LoadState :loading="loading" :error="error" :empty="!blocks.length" @retry="refresh"><BlockRows :blocks="blocks" /></LoadState>
    </section>
  </div>
</template>
