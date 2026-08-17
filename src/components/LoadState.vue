<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
defineProps<{ loading: boolean; error?: string | null; empty?: boolean; emptyTitle?: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="loading" class="load-state" aria-live="polite">
    <span class="spinner"></span><span>Loading verified network data…</span>
  </div>
  <div v-else-if="error" class="load-state load-state--error" role="alert">
    <strong>Unable to load this view</strong><span>{{ error }}</span>
    <button class="button button--secondary" type="button" @click="$emit('retry')"><AppIcon name="refresh" :size="17" />Try again</button>
  </div>
  <div v-else-if="empty" class="load-state">
    <strong>{{ emptyTitle ?? "Nothing here yet" }}</strong><span>No indexed records match this view.</span>
  </div>
  <slot v-else />
</template>
