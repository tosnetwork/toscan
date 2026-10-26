import nativeFixture from "../../../src/api/fixtures/pq-native.json";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { CONTRACT_KINDS, Projector, unavailablePqSignatures } from "./projector.js";
import type { TosRpc } from "./rpc.js";
import type { DnsDomainHistoryItem, GovernanceSnapshot, ValidatorSetConfig, ValidatorSetSnapshot } from "./types.js";

afterEach(() => vi.unstubAllGlobals());

describe("contract projection", () => {
  it("requests exactly the contract kinds supported by the current node", () => {
    expect(CONTRACT_KINDS).toEqual([
      "agent_account",
      "task_escrow",
      "dispute",
      "service_actor",
      "capability_registry",
      "contract.pool.nominator",
    ]);
  });
});

describe("DNS history projection", () => {
  it("persists only events whose full checkpoint has already been projected", async () => {
    const applied: DnsDomainHistoryItem[][] = [];
    const db = {
      dnsCursor: async () => ({ mcSeqno: 0, address: "" }),
      applyDnsHistory: async (items: DnsDomainHistoryItem[]) => { applied.push(items); },
    } as unknown as ProjectionDb;
    const eligible = { address: `0:${"11".repeat(32)}`, observed_mc_seqno: 7 } as DnsDomainHistoryItem;
    const future = { address: `0:${"22".repeat(32)}`, observed_mc_seqno: 8 } as DnsDomainHistoryItem;
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      requested.push(String(input));
      return new Response(JSON.stringify({ ok: true, result: [eligible, future] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const projector = new Projector(db, {} as TosRpc, new Metrics(), {
      sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1,
    });
    await (projector as unknown as { syncDnsHistory(seqno: number): Promise<void> }).syncDnsHistory(7);
    expect(applied).toEqual([[eligible]]);
    expect(requested[0]).toContain("after_mc_seqno=0");
  });

  it("tolerates an old source node only before any DNS history has been stored", async () => {
    const projector = new Projector({
      dnsCursor: async () => ({ mcSeqno: 0, address: "" }),
    } as unknown as ProjectionDb, {} as TosRpc, new Metrics(), {
      sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1,
    });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
    await expect((projector as unknown as { syncDnsHistory(seqno: number): Promise<void> }).syncDnsHistory(7))
      .resolves.toBeUndefined();
  });

  it("fails closed when a source drops DNS history after projection began", async () => {
    const projector = new Projector({
      dnsCursor: async () => ({ mcSeqno: 6, address: `0:${"11".repeat(32)}` }),
    } as unknown as ProjectionDb, {} as TosRpc, new Metrics(), {
      sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1,
    });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
    await expect((projector as unknown as { syncDnsHistory(seqno: number): Promise<void> }).syncDnsHistory(7))
      .rejects.toThrow("DNS history sync failed (404)");
  });
});

function validatorSet(key: string, start: number): ValidatorSetConfig {
  return {
    utime_since: start,
    utime_until: start + 100,
    total: 1,
    main: 1,
    total_weight: "100",
    validators: [{ public_key: key, adnl_address: `adnl-${key}`, weight: "100", cumulative_weight: "100" }],
  };
}

describe("validator projection", () => {
  it("retains current and next proved sets beside the latest proof signatures", async () => {
    const snapshots: ValidatorSetSnapshot[] = [];
    const current = validatorSet("current-key", 100);
    const next = validatorSet("next-key", 200);
    const rpc = {
      blockId: async (_wc: number, _shard: string, seqno: number) => ({ ...nativeFixture.signature.id, seqno }),
      call: async (method: string, params: { param?: number }) => {
        if (method === "getConfigParam") return { validator_set: params.param === 34 ? current : next };
        return { signatures: [{ node_id_short: "proof-node", signature: "proof-signature" }] };
      },
    } as unknown as TosRpc;
    const db = { recordValidatorSet: async (snapshot: ValidatorSetSnapshot) => { snapshots.push(snapshot); } } as unknown as ProjectionDb;
    const projector = new Projector(db, rpc, new Metrics(), {
      sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1,
    });

    await (projector as unknown as { syncValidators(seqno: number): Promise<void> }).syncValidators(77);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      observed_mc_seqno: 77,
      validator_set: { validators: [{ public_key: "current-key" }] },
      next_validator_set: { validators: [{ public_key: "next-key" }] },
      signatures: [{ node_id_short: "proof-node" }],
    });
  });

  it("keeps the current set available when the chain has no committed successor", async () => {
    const snapshots: ValidatorSetSnapshot[] = [];
    const current = validatorSet("current-key", 100);
    const rpc = {
      blockId: async (_wc: number, _shard: string, seqno: number) => ({ ...nativeFixture.signature.id, seqno }),
      call: async (method: string, params: { param?: number }) => {
        if (method === "getConfigParam" && params.param === 36) throw new Error("getConfigParam failed (500): config param 36 not found");
        if (method === "getConfigParam") return { validator_set: current };
        return { signatures: [] };
      },
    } as unknown as TosRpc;
    const db = { recordValidatorSet: async (snapshot: ValidatorSetSnapshot) => { snapshots.push(snapshot); } } as unknown as ProjectionDb;
    const projector = new Projector(db, rpc, new Metrics(), {
      sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1,
    });

    await (projector as unknown as { syncValidators(seqno: number): Promise<void> }).syncValidators(78);

    expect(snapshots[0]).toMatchObject({ observed_mc_seqno: 78, next_validator_set: null });
  });
});

describe("governance projection", () => {
  it("retains only the raw proof-backed configuration commitments exposed by the node", async () => {
    const snapshots: GovernanceSnapshot[] = [];
    const rpc = {
      call: async (_method: string, params: { param?: number }) => {
        if (params.param === 36) throw new Error("getConfigParam failed (500): config param 36 not found");
        return { config: { bytes: `cell-${params.param}` } };
      },
    } as unknown as TosRpc;
    const db = { recordGovernanceSnapshot: async (snapshot: GovernanceSnapshot) => { snapshots.push(snapshot); } } as unknown as ProjectionDb;
    const projector = new Projector(db, rpc, new Metrics(), {
      sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1,
    });

    await (projector as unknown as { syncGovernance(seqno: number): Promise<void> }).syncGovernance(79);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      observed_mc_seqno: 79,
      parameters: [
        { id: 0, bytes: "cell-0" },
        { id: 8, bytes: "cell-8" },
        { id: 34, bytes: "cell-34" },
        { id: 36, bytes: null },
        { id: 40, bytes: "cell-40" },
        { id: 43, bytes: "cell-43" },
        { id: 48, bytes: "cell-48" },
      ],
    });
  });

  it("does not persist a partial snapshot when a required configuration cell fails", async () => {
    const snapshots: GovernanceSnapshot[] = [];
    const rpc = {
      call: async (_method: string, params: { param?: number }) => {
        if (params.param === 8) throw new Error("proof unavailable");
        return { config: { bytes: `cell-${params.param}` } };
      },
    } as unknown as TosRpc;
    const db = { recordGovernanceSnapshot: async (snapshot: GovernanceSnapshot) => { snapshots.push(snapshot); } } as unknown as ProjectionDb;
    const projector = new Projector(db, rpc, new Metrics(), {
      sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1,
    });

    await expect((projector as unknown as { syncGovernance(seqno: number): Promise<void> }).syncGovernance(80))
      .rejects.toThrow("proof unavailable");
    expect(snapshots).toHaveLength(0);
  });
});

describe("PQ signature projection boundary", () => {
  it("retains an explicit unsupported carrier without swallowing transport failures", () => {
    expect(unavailablePqSignatures(new Error("getMasterchainBlockSignatures failed (500): post-quantum block signatures are not supported by JSON-RPC yet"))).toMatchObject({ signatures_available: false });
    expect(() => unavailablePqSignatures(new Error("RPC timeout"))).toThrow("RPC timeout");
  });
});

describe("PQ signature carrier projection", () => {
  it("continues membership projection for the specific unsupported carrier and fails on RPC loss", async () => {
    const snapshots: ValidatorSetSnapshot[] = [];
    let failure = "getMasterchainBlockSignatures failed (500): post-quantum block signatures are not supported by JSON-RPC yet";
    const member = { public_key: null, validator_id: "stable", key_id: "current", algorithm_id: 1, pq_public_key: "bytes", weight: "10" };
    const rpc = { blockId: async (_wc: number, _shard: string, seqno: number) => ({ ...nativeFixture.signature.id, seqno }), call: async (method: string) => {
      if (method === "getMasterchainBlockSignatures") throw new Error(failure);
      return { validator_set: { ...validatorSet("old", 100), validators: [member] } };
    } } as unknown as TosRpc;
    const db = { recordValidatorSet: async (snapshot: ValidatorSetSnapshot) => { snapshots.push(snapshot); } } as unknown as ProjectionDb;
    const projector = new Projector(db, rpc, new Metrics(), { sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1 });
    const sync = () => (projector as unknown as { syncValidators(seqno: number): Promise<void> }).syncValidators(100);
    await sync();
    expect(snapshots[0]).toMatchObject({ validator_set: { validators: [member] }, signatures_available: false });
    failure = "getMasterchainBlockSignatures failed (503): timeout";
    await expect(sync()).rejects.toThrow("timeout"); expect(snapshots).toHaveLength(1);
  });
});

describe("versioned native PQ projection", () => {
  it("retains stable identities and historical verification without attributing latest keys", async () => {
    const snapshots: ValidatorSetSnapshot[] = [];
    let proof = nativeFixture.signature;
    const rpc = {
      blockId: async () => nativeFixture.signature.id,
      call: async (method: string) => method === "getMasterchainBlockSignatures" ? proof : { validator_set: validatorSet("unrelated-latest-key", 100) },
    } as unknown as TosRpc;
    const db = { recordValidatorSet: async (snapshot: ValidatorSetSnapshot) => snapshots.push(snapshot) } as unknown as ProjectionDb;
    const projector = new Projector(db, rpc, new Metrics(), { sourceUrl: "http://source", batchSize: 1, pollMs: 1, contractSyncMs: 1 });
    const sync = () => (projector as unknown as { syncValidators(seqno: number): Promise<void> }).syncValidators(proof.id.seqno);
    await sync();
    expect(snapshots[0]!.signature_evidence?.verification).toEqual(proof.verification);
    expect(snapshots[0]!.signatures).toEqual([]);
    expect(snapshots[0]!.signature_count).toBe(proof.signatures.length);
    expect(snapshots[0]!.signature_payloads_retained).toBe(false);
    expect(snapshots[0]!.signature_evidence?.signer_ids).toEqual(proof.signatures.map((s) => s.validator_id));
    expect(JSON.stringify(snapshots[0])).not.toContain(proof.signatures[0]!.signature);
    expect(snapshots[0]!.signature_evidence).not.toHaveProperty("public_key");
    proof = { ...proof, id: { ...proof.id, file_hash: btoa("x".repeat(32)) } };
    await expect(sync()).rejects.toThrow("Invalid PQ");
    expect(snapshots).toHaveLength(1);
  });
});
