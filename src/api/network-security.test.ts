import { describe, it, expect, vi } from "vitest";
import { masterBlock } from "./pq";
import fixture from "./fixtures/pq-native.json";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./jsonRpc", async (original) => ({ ...await original<typeof import("./jsonRpc")>(), JsonRpcClient: class { call = call; } }));
import { getNetworkSecurity } from "./explorer";
import { RpcError } from "./jsonRpc";
function node(version: number, mismatched = false) {
  const configs = fixture.configs.filter((c) => c.observation.vm_version === version);
  const block = masterBlock(configs[0]!.observation.block_id);
  call.mockImplementation(async (method: string, params: { param?: number }) => {
    if (method === "getMasterchainInfo") return { last: block };
    const decoded = configs.find((c) => c.param === params.param)!;
    return { block_id: { ...block, file_hash: mismatched ? btoa("x".repeat(32)) : block.file_hash }, decoded };
  });
  return block;
}
describe("pinned native protocol evidence", () => {
  it("accepts explicit legacy absence and requests opt-in typed config without raw proofs", async () => {
    const block = node(16);
    const result = await getNetworkSecurity();
    expect(result.authPolicy).toBeNull();
    expect(result.sizeLimits.presence).toBe("absent");
    expect(call).toHaveBeenCalledWith("getConfigParam", { param: 8, block_id: block, include_decoded: true, with_proof: false });
    expect(call).not.toHaveBeenCalledWith("getBlockHeader", expect.anything());
    node(18); expect((await getNetworkSecurity()).authPolicy?.sequence).toBe("0");
  });
  it("rejects mixed-block evidence", async () => {
    node(16, true); await expect(getNetworkSecurity()).rejects.toThrow("Invalid PQ");
  });
  it("does not disguise native policy/transport failures as optional absence", async () => {
    node(18);
    const implementation = call.getMockImplementation()!;
    call.mockImplementation(async (method, params) => {
      if (method === "getConfigParam" && params.param === 48) throw new RpcError("Invalid authenticated policy", -32603, undefined, { schema_version: 1, reason: "STATE_INVALID", retryable: false });
      return implementation(method, params);
    });
    await expect(getNetworkSecurity()).rejects.toThrow("Invalid authenticated policy");
  });
});
