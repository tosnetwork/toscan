import { readonly, ref } from "vue";
import type { DataMode } from "@/api/types";

const mode = ref<DataMode>("live");
const lastError = ref<string | null>(null);

export const runtime = {
  mode: readonly(mode),
  lastError: readonly(lastError),
  usePreview(reason: string) {
    mode.value = "preview";
    lastError.value = reason;
  },
  useLive() {
    mode.value = "live";
    lastError.value = null;
  },
  useOffline(reason: string) {
    mode.value = "offline";
    lastError.value = reason;
  },
};
