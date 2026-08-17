import type { ValidatorSetConfig } from "@/api/types";

export type ValidatorSort = "weight-desc" | "weight-asc" | "identity-asc";

export type ValidatorRow = ValidatorSetConfig["validators"][number] & {
  rank: number;
  masterchain: boolean;
};

export function validatorRows(set: ValidatorSetConfig | null | undefined): ValidatorRow[] {
  return (set?.validators ?? []).map((validator, index) => ({
    ...validator,
    rank: index + 1,
    masterchain: index < (set?.main ?? 0),
  }));
}

function compareWeight(left: string, right: string): number {
  try {
    const a = BigInt(left);
    const b = BigInt(right);
    return a === b ? 0 : a > b ? 1 : -1;
  } catch {
    return Number(left) - Number(right);
  }
}

export function filterAndSortValidators(
  rows: ValidatorRow[],
  query: string,
  sort: ValidatorSort,
): ValidatorRow[] {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((row) => row.public_key.toLowerCase().includes(needle) || row.adnl_address.toLowerCase().includes(needle))
    : [...rows];
  return filtered.sort((left, right) => {
    if (sort === "identity-asc") return left.public_key.localeCompare(right.public_key);
    const weight = compareWeight(left.weight, right.weight);
    if (weight !== 0) return sort === "weight-asc" ? weight : -weight;
    return left.rank - right.rank;
  });
}

export function validatorRoundProgress(start: number, end: number, now: number): number {
  if (!start || end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

export function formatRemaining(seconds: number): string {
  const remaining = Math.max(0, Math.floor(seconds));
  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
