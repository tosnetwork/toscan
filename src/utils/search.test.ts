import { describe, expect, it } from "vitest";
import { resolveSearch } from "./search";

describe("resolveSearch", () => {
  it("routes canonical .tos names to their checkpoint-backed domain page", () => {
    expect(resolveSearch("alice.tos")).toEqual({ name: "domain", params: { name: "alice.tos" } });
  });
  it("routes a raw TOS address to the account view", () => {
    const address = `0:${"a".repeat(64)}`;
    expect(resolveSearch(address)).toEqual({ name: "address", params: { address } });
  });

  it("routes an explicit block identity without losing signed shard values", () => {
    expect(resolveSearch("-1:-9223372036854775808:4281904")).toEqual({
      name: "block",
      params: { workchain: "-1", shard: "-9223372036854775808", seqno: "4281904" },
    });
  });

  it("treats a numeric query as a masterchain sequence number", () => {
    expect(resolveSearch("4281904")).toEqual({
      name: "block",
      params: { workchain: "-1", shard: "-9223372036854775808", seqno: "4281904" },
    });
  });

  it("does not pretend arbitrary text is covered by a full-history index", () => {
    expect(resolveSearch("market agent")).toEqual({ name: "search", query: { q: "market agent" } });
  });
});
