import { describe, expect, it } from "vitest";
import type { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { Projector } from "./projector.js";
import type { TosRpc } from "./rpc.js";
import type { ValidatorSetConfig, ValidatorSetSnapshot } from "./types.js";

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
