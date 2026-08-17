<script setup lang="ts">
import { computed, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import { useWatchlist, watchKey, type WatchKind } from "@/composables/useWatchlist";
import { useLocale } from "@/i18n";

const props = defineProps<{
  kind: WatchKind;
  identity: string;
  label: string;
  route: string;
  fingerprint?: string | null;
}>();
const watchlist = useWatchlist();
const { t } = useLocale();
const key = computed(() => watchKey(props.kind, props.identity));
const watched = computed(() => watchlist.has(key.value));

function toggle(): void {
  if (watched.value) watchlist.remove(key.value);
  else watchlist.add({ kind: props.kind, identity: props.identity, label: props.label, route: props.route });
}

watch(() => props.fingerprint, (fingerprint) => {
  if (!fingerprint || !watched.value) return;
  watchlist.observe(key.value, fingerprint);
  watchlist.markRead(key.value);
}, { immediate: true });
</script>

<template>
  <button class="button button--secondary watch-button" type="button" :aria-pressed="watched" @click="toggle">
    <AppIcon :name="watched ? 'bell' : 'star'" :size="16" />{{ t(watched ? 'Watching' : 'Watch') }}
  </button>
</template>
