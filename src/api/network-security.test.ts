import { describe, it, expect, vi } from "vitest";
import { decodedConfig, masterBlock } from "./pq";
import fixture from "./fixtures/pq-native.json";
import historical from "./fixtures/pq-legacy-configs.json";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./jsonRpc", async (original) => ({ ...await original<typeof import("./jsonRpc")>(), JsonRpcClient: class { call = call; } }));
vi.mock("./http", () => ({ HttpClient: class { async get() { return { result: { items: [], total: 0, offset: 0, limit: 50, complete: true } }; } } }));
import { getAccount, getNetworkSecurity } from "./explorer";
import { RpcError } from "./jsonRpc";
function node(index = 0, mismatched = false) {
  const observed = fixture.configs.filter((c) => c.param === 8)[index]!;
  const block = masterBlock(observed.observation.block_id);
  const configs = fixture.configs.filter((c) => c.observation.block_id.root_hash === block.root_hash);
  call.mockImplementation(async (method: string, params: { param?: number }) => {
    if (method === "getMasterchainInfo") return { last: block };
    const decoded = configs.find((c) => c.param === params.param)!;
    return { block_id: { ...block, file_hash: mismatched ? btoa("x".repeat(32)) : block.file_hash }, decoded };
  });
  return block;
}
describe("pinned native protocol evidence", () => {
  it("accepts both current VM16 policies and never requests retired CP47", async () => {
    for (const index of [0, 1]) {
      call.mockClear(); const block = node(index);
      const result = await getNetworkSecurity();
      expect(result.version).toBe(16);
      expect(result.authPolicy?.sequence).toBe("0");
      expect(result.authPolicy?.networkTag).toBe(btoa(String.fromCharCode(...Array(32).fill(index ? 0x43 : 0x42))));
      expect(result.sizeLimits.presence).toBe("absent");
      expect(call).toHaveBeenCalledWith("getConfigParam", { param: 8, block_id: block, include_decoded: true, with_proof: false });
      expect(call.mock.calls.some(([method, params]) => method === "getConfigParam" && params.param === 47)).toBe(false);
    }
  });
  it("rejects historical CP47 and VM16 missing-CP48 recordings under the current protocol", () => {
    const retired = historical.configs.filter((c) => c.param === 47 || (c.param === 48 && c.presence === "absent"));
    expect(retired).toHaveLength(3);
    for (const config of retired) expect(() => decodedConfig(config, config.param, masterBlock(config.observation.block_id))).toThrow();
  });
  it("requests opt-in classification for the main account card", async () => {
    call.mockImplementation(async (method) => method === "getAccountCapability" ? { account_model: "advanced.wallet.quantum_self_pay" } : {});
    const address = "0:" + "11".repeat(32);
    expect((await getAccount(address)).capability?.account_model).toBe("advanced.wallet.quantum_self_pay");
    expect(call).toHaveBeenCalledWith("getAccountCapability", { address, include_pq: true });
  });
  it("rejects mixed-block evidence", async () => {
    node(0, true); await expect(getNetworkSecurity()).rejects.toThrow("Invalid PQ");
  });
  it("does not disguise native policy/transport failures as optional absence", async () => {
    node(0);
    const implementation = call.getMockImplementation()!;
    call.mockImplementation(async (method, params) => {
      if (method === "getConfigParam" && params.param === 48) throw new RpcError("Invalid authenticated policy", -32603, undefined, { schema_version: 1, reason: "STATE_INVALID", retryable: false });
      return implementation(method, params);
    });
    await expect(getNetworkSecurity()).rejects.toThrow("Invalid authenticated policy");
  });
});
