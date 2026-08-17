import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { recordClientDiagnostic } from "@/observability/client";

interface AsyncDataOptions {
  refreshInterval?: number;
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  watchSources: Ref<unknown>[] = [],
  options: AsyncDataOptions = {},
) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(true);
  const error = ref<string | null>(null);
  let request = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function clearRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
  }

  async function load(silent = false) {
    clearRetry();
    const current = ++request;
    if (!silent || data.value === null) loading.value = true;
    error.value = null;
    try {
      const next = await loader();
      if (current === request) data.value = next;
    } catch (reason) {
      if (current === request) {
        error.value = reason instanceof Error ? reason.message : "Something went wrong";
        recordClientDiagnostic({ type: "error", name: "Data load", detail: error.value });
        retryTimer = setTimeout(() => {
          if (document.visibilityState === "visible") void load(false);
        }, 2_000);
      }
    } finally {
      if (current === request) loading.value = false;
    }
  }

  async function refresh() {
    await load(false);
  }

  function poll() {
    if (document.visibilityState === "visible" && !loading.value) void load(true);
  }

  onMounted(() => {
    void refresh();
    if (options.refreshInterval && options.refreshInterval > 0) {
      timer = setInterval(poll, options.refreshInterval);
      document.addEventListener("visibilitychange", poll);
    }
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    clearRetry();
    document.removeEventListener("visibilitychange", poll);
    request += 1;
  });
  if (watchSources.length) watch(watchSources, () => void refresh());
  return { data, loading, error, refresh };
}
