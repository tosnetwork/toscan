<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { getSearchSuggestions } from "@/api/explorer";
import type { ExplorerSearchSuggestion } from "@/api/types";
import { resolveSearch } from "@/utils/search";
import { useLocale } from "@/i18n";

const props = withDefaults(defineProps<{ hero?: boolean }>(), { hero: false });
const query = ref("");
const suggestions = ref<ExplorerSearchSuggestion[]>([]);
const recent = ref<ExplorerSearchSuggestion[]>([]);
const activeIndex = ref(-1);
const expanded = ref(false);
const loading = ref(false);
const listboxId = `toscan-search-${useId()}`;
const RECENT_KEY = "toscan:recent-searches:v1";
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchGeneration = 0;
const router = useRouter();
const { t } = useLocale();

const displayed = computed(() => query.value.trim().length >= 2 ? suggestions.value : recent.value);

function remember(item: ExplorerSearchSuggestion): void {
  const next = [item, ...recent.value.filter((candidate) => candidate.route !== item.route)].slice(0, 6);
  recent.value = next;
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function choose(item: ExplorerSearchSuggestion): void {
  remember(item);
  expanded.value = false;
  query.value = "";
  void router.push(item.route);
}

function submit() {
  const selected = displayed.value[activeIndex.value];
  if (selected) {
    choose(selected);
    return;
  }
  if (!query.value.trim()) return;
  const value = query.value.trim();
  const route = resolveSearch(value);
  remember({ kind: "label", title: value, subtitle: t("Direct search"), value, route: typeof route === "string" ? route : router.resolve(route).fullPath });
  expanded.value = false;
  void router.push(route);
}

function move(delta: number): void {
  if (!expanded.value) expanded.value = true;
  const count = displayed.value.length;
  if (!count) return;
  activeIndex.value = (activeIndex.value + delta + count) % count;
}

function onFocus(): void {
  expanded.value = displayed.value.length > 0;
}

function onBlur(): void {
  setTimeout(() => { expanded.value = false; }, 120);
}

function keyboardShortcut(event: KeyboardEvent) {
  if (event.key === "/" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
    const firstVisibleSearch = [...document.querySelectorAll<HTMLInputElement>('input[aria-label="Search TOS Network"]')]
      .find((candidate) => candidate.getClientRects().length > 0 && !candidate.disabled);
    firstVisibleSearch?.focus();
  }
}

onMounted(() => addEventListener("keydown", keyboardShortcut));
onMounted(() => {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as ExplorerSearchSuggestion[];
    recent.value = Array.isArray(stored) ? stored.slice(0, 6) : [];
  } catch {
    recent.value = [];
  }
});
onBeforeUnmount(() => {
  removeEventListener("keydown", keyboardShortcut);
  if (searchTimer) clearTimeout(searchTimer);
});

watch(query, (value) => {
  activeIndex.value = -1;
  if (searchTimer) clearTimeout(searchTimer);
  const trimmed = value.trim();
  const generation = ++searchGeneration;
  if (trimmed.length < 2) {
    suggestions.value = [];
    loading.value = false;
    expanded.value = recent.value.length > 0;
    return;
  }
  loading.value = true;
  searchTimer = setTimeout(() => {
    void getSearchSuggestions(trimmed).then((results) => {
      if (generation !== searchGeneration) return;
      suggestions.value = results;
      expanded.value = true;
    }).catch(() => {
      if (generation === searchGeneration) suggestions.value = [];
    }).finally(() => {
      if (generation === searchGeneration) loading.value = false;
    });
  }, 180);
});
</script>

<template>
  <form class="global-search" :class="{ 'global-search--hero': props.hero }" role="search" @submit.prevent="submit" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.esc="expanded = false">
    <AppIcon name="search" :size="hero ? 24 : 19" />
    <input v-model="query" role="combobox" aria-label="Search TOS Network" :aria-controls="listboxId" :aria-expanded="expanded" :aria-activedescendant="activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined" :placeholder="t('Search address, transaction, message, block or seqno')" autocomplete="off" spellcheck="false" @focus="onFocus" @blur="onBlur" />
    <kbd v-if="!hero">/</kbd>
    <button v-if="!hero" class="search-icon-submit" type="submit" aria-label="Submit search"><AppIcon name="arrow-up-right" :size="15" /></button>
    <button v-else class="search-submit" type="submit">{{ t('Explore') }}</button>
    <div v-if="expanded" :id="listboxId" class="search-suggestions" role="listbox" :aria-label="t(query.trim().length >= 2 ? 'Search suggestions' : 'Recent searches')">
      <div class="search-suggestions__heading"><span>{{ t(query.trim().length >= 2 ? 'Search suggestions' : 'Recent searches') }}</span><span v-if="loading">{{ t('Searching…') }}</span></div>
      <button v-for="(item, index) in displayed" :id="`${listboxId}-${index}`" :key="item.route" type="button" role="option" :aria-selected="activeIndex === index" :class="{ 'is-active': activeIndex === index }" @mousedown.prevent="choose(item)" @mouseenter="activeIndex = index">
        <span class="search-suggestion-kind">{{ t(item.kind) }}</span>
        <span><strong>{{ item.title }}</strong><small>{{ item.subtitle }}</small></span>
        <AppIcon name="arrow-up-right" :size="14" />
      </button>
      <p v-if="!loading && !displayed.length">{{ t('No matching indexed identity') }}</p>
    </div>
  </form>
</template>
