<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import GlobalSearch from "@/components/GlobalSearch.vue";
const route = useRoute();
const query = computed(() => String(route.query.q ?? ""));
</script>

<template>
  <div class="container narrow-page">
    <section class="surface search-empty"><span class="empty-mark">?</span><h1>No structured result</h1><p><strong>{{ query }}</strong> is not a recognized TOS address, block ID, or masterchain sequence number.</p><GlobalSearch hero /><p class="search-help">TOSCAN currently performs deterministic lookups against node and indexer APIs. Full-history arbitrary-text and transaction-hash-only search requires the planned durable explorer index.</p></section>
  </div>
</template>
