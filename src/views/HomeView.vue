<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "@/components/AppIcon.vue";
import BlockRows from "@/components/BlockRows.vue";
import GlobalSearch from "@/components/GlobalSearch.vue";
import LoadState from "@/components/LoadState.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import TransactionRows from "@/components/TransactionRows.vue";
import { useAsyncData } from "@/composables/useAsyncData";
import { getHome } from "@/api/explorer";
import { compact, formatInteger, formatTos } from "@/utils/format";
import { useLocale } from "@/i18n";

const { data, loading, error, refresh } = useAsyncData(getHome, [], { refreshInterval: 12_000 });
const visibleTransactions = computed(() => data.value?.transactions.slice(0, 6) ?? []);
const { t } = useLocale();
</script>

<template>
  <section class="home-hero">
    <div class="hero-orbit hero-orbit--one"></div><div class="hero-orbit hero-orbit--two"></div>
    <div class="container hero-content">
      <h1>{{ t('The TOS Network Explorer') }}</h1>
      <GlobalSearch hero />
      <div class="search-hints"><span>{{ t('Try a masterchain seqno') }}</span><code>4281904</code><span>{{ t('or a TOS address') }}</span></div>
    </div>
  </section>

  <div class="container home-content">
    <LoadState :loading="loading" :error="error" @retry="refresh">
      <section v-if="data" class="metric-strip" aria-label="Network summary">
        <div><small>{{ t('Latest masterchain block') }}</small><strong>{{ formatInteger(data.blocks[0]?.seqno) }}</strong><span class="live-label"><i></i>{{ t('Live tip') }}</span></div>
        <div><small>{{ t('Consensus block') }}</small><strong>{{ formatInteger(data.consensusBlock ?? undefined) }}</strong><span>{{ t('Node-reported') }}</span></div>
        <div><small>{{ t('Observed signers') }}</small><strong>{{ formatInteger(data.signers ?? undefined) }}</strong><span>{{ t('Latest proof link') }}</span></div>
        <div><small>{{ t('AI work shown') }}</small><strong>{{ formatInteger(data.tasks.length) }}</strong><span>{{ t('Current page window') }}</span></div>
      </section>

      <div v-if="data" class="home-grid">
        <section class="surface home-blocks">
          <header class="section-heading"><div><h2>{{ t('Latest blocks') }}</h2><p>Finalized masterchain activity</p></div><RouterLink to="/blocks">{{ t('View all') }} <AppIcon name="chevron" :size="15" /></RouterLink></header>
          <BlockRows :blocks="data.blocks" compact-rows />
        </section>
        <section class="surface home-transactions">
          <header class="section-heading"><div><h2>{{ t('Latest transactions') }}</h2><p>Recently indexed account changes</p></div><RouterLink to="/transactions">{{ t('View all') }} <AppIcon name="chevron" :size="15" /></RouterLink></header>
          <TransactionRows :transactions="visibleTransactions" compact-rows />
        </section>
      </div>

      <section v-if="data" class="ai-section">
        <div class="ai-heading">
          <p class="eyebrow">{{ t('Built for an agent economy') }}</p>
          <h2>{{ t('Explore work, not only transfers.') }}</h2>
          <p>TOSCAN makes the contracts behind autonomous work legible: who accepted a task, what it costs, which service is accountable, and whether settlement completed.</p>
        </div>
        <div class="ai-cards">
          <RouterLink class="surface ai-card" to="/agents"><span class="feature-icon"><AppIcon name="agent" :size="22" /></span><div><strong>Agents</strong><p>On-chain authorities and spending boundaries</p></div><AppIcon name="arrow-up-right" :size="17" /></RouterLink>
          <RouterLink class="surface ai-card" to="/tasks"><span class="feature-icon"><AppIcon name="task" :size="22" /></span><div><strong>Tasks</strong><p>{{ data.tasks.length }} indexed in the current window</p></div><AppIcon name="arrow-up-right" :size="17" /></RouterLink>
          <RouterLink class="surface ai-card" to="/services"><span class="feature-icon"><AppIcon name="service" :size="22" /></span><div><strong>Services</strong><p>{{ data.services.length }} actors available to inspect</p></div><AppIcon name="arrow-up-right" :size="17" /></RouterLink>
        </div>
      </section>

      <div v-if="data" class="home-grid home-grid--lower">
        <section class="surface">
          <header class="section-heading"><div><h2>{{ t('Open work') }}</h2><p>Task escrows discovered by the configured indexer</p></div><RouterLink to="/tasks">{{ t('Tasks') }} <AppIcon name="chevron" :size="15" /></RouterLink></header>
          <div class="mini-list">
            <RouterLink v-for="task in data.tasks" :key="task.address" :to="{ name: 'task', params: { address: task.address } }">
              <span><strong>{{ task.name || "Unnamed task" }}</strong><small class="mono">{{ compact(task.address) }}</small></span>
              <span><StatusBadge :status="task.status" /><small>{{ formatTos(task.budget) }} TOS</small></span>
            </RouterLink>
            <p v-if="!data.tasks.length" class="inline-empty">No tasks returned by this indexer.</p>
          </div>
        </section>
        <section class="surface">
          <header class="section-heading"><div><h2>{{ t('Service activity') }}</h2><p>AI service actors and pending calls</p></div><RouterLink to="/services">{{ t('Services') }} <AppIcon name="chevron" :size="15" /></RouterLink></header>
          <div class="mini-list">
            <RouterLink v-for="service in data.services" :key="service.address" :to="{ name: 'service', params: { address: service.address } }">
              <span><strong class="mono">{{ compact(service.address) }}</strong><small>{{ formatTos(service.price_per_call) }} TOS per call</small></span>
              <span><StatusBadge :status="service.status" /><small>{{ service.pending_count }} pending</small></span>
            </RouterLink>
            <p v-if="!data.services.length" class="inline-empty">No service actors returned by this indexer.</p>
          </div>
        </section>
      </div>
    </LoadState>
  </div>
</template>
