<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { runtime } from "@/stores/runtime";
import LoadState from "./LoadState.vue";
import { pqExplorer } from "@/api/explorer";
import type { PublicAuthorization } from "@/api/pq";
import { FAMILY_NAMES } from "@/api/pq";
import { useAsyncData } from "@/composables/useAsyncData";
import { downloadJson } from "@/utils/download";
const props = defineProps<{ address: string }>();
const address = computed(() => props.address);
const { data, loading, error, refresh } = useAsyncData(() => { if (runtime.mode.value === "preview") throw new Error("PQ evidence is unavailable in preview mode"); return pqExplorer.account(address.value); }, [address], { retry: false, resetOnLoad: true });
const proofLoading = ref(false), proofError = ref<string | null>(null);
let generation = 0;
let exported: PublicAuthorization | undefined;
onBeforeUnmount(() => { generation++; });
watch(address, () => { generation++; exported = undefined; proofLoading.value = false; proofError.value = null; });
async function proof() {
  if (!data.value || proofLoading.value) return;
  const current = generation, snapshot = data.value, observedAddress = address.value;
  proofLoading.value = true; proofError.value = null;
  try {
    const cached = exported && JSON.stringify(exported.observed_masterchain_block) === JSON.stringify(snapshot.observed_masterchain_block) ? exported : undefined;
    const result = cached ?? await pqExplorer.account(observedAddress, snapshot.observed_masterchain_block, true);
    if (current === generation) { exported = result; downloadJson("tos-account-proof.json", result); }
  } catch (reason) { if (current === generation) proofError.value = reason instanceof Error ? reason.message : "Proof unavailable"; }
  finally { if (current === generation) proofLoading.value = false; }
}
const fields = computed(() => {
  const output: Array<{ name: string; value: string }> = [];
  function visit(value: Record<string, unknown>, prefix = "") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "kind") continue;
      const name = `${prefix}${key.replaceAll("_", " ")}`;
      if (item && typeof item === "object" && !Array.isArray(item)) visit(item as Record<string, unknown>, `${name} / `);
      else {
        const algorithms: Record<number, string> = { 1: "ML-DSA-44", 2: "Falcon-512 padded", 3: "SLH-DSA-SHA2-128s", 4: "Stateful HSS/LMS H20/W4" };
        const display = key === "algorithm_id" ? algorithms[Number(item)] ?? String(item) : key === "legacy_signature_enabled" && item === false ? "Disabled; inert V5 field is zero" : item === null ? "Not set" : String(item);
        output.push({ name, value: display });
      }
    }
  }
  if (data.value?.public_state) visit(data.value.public_state);
  return output;
});
</script>
<template>
  <section class="surface tab-panel" aria-label="Account cryptography">
    <h2>Account cryptography</h2>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <p>{{ data.code_family ? FAMILY_NAMES[data.code_family] : data.recognition === 'no_active_code' ? 'No active code' : 'Unknown code' }} · {{ data.recognition === 'recognized' ? 'Code hash matched' : 'No recognized authority' }}</p>
        <p class="panel-copy">Account state verified by the node at masterchain #{{ data.observed_masterchain_block.seqno }}. Public metadata does not prove key possession, safe signer state or signing/admission capability.</p>
        <p v-if="data.release_status === 'review_candidate'" class="panel-copy">Review candidate code; release approval is not asserted.</p>
        <dl class="detail-list"><div><dt>Code hash (base64)</dt><dd class="mono crypto-value">{{ data.code_hash ?? 'None' }}</dd></div><div><dt>Registry revision</dt><dd class="mono crypto-value">{{ data.registry_revision }}</dd></div>
          <div v-for="field in fields" :key="field.name"><dt>{{ field.name }}</dt><dd class="crypto-value"><details v-if="field.value.length > 128"><summary>Public bytes (base64)</summary><pre>{{ field.value }}</pre></details><span v-else>{{ field.value }}</span></dd></div>
        </dl>
        <button class="button button--secondary" type="button" :disabled="proofLoading" @click="proof">{{ proofLoading ? 'Fetching proof…' : 'Download account proof' }}</button>
        <p v-if="proofError" role="alert">{{ proofError }}</p>
      </template>
    </LoadState>
  </section>
</template>
<style scoped>.crypto-value { overflow-wrap: anywhere; min-width: 0; } pre { white-space: pre-wrap; overflow-wrap: anywhere; }</style>
