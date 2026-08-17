<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "@/components/AppIcon.vue";
import LoadState from "@/components/LoadState.vue";
import PageHeading from "@/components/PageHeading.vue";
import PaginationBar from "@/components/PaginationBar.vue";
import { getContractVerificationsPage } from "@/api/explorer";
import { useAsyncData } from "@/composables/useAsyncData";
import { compact, formatDate, formatInteger } from "@/utils/format";

const offset = ref(0);
const limit = 50;
const { data, loading, error, refresh } = useAsyncData(() => getContractVerificationsPage(offset.value, limit), [offset]);
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Verified contracts" description="Reproducible build attestations matched byte-for-byte against deployed TOS code." eyebrow="Contract evidence" />
    <LoadState :loading="loading" :error="error" :empty="!data?.items.length" empty-title="No verified contracts yet" @retry="refresh">
      <section v-if="data?.items.length" class="surface page-surface">
        <div class="table-caption"><span>Matched builds</span><span>{{ formatInteger(data.total) }} verified</span></div>
        <div class="evidence-list">
          <RouterLink v-for="item in data.items" :key="item.address" class="evidence-row" :to="`/contracts/verified/${item.address}`">
            <span class="entity-glyph entity-glyph--account"><AppIcon name="block" :size="18" /></span>
            <span><strong class="mono">{{ compact(item.address, 16, 12) }}</strong><small>{{ item.compiler }} {{ item.compiler_version }}</small></span>
            <span><small>Source commit</small><strong class="mono">{{ compact(item.source_commit, 10, 7) }}</strong></span>
            <span><small>Observed block</small><strong>#{{ formatInteger(item.observed_mc_seqno) }}</strong></span>
            <span><small>Matched</small><strong>{{ formatDate(item.verified_at) }}</strong></span>
            <AppIcon name="chevron" :size="14" />
          </RouterLink>
        </div>
        <PaginationBar :total="data.total" :offset="data.offset" :limit="data.limit" :complete="data.complete" @change="offset = $event" />
      </section>
    </LoadState>
    <aside class="truth-note"><strong>What “verified” means</strong><p>The imported build artifact’s code BOC exactly matched the deployed account at the reported masterchain block. Repository identity and reproducibility remain independently inspectable evidence.</p></aside>
  </div>
</template>
