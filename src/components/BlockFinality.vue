<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { runtime } from "@/stores/runtime";
import LoadState from "./LoadState.vue";
import { pqExplorer } from "@/api/explorer";
import type { BlockId } from "@/api/types";
import type { PqSignatures } from "@/api/pq";
import { useAsyncData } from "@/composables/useAsyncData";
import { downloadJson } from "@/utils/download";
const props = defineProps<{ block: BlockId }>();
const identity = computed(() => JSON.stringify(props.block));
const { data, loading, error, refresh } = useAsyncData(() => { if (runtime.mode.value === "preview") throw new Error("PQ evidence is unavailable in preview mode"); return pqExplorer.signatures(props.block); }, [identity], { retry: false, resetOnLoad: true });
const page = ref(0), proofLoading = ref(false), proofError = ref<string | null>(null);
let generation = 0, proofCache: PqSignatures | null = null;
onBeforeUnmount(() => { generation++; });
watch(identity, () => { generation++; page.value = 0; proofCache = null; proofLoading.value = false; proofError.value = null; });
const signatures = computed(() => data.value?.signatures.slice(page.value * 20, (page.value + 1) * 20) ?? []);
async function proof() {
  if (!data.value || proofLoading.value) return;
  const current = generation, block = data.value.id;
  proofLoading.value = true; proofError.value = null;
  try {
    const receipt = proofCache ?? await pqExplorer.signatures(block, true);
    if (current === generation && receipt) { proofCache = receipt; downloadJson(`tos-finality-${block.seqno}.json`, receipt); }
  } catch (reason) { if (current === generation) proofError.value = reason instanceof Error ? reason.message : "Proof unavailable"; }
  finally { if (current === generation) proofLoading.value = false; }
}
</script>
<template>
  <section class="surface page-surface" aria-label="Block finality evidence">
    <header class="section-heading"><div><h2>PQ finality evidence</h2><p>Historical signer identities and the node's anchored verification</p></div></header>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <p class="status-badge" data-tone="positive">Node verified · anchored finality</p>
        <dl class="detail-list detail-list--columns"><div><dt>Suite</dt><dd>ML-DSA-44</dd></div><div><dt>Slot</dt><dd>{{ data.slot }}</dd></div><div><dt>Verified signing weight</dt><dd>{{ data.verification.verified_weight }} / {{ data.verification.total_weight }}</dd></div><div><dt>Quorum threshold</dt><dd>{{ data.verification.quorum_threshold }}</dd></div><div><dt>Trust anchor</dt><dd>#{{ data.verification.trust_anchor.seqno }}</dd></div><div><dt>Historical validator-set source</dt><dd>#{{ data.verification.validator_set_source.seqno }}</dd></div></dl>
        <p class="evidence-note">TOSCAN displays the node's verification result. This is not independent browser verification. These historical signers are not attributed using the latest validator set.</p>
        <div class="data-table-wrap"><table class="data-table"><caption>Stable signer identities · {{ data.signatures.length }} signatures</caption><thead><tr><th>Validator ID (base64)</th><th>Algorithm</th></tr></thead><tbody><tr v-for="signature in signatures" :key="signature.validator_id"><td class="mono crypto-value">{{ signature.validator_id }}</td><td>ML-DSA-44</td></tr></tbody></table></div>
        <div class="heading-actions"><button class="button button--secondary" type="button" :disabled="page === 0" @click="page--">Previous signers</button><span>{{ page + 1 }} / {{ Math.ceil(data.signatures.length / 20) }}</span><button class="button button--secondary" type="button" :disabled="(page + 1) * 20 >= data.signatures.length" @click="page++">Next signers</button><button class="button button--secondary" type="button" :disabled="proofLoading" @click="proof">{{ proofLoading ? 'Fetching proof…' : 'Download finality proof' }}</button></div>
        <p v-if="proofError" role="alert">{{ proofError }}</p>
      </template>
      <p v-else-if="!loading && !error" class="inline-empty">{{ block.seqno === 0 ? 'Genesis is unsigned.' : 'This block uses a classical signature carrier.' }}</p>
    </LoadState>
  </section>
</template>
<style scoped>.crypto-value { overflow-wrap: anywhere; }</style>
