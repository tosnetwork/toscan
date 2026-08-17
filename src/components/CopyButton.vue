<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{ value: string; label?: string }>();
const copied = ref(false);
async function copy() {
  await navigator.clipboard.writeText(props.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 1_500);
}
</script>

<template>
  <button class="copy-button" type="button" :aria-label="`Copy ${label ?? 'value'}`" @click="copy">
    <AppIcon name="copy" :size="15" /><span class="sr-only" aria-live="polite">{{ copied ? "Copied" : "" }}</span>
  </button>
</template>
