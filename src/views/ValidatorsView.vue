<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import CopyButton from "@/components/CopyButton.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import { getValidatorOverview } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger, ratioPercent } from "@/utils/format";

const { data, loading, error, refresh } = useAsyncData(getValidatorOverview, [], { refreshInterval: 12_000 });
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Validators" description="The proof-extracted active validator set and signatures observed on the latest masterchain proof link." eyebrow="Consensus evidence"><button class="button button--secondary" type="button" @click="refresh"><AppIcon name="refresh" :size="17" />Refresh</button></PageHeading>
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <template v-if="data">
        <section class="metric-strip validator-metrics">
          <div><small>Latest proof block</small><strong>{{ formatInteger(data.id.seqno) }}</strong><span>Masterchain seqno</span></div>
          <div><small>Active validators</small><strong>{{ formatInteger(data.validator_set?.total) }}</strong><span>{{ data.validator_set?.main ?? 0 }} masterchain</span></div>
          <div><small>Observed signatures</small><strong>{{ formatInteger(data.signatures.length) }}</strong><span>Latest proof link</span></div>
          <div><small>Set valid until</small><strong>{{ data.validator_set ? formatDate(data.validator_set.utime_until) : '—' }}</strong><span>Config parameter #34</span></div>
        </section>
        <section class="surface page-surface">
          <header class="section-heading"><div><h2>Current validator set</h2><p>Public keys, ADNL identities and voting weights extracted from the proved config cell</p></div></header>
          <div class="validator-list">
            <article v-for="(validator, index) in data.validator_set?.validators ?? []" :key="validator.public_key">
              <span class="validator-rank">{{ index + 1 }}</span>
              <div><small>Validator public key</small><RouterLink class="mono validator-link" :to="{ name: 'validator', params: { publicKey: validator.public_key } }">{{ validator.public_key }}</RouterLink><small>ADNL · {{ ratioPercent(validator.weight, data.validator_set?.total_weight ?? '0').toFixed(2) }}% weight</small><p class="mono muted">{{ compact(validator.adnl_address, 18, 14) }}</p></div>
              <CopyButton :value="validator.public_key" label="validator public key" />
            </article>
            <p v-if="!data.validator_set?.validators.length" class="inline-empty">The current validator-set cell could not be decoded by this node version.</p>
          </div>
        </section>
        <p class="surface evidence-note"><strong>Evidence boundary.</strong> Membership and weight come from proof-extracted configuration parameter #34. The observed-signature count is separate evidence recovered from the latest forward proof link; it is not live catchain telemetry.</p>
      </template>
    </LoadState>
  </div>
</template>
