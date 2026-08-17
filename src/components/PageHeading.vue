<script setup lang="ts">
import { useLocale } from "@/i18n";
defineProps<{ title: string; description?: string; eyebrow?: string }>();
const { t } = useLocale();
</script>

<template>
  <div class="page-heading">
    <div>
      <p v-if="eyebrow" class="eyebrow">{{ t(eyebrow) }}</p>
      <h1>{{ t(title) }}</h1>
      <p v-if="description">{{ t(description) }}</p>
    </div>
    <slot></slot>
  </div>
</template>
