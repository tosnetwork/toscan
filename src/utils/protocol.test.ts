import "./buffer";
import { describe, expect, it } from "vitest";
import { beginCell, Dictionary } from "@ton/core";
import { CellBuffer as Buffer } from "./buffer";
import { AUTH_POLICY_SPEC_HASH, decodeAuthPolicy, decodeGlobalVersion, ordinaryCell } from "./protocol";
const encoded = (version: number) => beginCell().storeUint(0xc4, 8).storeUint(version, 32).storeUint(0xffffffffffffffffn, 64).endCell().toBoc().toString("base64");
describe("chain-committed PQ configuration", () => {
  it("decodes the VM gate without losing uint64 capabilities", () => {
    expect(decodeGlobalVersion(encoded(16))).toEqual({ version: 16, capabilities: "18446744073709551615" });
    expect(decodeGlobalVersion(encoded(19)).version).toBe(19);
  });
  it("rejects wrong version tags and unexpected storage", () => {
    expect(() => decodeGlobalVersion(beginCell().storeUint(0xc5, 8).storeUint(19, 32).storeUint(0, 64).endCell().toBoc().toString("base64"))).toThrow("ConfigParam 8");
    expect(() => decodeGlobalVersion(beginCell().storeRef(beginCell().endCell()).endCell().toBoc().toString("base64"))).toThrow();
    expect(() => ordinaryCell("AAAA")).toThrow();
    expect(() => ordinaryCell("A".repeat(350004))).toThrow();
  });
  it("decodes the frozen AUTH profile with exact policy sequence and retirement schedule", () => {
    const deadlines = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Uint(32)).set(1, 12345);
    const cell = beginCell().storeUint(0xa1, 8).storeBuffer(Buffer.alloc(32, 0x42)).storeUint(0xffffffffffffffffn, 64).storeUint(2, 16).storeDict(deadlines).storeBuffer(Buffer.from(AUTH_POLICY_SPEC_HASH, "hex")).endCell();
    expect(decodeAuthPolicy(cell.toBoc().toString("base64"))).toMatchObject({ networkTag: "42".repeat(32), sequence: "18446744073709551615", retired: 2, primaryDeadline: 12345 });
    const bad = beginCell().storeUint(0xa1, 8).storeBuffer(Buffer.alloc(32)).storeUint(1, 64).storeUint(0, 16).storeBit(false).storeBuffer(Buffer.alloc(32)).endCell();
    expect(() => decodeAuthPolicy(bad.toBoc().toString("base64"))).toThrow("profile");
  });
});
