<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { resolveSearch } from "@/utils/search";

const props = withDefaults(defineProps<{ hero?: boolean }>(), { hero: false });
const query = ref("");
const input = ref<HTMLInputElement | null>(null);
const router = useRouter();

function submit() {
  if (!query.value.trim()) return;
  void router.push(resolveSearch(query.value));
}

function keyboardShortcut(event: KeyboardEvent) {
  if (event.key === "/" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
    input.value?.focus();
  }
}

onMounted(() => addEventListener("keydown", keyboardShortcut));
onBeforeUnmount(() => removeEventListener("keydown", keyboardShortcut));
</script>

<template>
  <form class="global-search" :class="{ 'global-search--hero': props.hero }" role="search" @submit.prevent="submit">
    <AppIcon name="search" :size="hero ? 24 : 19" />
    <input ref="input" v-model="query" aria-label="Search TOS Network" placeholder="Search address, block ID or masterchain seqno" autocomplete="off" spellcheck="false" />
    <kbd v-if="!hero">/</kbd>
    <button v-if="!hero" class="search-icon-submit" type="submit" aria-label="Submit search"><AppIcon name="arrow-up-right" :size="15" /></button>
    <button v-else class="search-submit" type="submit">Explore</button>
  </form>
</template>
