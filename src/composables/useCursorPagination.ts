import { computed, ref } from "vue";

export function useCursorPagination(limit: number) {
  const pageIndex = ref(0);
  const cursors = ref<Array<string | undefined>>([undefined]);
  const cursor = computed(() => cursors.value[pageIndex.value]);
  const offset = computed(() => pageIndex.value * limit);

  function navigate(direction: "previous" | "next", nextCursor?: string | null): void {
    if (direction === "previous") {
      pageIndex.value = Math.max(0, pageIndex.value - 1);
      return;
    }
    if (!nextCursor) return;
    cursors.value[pageIndex.value + 1] = nextCursor;
    cursors.value.splice(pageIndex.value + 2);
    pageIndex.value += 1;
  }

  function reset(): void {
    cursors.value = [undefined];
    pageIndex.value = 0;
  }

  return { cursor, offset, pageIndex, navigate, reset };
}
