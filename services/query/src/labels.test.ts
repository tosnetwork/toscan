import { describe, expect, it, vi } from "vitest";
import { validateAddressLabels } from "./labels";

describe("address-label manifests", () => {
  it("normalizes evidence-bearing public labels", () => {
    vi.setSystemTime(new Date("2026-08-17T00:00:00Z"));
    const address = `0:${"AB".repeat(32)}`;
    expect(validateAddressLabels({ version: 1, labels: [{
      address, label: "Treasury", category: "system", source: "genesis manifest",
      source_url: "https://tos.network/genesis", verified: true,
    }] })[0]).toMatchObject({ address: address.toLowerCase(), label: "Treasury", verified: true });
    vi.useRealTimers();
  });

  it("rejects duplicate, unsafe and non-HTTPS claims", () => {
    const address = `0:${"11".repeat(32)}`;
    expect(() => validateAddressLabels({ version: 1, labels: [
      { address, label: "One", source: "registry" }, { address, label: "Two", source: "registry" },
    ] })).toThrow(/duplicate/);
    expect(() => validateAddressLabels({ version: 1, labels: [
      { address, label: "<script>", source: "registry" },
    ] })).toThrow(/unsafe/);
    expect(() => validateAddressLabels({ version: 1, labels: [
      { address, label: "One", source: "registry", source_url: "http://example.com" },
    ] })).toThrow(/HTTPS/);
  });
});
