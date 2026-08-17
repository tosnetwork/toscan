import { computed, ref } from "vue";

export type WatchKind = "address" | "agent" | "task" | "service" | "dispute" | "asset" | "validator" | "pool";

export interface WatchEntry {
  key: string;
  kind: WatchKind;
  identity: string;
  label: string;
  route: string;
  createdAt: number;
  checkedAt: number | null;
  fingerprint: string | null;
  unread: boolean;
}

const STORAGE_KEY = "toscan:watchlist:v1";

function load(): WatchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as WatchEntry[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.key && item?.route) : [];
  } catch {
    return [];
  }
}

const state = ref<WatchEntry[]>(load());

function save(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  } catch {
    // Keep the current-session watchlist usable when persistent storage is blocked.
  }
  window.dispatchEvent(new CustomEvent("toscan:watchlist"));
}

export function watchKey(kind: WatchKind, identity: string): string {
  return `${kind}:${identity}`;
}

export function useWatchlist() {
  return {
    items: computed(() => state.value),
    unreadCount: computed(() => state.value.filter((item) => item.unread).length),
    has(key: string): boolean {
      return state.value.some((item) => item.key === key);
    },
    add(entry: Omit<WatchEntry, "key" | "createdAt" | "checkedAt" | "fingerprint" | "unread">): void {
      const key = watchKey(entry.kind, entry.identity);
      if (state.value.some((item) => item.key === key)) return;
      state.value = [{ ...entry, key, createdAt: Date.now(), checkedAt: null, fingerprint: null, unread: false }, ...state.value];
      save();
    },
    remove(key: string): void {
      state.value = state.value.filter((item) => item.key !== key);
      save();
    },
    observe(key: string, fingerprint: string): boolean {
      const item = state.value.find((candidate) => candidate.key === key);
      if (!item) return false;
      const changed = item.fingerprint !== null && item.fingerprint !== fingerprint;
      item.unread = item.unread || changed;
      item.fingerprint = fingerprint;
      item.checkedAt = Date.now();
      state.value = [...state.value];
      save();
      return changed;
    },
    markRead(key: string): void {
      const item = state.value.find((candidate) => candidate.key === key);
      if (!item || !item.unread) return;
      item.unread = false;
      state.value = [...state.value];
      save();
    },
    markAllRead(): void {
      state.value = state.value.map((item) => ({ ...item, unread: false }));
      save();
    },
  };
}
