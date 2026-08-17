<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import WatchButton from "@/components/WatchButton.vue";
import { getContractVerification } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { formatDate, formatInteger } from "@/utils/format";

const route = useRoute();
const address = computed(() => String(route.params.address));
const { data, loading, error, refresh } = useAsyncData(() => getContractVerification(address.value), [address]);
const fingerprint = computed(() => data.value ? `${data.value.source_digest}:${data.value.observed_mc_seqno}` : null);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Verified contract" description="Compiler, source and deployment evidence for a byte-identical contract build." eyebrow="Contract evidence">
      <WatchButton kind="address" :identity="address" label="Verified contract" :route="`/contracts/verified/${address}`" :fingerprint="fingerprint" />
    </PageHeading>
    <LoadState :loading="loading" :error="error" :empty="!data" empty-title="Verification not found" @retry="refresh">
      <template v-if="data">
        <section class="surface transaction-hero-card"><div><small>Contract address</small><p class="mono">{{ data.address }}</p></div><CopyButton :value="data.address" label="contract address" /></section>
        <section class="detail-grid">
          <div class="surface detail-summary"><h2>Matched build</h2><dl class="detail-list">
            <div><dt>Compiler</dt><dd>{{ data.compiler }} {{ data.compiler_version }}</dd></div>
            <div><dt>Observed block</dt><dd>#{{ formatInteger(data.observed_mc_seqno) }}</dd></div>
            <div><dt>Verified at</dt><dd>{{ formatDate(data.verified_at) }}</dd></div>
            <div><dt>Account</dt><dd><RouterLink class="detail-link mono" :to="`/address/${data.address}`">Open deployed state</RouterLink></dd></div>
          </dl></div>
          <div class="surface detail-summary"><h2>Source provenance</h2><dl class="detail-list">
            <div><dt>Repository</dt><dd><a class="detail-link" :href="data.repository_url" target="_blank" rel="noopener noreferrer">{{ data.repository_url }}</a></dd></div>
            <div><dt>Commit</dt><dd class="mono">{{ data.source_commit }}</dd></div>
            <div><dt>Source SHA-256</dt><dd class="mono raw-value">{{ data.source_digest }}</dd></div>
            <div><dt>Build command</dt><dd class="mono raw-value">{{ data.build_command }}</dd></div>
          </dl></div>
        </section>
        <section class="surface evidence-card"><h2>Imported manifest</h2><pre>{{ JSON.stringify(data.manifest, null, 2) }}</pre></section>
      </template>
    </LoadState>
  </div>
</template>
