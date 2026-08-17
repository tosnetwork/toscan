import { ref } from "vue";

export interface ClientDiagnostic {
  type: "error" | "rejection" | "metric";
  name: string;
  value?: number;
  detail?: string;
  route: string;
  recordedAt: number;
}

const STORAGE_KEY = "toscan:client-diagnostics:v1";
const MAX_RECORDS = 100;
let installed = false;

function load(): ClientDiagnostic[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as ClientDiagnostic[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

export const diagnostics = ref<ClientDiagnostic[]>(typeof window === "undefined" ? [] : load());

export function recordClientDiagnostic(entry: Omit<ClientDiagnostic, "route" | "recordedAt">): void {
  if (typeof window === "undefined") return;
  diagnostics.value = [...diagnostics.value, {
    ...entry,
    route: location.pathname,
    recordedAt: Date.now(),
  }].slice(-MAX_RECORDS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diagnostics.value));
  } catch {
    // Diagnostics must never become a second application error when storage is unavailable.
  }
}

export function installClientObservability(): void {
  if (installed) return;
  installed = true;
  addEventListener("error", (event) => recordClientDiagnostic({ type: "error", name: event.error?.name ?? "Error", detail: event.message }));
  addEventListener("unhandledrejection", (event) => recordClientDiagnostic({
    type: "rejection",
    name: event.reason instanceof Error ? event.reason.name : "Unhandled rejection",
    detail: event.reason instanceof Error ? event.reason.message : String(event.reason),
  }));
  if (!("PerformanceObserver" in window)) return;
  const supported = PerformanceObserver.supportedEntryTypes;
  if (supported.includes("largest-contentful-paint")) {
    new PerformanceObserver((list) => {
      const latest = list.getEntries().at(-1);
      if (latest) recordClientDiagnostic({ type: "metric", name: "LCP", value: Math.round(latest.startTime) });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  }
  if (supported.includes("layout-shift")) {
    let total = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) total += entry.value ?? 0;
      }
      recordClientDiagnostic({ type: "metric", name: "CLS", value: Number(total.toFixed(4)) });
    }).observe({ type: "layout-shift", buffered: true });
  }
}

export function clearDiagnostics(): void {
  diagnostics.value = [];
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory view is still cleared when browser storage is unavailable.
  }
}
