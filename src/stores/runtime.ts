import { readonly, ref } from "vue";
import type { DataMode } from "@/api/types";

const forcePreview = import.meta.env.VITE_FORCE_PREVIEW === "true";
const mode = ref<DataMode>(forcePreview ? "preview" : "live");
const lastError = ref<string | null>(forcePreview ? "Deterministic preview mode enabled" : null);

export const runtime = {
  mode: readonly(mode),
  lastError: readonly(lastError),
  usePreview(reason: string) {
    mode.value = "preview";
    lastError.value = reason;
  },
  useLive() {
    if (forcePreview) return;
    mode.value = "live";
    lastError.value = null;
  },
  useOffline(reason: string) {
    mode.value = "offline";
    lastError.value = reason;
  },
};
