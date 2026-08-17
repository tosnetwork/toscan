<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import GlobalSearch from "@/components/GlobalSearch.vue";
import LoadState from "@/components/LoadState.vue";
import { searchExplorer } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";

const route = useRoute();
const router = useRouter();
const query = computed(() => String(route.query.q ?? "").trim());
const { data, loading, error, refresh } = useAsyncData(() => searchExplorer(query.value), [query]);

watch(data, (hit) => {
  if (!hit) return;
  if (hit.kind === "transaction") {
    void router.replace({
      name: "transaction",
      params: { account: hit.result.account, lt: hit.result.lt, hash: hit.result.hash },
    });
    return;
  }
  if (hit.kind === "block") {
    void router.replace({
      name: "block",
      params: { workchain: hit.result.workchain, shard: hit.result.shard, seqno: hit.result.seqno },
    });
    return;
  }
  if (hit.kind === "message") {
    void router.replace({ name: "message", params: { hash: hit.result.hash } });
    return;
  }
  if (hit.kind === "asset") {
    void router.replace({ name: "token", params: { address: hit.result.address } });
    return;
  }
  if (hit.kind === "label") {
    void router.replace({ name: "address", params: { address: hit.result.address } });
    return;
  }
  const routeName = {
    agent_account: "agent",
    task_escrow: "task",
    service_actor: "service",
    dispute: "dispute",
  }[hit.result.kind] ?? "address";
  void router.replace({ name: routeName, params: { address: hit.result.address } });
});
</script>

<template>
  <div class="container narrow-page">
    <LoadState v-if="loading || error" :loading="loading" :error="error" @retry="refresh" />
    <section v-else-if="!data" class="surface search-empty">
      <span class="empty-mark">?</span>
      <h1>No indexed result</h1>
      <p><strong>{{ query }}</strong> is not an indexed transaction hash, block hash, contract or recognized identifier.</p>
      <GlobalSearch hero />
      <p class="search-help">The explorer searched its complete durable index. A new deployment may still be catching up; the Network page reports the current index lag.</p>
    </section>
  </div>
</template>
