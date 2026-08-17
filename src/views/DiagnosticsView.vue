<script setup lang="ts">
import { computed } from "vue";
import PageHeading from "@/components/PageHeading.vue";
import { clearDiagnostics, diagnostics } from "@/observability/client";
import { formatDate, formatInteger } from "@/utils/format";

const errors = computed(() => diagnostics.value.filter((item) => item.type !== "metric"));
const metrics = computed(() => diagnostics.value.filter((item) => item.type === "metric").slice(-12).reverse());
</script>

<template>
  <div class="container page-container">
    <PageHeading title="Browser diagnostics" description="Private, browser-local rendering errors and performance observations." eyebrow="Operations"><button class="button button--secondary" type="button" @click="clearDiagnostics">Clear local records</button></PageHeading>
    <section class="detail-grid">
      <div class="surface detail-summary"><h2>Local errors</h2><strong class="diagnostic-number">{{ formatInteger(errors.length) }}</strong><p>Records never leave this browser automatically.</p></div>
      <div class="surface detail-summary"><h2>Performance observations</h2><strong class="diagnostic-number">{{ formatInteger(metrics.length) }}</strong><p>LCP is milliseconds; CLS is a unitless layout-shift score.</p></div>
    </section>
    <section class="surface page-surface">
      <div class="table-caption"><span>Recent local diagnostics</span><span>Maximum 100 records</span></div>
      <div class="evidence-list">
        <article v-for="(item, index) in diagnostics.slice().reverse()" :key="`${item.recordedAt}-${index}`" class="evidence-row">
          <span class="status-badge" :data-tone="item.type === 'metric' ? 'neutral' : 'negative'">{{ item.type }}</span>
          <span><strong>{{ item.name }}</strong><small>{{ item.route }}</small></span>
          <span><small>Value</small><strong>{{ item.value ?? '—' }}</strong></span>
          <span><small>Detail</small><strong>{{ item.detail ?? '—' }}</strong></span>
          <span><small>Recorded</small><strong>{{ formatDate(Math.floor(item.recordedAt / 1000)) }}</strong></span>
        </article>
        <p v-if="!diagnostics.length" class="inline-empty">No browser-local diagnostics have been recorded.</p>
      </div>
    </section>
  </div>
</template>
