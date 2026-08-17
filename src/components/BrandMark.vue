<script setup lang="ts">
defineProps<{ compact?: boolean }>();
</script>

<template>
  <RouterLink class="brand" to="/" aria-label="TOSCAN home">
    <svg class="brand-symbol" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="currentColor" />
      <path d="M9 11h22L20 32 9 11Z" fill="var(--surface)" />
      <path d="M14.5 15.5h11L20 26l-5.5-10.5Z" fill="var(--accent)" />
    </svg>
    <span v-if="!compact" class="brand-name">TOSCAN</span>
  </RouterLink>
</template>
