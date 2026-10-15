import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/pq-native.json";
import { decodedConfig, masterBlock, pqSignatures, publicAuthorization, sameBlock } from "./pq";
import { PqExplorer, UnsupportedPqRpcError } from "./pqExplorer";
import { JsonRpcClient } from "./jsonRpc";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const signature = fixture.signature;
const block = masterBlock(signature.id);
function client(handler: (method: string, params: Record<string, unknown>) => unknown | Promise<unknown>) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ result: await handler(body.method, body.params) }));
  });
  return { api: new PqExplorer(new JsonRpcClient({ endpoint: "/rpc", fetch: fetcher })), fetcher };
}
describe("native PQ wire evidence", () => {
  it("accepts real native signatures, all six account schemas and both networks' policies", () => {
    expect(pqSignatures(signature, block, true).signatures).toHaveLength(signature.signatures.length);
    expect(fixture.accounts).toHaveLength(8);
    for (const auth of fixture.accounts) expect(publicAuthorization(auth, masterBlock(auth.observed_masterchain_block))).toEqual(auth);
    for (const config of fixture.configs) expect(decodedConfig(config, config.param, masterBlock(config.observation.block_id))).toEqual(config);
  });
  it.each(["workchain", "shard", "seqno", "root_hash", "file_hash"] as const)("checks the complete block binding including %s", (field) => {
    const wrong = { ...block, [field]: typeof block[field] === "number" ? 0 : btoa("x".repeat(32)) };
    expect(() => sameBlock(wrong, block)).toThrow();
  });
  it("rejects duplicate/invalid signers, mismatched sessions, weights and requested proof absence", () => {
    const duplicate = clone(signature); duplicate.signatures.push(duplicate.signatures[0]!);
    expect(() => pqSignatures(duplicate, block)).toThrow();
    const short = clone(signature); short.signatures[0]!.signature = "AA==";
    expect(() => pqSignatures(short, block)).toThrow();
    const session = clone(signature); session.verification.expected_session_id = btoa("x".repeat(32));
    expect(() => pqSignatures(session, block)).toThrow();
    const low = clone(signature); low.verification.verified_weight = "0";
    expect(() => pqSignatures(low, block)).toThrow();
    const absent = { ...signature, proof: undefined };
    expect(() => pqSignatures(absent, block, true)).toThrow();
    const wrongProof = clone(signature); wrongProof.proof.to.file_hash = btoa("x".repeat(32));
    expect(() => pqSignatures(wrongProof, block, true)).toThrow();
  });
  it("never displays partial, unknown-schema or unverified account authority", () => {
    const auth = clone(fixture.accounts[0]!);
    expect(() => publicAuthorization({ ...auth, state_verified: false }, auth.observed_masterchain_block)).toThrow();
    expect(() => publicAuthorization({ ...auth, state_schema: "unrecognized" }, auth.observed_masterchain_block)).toThrow();
    expect(() => publicAuthorization({ ...auth, public_state: {} }, auth.observed_masterchain_block)).toThrow();
    expect(() => publicAuthorization({ ...auth, recognition: "unknown_code" }, auth.observed_masterchain_block)).toThrow();
  });
  it("checks native size defaults, policy profile, retirement time and mandatory absence", () => {
    const limits = fixture.configs.find((c) => c.param === 43)!;
    const invalid = clone(limits); invalid.value!.defaulted_fields = [];
    expect(() => decodedConfig(invalid, 43, limits.observation.block_id)).toThrow();
    const policy = fixture.configs.find((c) => c.param === 48 && c.value)!;
    const badProfile = clone(policy); badProfile.value!.policy_spec_hash = btoa("x".repeat(32));
    expect(() => decodedConfig(badProfile, 48, policy.observation.block_id)).toThrow();
    expect(() => decodedConfig({ ...policy, presence: "absent", value: null }, 48, policy.observation.block_id)).toThrow();
    const atDeadline = { ...clone(policy), value: { ...policy.value!, primary_deadline: policy.observation.chain_time, primary_status: "not_retired" } };
    expect(() => decodedConfig(atDeadline, 48, policy.observation.block_id)).toThrow();
    atDeadline.value!.primary_status = "retired";
    expect(decodedConfig(atDeadline, 48, policy.observation.block_id).value!.primary_status).toBe("retired");
  });
});
describe("PQ RPC acquisition", () => {
  it("pins account/config/signature requests and exports raw proofs only on explicit request", async () => {
    const auth = fixture.accounts[0]!, observed = masterBlock(auth.observed_masterchain_block);
    const { api, fetcher } = client((method, params) => {
      if (method === "getAccountCapability") return { address: params.address, pq_authorization: auth };
      if (method === "getMasterchainBlockSignatures") return signature;
      const config = fixture.configs.find((c) => c.param === params.param)!;
      return { block_id: config.observation.block_id, decoded: config };
    });
    await api.account("0:" + "00".repeat(32), observed);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body)).params).toEqual({ address: "0:" + "00".repeat(32), block_id: observed, include_pq: true, with_proof: false });
    await api.signatures(block);
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]!.body)).params).toEqual({ block_id: block, with_proof: false });
    await api.signatures(block, true);
    expect(JSON.parse(String(fetcher.mock.calls[2]![1]!.body)).params.with_proof).toBe(true);
    const c = fixture.configs[0]!; await api.config(8, c.observation.block_id);
    expect(JSON.parse(String(fetcher.mock.calls[3]![1]!.body)).params).toMatchObject({ include_decoded: true, with_proof: false });
  });
  it("treats legacy ignored opt-ins as unsupported and never invents PQ success", async () => {
    const { api } = client(() => ({}));
    await expect(api.account("0:" + "00".repeat(32), block)).rejects.toBeInstanceOf(UnsupportedPqRpcError);
    await expect(api.config(8, block)).rejects.toBeInstanceOf(UnsupportedPqRpcError);
    expect(await api.signatures({ ...block, seqno: 0 })).toBeNull();
  });
  it("rejects another account's metadata even at the same masterchain observation", async () => {
    const auth = fixture.accounts[0]!;
    const { api } = client(() => ({ address: "0:" + "11".repeat(32), pq_authorization: auth }));
    await expect(api.account("0:" + "00".repeat(32), auth.observed_masterchain_block)).rejects.toThrow("address mismatch");
  });
  it("keeps ordinary/classical carriers distinct from PQ verification", async () => {
    const { api } = client(() => ({ "@type": "blocks.blockSignatures", id: block, signatures: [] }));
    expect(await api.signatures(block)).toBeNull();
  });
  it("bounds queued inspections and dispatches at most two at once", async () => {
    let finish!: () => void;
    const wait = new Promise<void>((resolve) => { finish = resolve; });
    const { api, fetcher } = client(async () => { await wait; return signature; });
    const requests = Array.from({ length: 10 }, () => api.signatures(block));
    await expect(api.signatures(block)).rejects.toThrow("capacity");
    expect(fetcher).toHaveBeenCalledTimes(2);
    finish(); await Promise.all(requests);
    expect(fetcher).toHaveBeenCalledTimes(10);
  });
  it("bounds proof-query input before network access", async () => {
    const { api, fetcher } = client(() => ({ reply: "AA==" }));
    await expect(api.proof(btoa("x".repeat(16385)))).rejects.toThrow("limit");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(api.proof("AA==")).resolves.toEqual({ reply: "AA==" });
  });
});
