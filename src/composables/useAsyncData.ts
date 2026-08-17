import { onMounted, ref, watch, type Ref } from "vue";

export function useAsyncData<T>(loader: () => Promise<T>, watchSources: Ref<unknown>[] = []) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await loader();
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : "Something went wrong";
    } finally {
      loading.value = false;
    }
  }

  onMounted(refresh);
  if (watchSources.length) watch(watchSources, refresh);
  return { data, loading, error, refresh };
}
