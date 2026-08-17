export interface AddressLabelRecord {
  address: string;
  label: string;
  category: string;
  source: string;
  source_url: string | null;
  verified: boolean;
  updated_at: number;
}

const ADDRESS = /^-?\d+:[0-9a-f]{64}$/i;
function safeText(value: string): boolean {
  return value.length >= 1 && value.length <= 120 && !/[<>]/.test(value)
    && ![...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127;
    });
}

export function validateAddressLabels(value: unknown): AddressLabelRecord[] {
  if (!value || typeof value !== "object") throw new Error("label manifest must be an object");
  const manifest = value as { version?: unknown; labels?: unknown };
  if (manifest.version !== 1 || !Array.isArray(manifest.labels)) {
    throw new Error("label manifest must use version 1 and contain labels[]");
  }
  const seen = new Set<string>();
  return manifest.labels.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`labels[${index}] must be an object`);
    const item = candidate as Record<string, unknown>;
    const address = String(item.address ?? "").toLowerCase();
    const label = String(item.label ?? "").trim();
    const category = String(item.category ?? "known account").trim();
    const source = String(item.source ?? "").trim();
    const sourceUrl = item.source_url === null || item.source_url === undefined ? null : String(item.source_url);
    if (!ADDRESS.test(address)) throw new Error(`labels[${index}].address is not a raw TOS address`);
    if (!safeText(label)) throw new Error(`labels[${index}].label is unsafe or empty`);
    if (!safeText(category)) throw new Error(`labels[${index}].category is unsafe or empty`);
    if (!safeText(source)) throw new Error(`labels[${index}].source is unsafe or empty`);
    if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) throw new Error(`labels[${index}].source_url must use HTTPS`);
    if (seen.has(address)) throw new Error(`duplicate label address ${address}`);
    seen.add(address);
    return {
      address,
      label,
      category,
      source,
      source_url: sourceUrl,
      verified: item.verified === true,
      updated_at: Number.isSafeInteger(item.updated_at) ? Number(item.updated_at) : Math.floor(Date.now() / 1_000),
    };
  });
}
