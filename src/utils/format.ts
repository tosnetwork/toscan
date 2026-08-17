const TOS_DECIMALS = 9;

export function compact(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatTos(value: string | number | bigint | undefined, maximumFractionDigits = 4): string {
  if (value === undefined || value === null || value === "") return "—";
  try {
    const raw = BigInt(value);
    const divisor = 10n ** BigInt(TOS_DECIMALS);
    const whole = raw / divisor;
    const fractional = (raw % divisor).toString().padStart(TOS_DECIMALS, "0").slice(0, maximumFractionDigits);
    return `${whole.toLocaleString()}${fractional && Number(fractional) ? `.${fractional.replace(/0+$/, "")}` : ""}`;
  } catch {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits });
  }
}

export function formatInteger(value: number | string | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : String(value);
}

export function ratioPercent(value: string | number, total: string | number): number {
  try {
    const numerator = BigInt(value);
    const denominator = BigInt(total);
    if (denominator <= 0n || numerator <= 0n) return 0;
    return Number((numerator * 10_000n) / denominator) / 100;
  } catch {
    const denominator = Number(total);
    return denominator > 0 ? Number(value) / denominator * 100 : 0;
  }
}

export function formatDate(unixSeconds?: number): string {
  if (!unixSeconds) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

export function timeAgo(unixSeconds?: number): string {
  if (!unixSeconds) return "—";
  const delta = Math.round(unixSeconds - Date.now() / 1000);
  const abs = Math.abs(delta);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return formatter.format(delta, "second");
  if (abs < 3600) return formatter.format(Math.round(delta / 60), "minute");
  if (abs < 86_400) return formatter.format(Math.round(delta / 3600), "hour");
  return formatter.format(Math.round(delta / 86_400), "day");
}

export function statusTone(status: string): "positive" | "warning" | "danger" | "neutral" {
  const normalized = status.toLowerCase();
  if (["active", "settled", "final", "ready", "responded"].includes(normalized)) return "positive";
  if (["open", "accepted", "pending", "result_submitted", "refundable"].includes(normalized)) return "warning";
  if (["rejected", "expired", "cancelled", "disputed", "frozen"].includes(normalized)) return "danger";
  return "neutral";
}
