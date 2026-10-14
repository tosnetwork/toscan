import { describe, it, expect, vi } from "vitest";
import { beginCell } from "@ton/core";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./jsonRpc", async (original) => ({ ...await original<typeof import("./jsonRpc")>(), JsonRpcClient: class { call = call; } }));
import { getNetworkSecurity } from "./explorer";
import { RpcError } from "./jsonRpc";
const block = { workchain: -1, shard: "-9223372036854775808", seqno: 20, root_hash: "root", file_hash: "file" };
function node(version: number, mismatched = false) {
  call.mockImplementation(async (method: string, params: { param?: number }) => {
    if (method === "getMasterchainInfo") return { last: block };
    if (method === "getBlockHeader") return { id: block, global_id: 1, gen_utime: 100 };
    if (params.param !== 8) throw new RpcError(`config param ${params.param} not found`, -32603);
    return { block_id: { ...block, root_hash: mismatched ? "another" : "root" }, config: { bytes: beginCell().storeUint(0xc4, 8).storeUint(version, 32).storeUint(0, 64).endCell().toBoc().toString("base64") } };
  });
}
describe("pinned network protocol evidence", () => {
  it("accepts legacy absence but refuses mixed-block evidence and missing mandatory AUTH policy", async () => {
    node(16); expect((await getNetworkSecurity()).authPolicy).toBeNull();
    expect(call).toHaveBeenCalledWith("getConfigParam", { param: 8, seqno: 20, with_proof: true });
    node(16, true); await expect(getNetworkSecurity()).rejects.toThrow("not bound");
    node(18); await expect(getNetworkSecurity()).rejects.toThrow("requires AUTH policy");
  });
  it("does not disguise policy transport or decoding errors as absence", async () => {
    node(16);
    const implementation = call.getMockImplementation()!;
    call.mockImplementation(async (method, params) => {
      if (method === "getConfigParam" && params.param === 48) throw new Error("timeout");
      return implementation(method, params);
    });
    await expect(getNetworkSecurity()).rejects.toThrow("timeout");
  });
});
