import { describe, expect, it } from "vitest";
import type { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { Projector } from "./projector.js";
import type { TosRpc } from "./rpc.js";
import type { GovernanceSnapshot, ValidatorSetConfig, ValidatorSetSnapshot } from "./types.js";

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
      call: async (method: string, params: { param?: number }) => {
        if (method === "getConfigParam" && params.param === 36) throw new Error("config parameter is absent");
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
        if (params.param === 36) throw new Error("optional config absent");
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
