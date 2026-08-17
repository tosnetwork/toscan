<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import WatchButton from "@/components/WatchButton.vue";
import { getIndexedContract } from "@/api/explorer";
import type { Service } from "@/api/types";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatInteger, formatTos, timeAgo } from "@/utils/format";

const route = useRoute();
const address = computed(() => String(route.params.address));
const { data, loading, error, refresh } = useAsyncData(
  () => getIndexedContract<Service>("service_actor", address.value),
  [address],
  { refreshInterval: 12_000 },
);
const fingerprint = computed(() => data.value ? JSON.stringify([data.value.updated_at, data.value.status, data.value.data]) : null);
</script>

<template>
  <div class="container page-container">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><RouterLink to="/services">Services</RouterLink><AppIcon name="chevron" :size="13" /><span>{{ compact(address) }}</span></nav>
    <PageHeading title="Service Actor" description="On-chain price, access policy, capacity and accountable request state." eyebrow="AI service"><div class="heading-actions"><StatusBadge :status="data?.data.status ?? 'indexed'" /><WatchButton kind="service" :identity="address" label="Service Actor" :route="`/service/${address}`" :fingerprint="fingerprint" /></div></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh"><template v-if="data">
      <section class="surface transaction-hero-card"><span class="entity-glyph"><AppIcon name="service" :size="24" /></span><div><small>Service Actor address</small><p class="mono">{{ data.address }}</p></div><CopyButton :value="data.address" label="service address" /></section>
      <section class="account-metrics">
        <div class="surface"><small>Price per call</small><strong>{{ formatTos(data.data.price_per_call) }} TOS</strong><span>Contract-enforced</span></div>
        <div class="surface"><small>Pending requests</small><strong>{{ formatInteger(data.data.pending_count) }}</strong><span>{{ data.data.live_count }} total live</span></div>
        <div class="surface"><small>Daily capacity</small><strong>{{ formatInteger(data.data.rate_limit_per_day) }}</strong><span>Calls per day</span></div>
        <div class="surface"><small>Revenue counter</small><strong>{{ formatTos(data.data.withdrawable_revenue) }} TOS</strong><span>Nominal withdrawable</span></div>
      </section>
      <section class="detail-grid">
        <div class="surface detail-summary"><h2>Access and ownership</h2><dl class="detail-list">
          <div><dt>Owner</dt><dd><RouterLink class="mono detail-link" :to="{ name: 'address', params: { address: data.data.owner } }">{{ compact(data.data.owner, 12, 10) }}</RouterLink></dd></div>
          <div><dt>Access</dt><dd>{{ data.data.open_access ? 'Open to callers' : 'Restricted' }}</dd></div>
          <div><dt>Authorized caller</dt><dd><RouterLink v-if="data.data.authorized_caller" class="mono detail-link" :to="{ name: 'address', params: { address: data.data.authorized_caller } }">{{ compact(data.data.authorized_caller, 12, 10) }}</RouterLink><span v-else>Any caller under policy</span></dd></div>
          <div><dt>Indexed</dt><dd>Block {{ formatInteger(data.last_seqno) }} · {{ timeAgo(data.updated_at) }}</dd></div>
        </dl></div>
        <aside class="surface proof-boundary"><span class="feature-icon"><AppIcon name="network" :size="20" /></span><h2>What this proves</h2><p>The chain proves price, authorization, request state and settlement. Off-chain model execution is proven only when the request carries the required evidence or attestation commitment.</p></aside>
      </section>
    </template></LoadState>
  </div>
</template>
