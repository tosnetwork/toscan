<script setup lang="ts">
defineProps<{ title: string; description?: string; eyebrow?: string }>();
</script>

<template>
  <div class="page-heading">
    <div>
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <slot></slot>
  </div>
</template>
