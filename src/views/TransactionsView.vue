<script setup lang="ts">
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import TransactionRows from "@/components/TransactionRows.vue";
import { getTransactions } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";

const { data, loading, error, refresh } = useAsyncData(() => getTransactions(40));
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Transactions" description="Recent account state changes observed in finalized blocks." eyebrow="Chain" />
    <section class="surface page-surface">
      <div class="table-caption"><span>Recent activity</span><span>Rolling node window</span></div>
      <LoadState :loading="loading" :error="error" :empty="!data?.length" @retry="refresh"><TransactionRows :transactions="data ?? []" /></LoadState>
    </section>
  </div>
</template>
