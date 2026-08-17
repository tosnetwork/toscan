<script setup lang="ts">
import { runtime } from "@/stores/runtime";
import { useLocale } from "@/i18n";
const { t } = useLocale();
</script>

<template>
  <div v-if="runtime.mode.value !== 'live'" class="data-banner" role="status">
    <strong>{{ t(runtime.mode.value === "preview" ? "Preview data" : "Explorer offline") }}</strong>
    <span v-if="runtime.mode.value === 'preview'">{{ t('The configured TOS endpoint is unavailable. Values shown below are labelled demonstration data.') }}</span>
    <span v-else>{{ runtime.lastError.value }}</span>
  </div>
</template>
