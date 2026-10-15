<script setup lang="ts">
import { ref } from "vue";
import { pqExplorer } from "@/api/explorer";
import { downloadJson } from "@/utils/download";
const query = ref(""), loading = ref(false), error = ref<string | null>(null);
async function submit() {
  if (loading.value) return;
  loading.value = true; error.value = null;
  try { downloadJson("tos-native-proof-reply.json", await pqExplorer.proof(query.value.trim())); }
  catch (reason) { error.value = reason instanceof Error ? reason.message : "Proof query failed"; }
  finally { loading.value = false; }
}
</script>
<template>
  <section class="surface page-surface" aria-label="Read-only proof transport">
    <h2>Read-only native proof query</h2>
    <p class="panel-copy">For independent verifiers: submit one base64 native TL query. The node enforces its read-only allowlist. TOSCAN downloads the reply without claiming independent verification or traversing a proof chain. Request cap: 16 KiB decoded; browser response cap: 64 MiB JSON.</p>
    <form @submit.prevent="submit"><label for="native-proof-query">Native TL query (base64)</label><textarea id="native-proof-query" v-model="query" :maxlength="21848" rows="4" :disabled="loading" class="crypto-query" /><button class="button button--secondary" type="submit" :disabled="loading || !query.trim()">{{ loading ? 'Fetching proof…' : 'Download proof reply' }}</button></form>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>.crypto-query { display: block; width: 100%; max-width: 100%; margin: 12px 0; font: inherit; overflow-wrap: anywhere; }</style>
