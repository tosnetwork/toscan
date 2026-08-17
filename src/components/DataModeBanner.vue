<script setup lang="ts">
import { runtime } from "@/stores/runtime";
</script>

<template>
  <div v-if="runtime.mode.value !== 'live'" class="data-banner" role="status">
    <strong>{{ runtime.mode.value === "preview" ? "Preview data" : "Explorer offline" }}</strong>
    <span v-if="runtime.mode.value === 'preview'">The configured TOS endpoint is unavailable. Values shown below are labelled demonstration data.</span>
    <span v-else>{{ runtime.lastError.value }}</span>
  </div>
</template>
