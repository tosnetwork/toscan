import { computed, ref } from "vue";

const STORAGE_KEY = "toscan:address-labels:v1";
const labels = ref<Record<string, string>>(read());

function read(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0));
  } catch {
    return {};
  }
}

function write(): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(labels.value));
}

export function useAddressLabels(address: () => string) {
  const normalized = computed(() => address().toLowerCase());
  const label = computed(() => labels.value[normalized.value] ?? "");
  return {
    label,
    setLabel(value: string) {
      const next = value.trim().slice(0, 80);
      const updated = { ...labels.value };
      if (next) updated[normalized.value] = next;
      else delete updated[normalized.value];
      labels.value = updated;
      write();
    },
  };
}
