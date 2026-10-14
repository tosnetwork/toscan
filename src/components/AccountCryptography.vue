<script setup lang="ts">
import { computed } from "vue";
import { inspectAccountCryptography } from "@/utils/account-crypto";
const props = defineProps<{ code: string; data: string }>();
const evidence = computed(() => inspectAccountCryptography(props.code, props.data));
</script>
<template>
  <section class="surface tab-panel" aria-label="Account cryptography">
    <h2>Account cryptography</h2>
    <p>{{ evidence.name }} · {{ evidence.status === 'known' ? 'Code hash matched' : evidence.status === 'invalid' ? 'Public state could not be decoded' : 'No known PQ code match' }}</p>
    <p v-if="evidence.candidate" class="panel-copy">Review candidate code. A code match does not establish release approval, signature validity or safe signer state.</p>
    <p v-if="evidence.error" role="alert">{{ evidence.error }}</p>
    <dl class="detail-list"><div v-if="evidence.codeHash"><dt>Code hash</dt><dd class="mono crypto-value">{{ evidence.codeHash }}</dd></div>
      <div v-for="(value, name) in evidence.fields" :key="name"><dt>{{ name }}</dt><dd class="crypto-value"><details v-if="value.length > 128"><summary>Public key bytes</summary><pre>{{ value }}</pre></details><span v-else>{{ value }}</span></dd></div>
    </dl>
  </section>
</template>
<style scoped>.crypto-value { overflow-wrap: anywhere; min-width: 0; } pre { white-space: pre-wrap; overflow-wrap: anywhere; }</style>
