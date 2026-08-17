<script setup lang="ts">
defineProps<{ compact?: boolean }>();
</script>

<template>
  <RouterLink class="brand" to="/" aria-label="TOSCAN home">
    <span class="brand-symbol" aria-hidden="true"><img src="/tos-logo.svg" alt="" /></span>
    <span v-if="!compact" class="brand-name">TOSCAN</span>
  </RouterLink>
</template>
