<script setup lang="ts">
import { computed } from "vue";
import LoadState from "@/components/LoadState.vue";
import { getNetworkSecurity } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { PQ_VM_SUITES } from "@/utils/protocol";
import { formatDate } from "@/utils/format";
const { data, loading, error, refresh } = useAsyncData(getNetworkSecurity, [], { refreshInterval: 30_000 });
const primaryRetired = computed(() => Boolean(data.value?.authPolicy && ((data.value.authPolicy.retired & 2) || (data.value.authPolicy.primaryDeadline !== null && data.value.chainTime >= data.value.authPolicy.primaryDeadline))));
</script>
<template>
  <section class="surface page-surface" aria-label="Post-quantum protocol evidence">
    <header class="section-heading"><div><h2>Post-quantum protocol</h2><p>Network configuration observed at a single masterchain block</p></div><RouterLink to="/governance">Configuration evidence</RouterLink></header>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <dl class="detail-list detail-list--columns"><div><dt>VM protocol version</dt><dd>{{ data.version }}</dd></div><div><dt>Network global ID</dt><dd>{{ data.globalId }}</dd></div><div><dt>Observed block</dt><dd>{{ data.block.seqno }}</dd></div><div><dt>Capabilities bitmask</dt><dd class="mono">{{ data.capabilities }}</dd></div></dl>
        <div class="data-table-wrap"><table class="data-table"><caption class="sr-only">PQ VM verifier availability</caption><thead><tr><th>Suite</th><th>Algorithm</th><th>Role</th><th>Minimum VM</th><th>VM verifier</th></tr></thead><tbody><tr v-for="suite in PQ_VM_SUITES" :key="suite.id"><td>{{ suite.id }}</td><td>{{ suite.name }}</td><td>{{ suite.role }}</td><td>{{ suite.minimumVersion }}</td><td>{{ data.version >= suite.minimumVersion ? 'Available' : 'Not enabled' }}</td></tr></tbody></table></div>
        <p class="panel-copy">Verifier availability does not establish which algorithm an account uses. Consensus membership and account authority are shown from their own chain evidence. Stateful fee-hash admission additionally requires VM 17.</p>
        <h3>Quantum AUTH retirement policy</h3>
        <dl v-if="data.authPolicy" class="detail-list"><div><dt>Network namespace</dt><dd class="mono">{{ data.authPolicy.networkTag }}</dd></div><div><dt>Policy sequence</dt><dd>{{ data.authPolicy.sequence }}</dd></div><div><dt>Daily ML-DSA-44 authorization</dt><dd>{{ primaryRetired ? 'Retired at this block' : 'Not retired at this block' }}</dd></div><div><dt>Retirement deadline</dt><dd>{{ data.authPolicy.primaryDeadline === null ? 'No scheduled deadline' : formatDate(data.authPolicy.primaryDeadline) }}</dd></div></dl>
        <p v-else class="inline-empty">AUTH policy #48 is not committed on this legacy network. It is mandatory at VM 17 and later.</p>
        <h3>Validator controller code policy</h3><details v-if="data.controllerCodes"><summary>{{ data.controllerCodes.length }} admitted code hashes</summary><pre>{{ data.controllerCodes.join('\n') || 'Empty allowlist' }}</pre></details><p v-else class="inline-empty">Controller code policy #47 is not committed at this block.</p>
        <p class="evidence-note">The node verifies configuration proofs; TOSCAN checks the returned block binding and decodes the committed cells. This is not independent browser verification of consensus signatures.</p>
      </template>
    </LoadState>
  </section>
</template>
