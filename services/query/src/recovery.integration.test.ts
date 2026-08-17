import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProjectionDb } from "./db";
import type { MasterchainBundle } from "./types";

const databaseUrl = process.env.QUERY_RECOVERY_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const address = `0:${"ab".repeat(32)}`;

function bundle(seqno: number, rootHash = `root-${seqno}`): MasterchainBundle {
  return {
    seqno,
    rootHash,
    blocks: [{
      workchain: -1,
      shard: "-9223372036854775808",
      seqno,
      root_hash: rootHash,
      file_hash: `file-${seqno}`,
      gen_utime: 1_700_000_000 + seqno,
      observed_mc_seqno: seqno,
      transactions: [{
        hash: `hash-${seqno}`,
        account: address,
        lt: String(seqno),
        workchain: -1,
        shard: "-9223372036854775808",
        seqno,
        fee: "1",
        in_msg_hash: null,
      }],
    }],
  };
}

suite("projection restart and recovery gate", () => {
  let db = new ProjectionDb(databaseUrl!);

  beforeAll(async () => {
    await db.migrate();
    await db.pool.query("TRUNCATE explorer_pool_snapshots,explorer_validator_sets,explorer_staking_cycles,explorer_staking_overview,explorer_asset_positions,explorer_asset_accounts,explorer_assets,explorer_messages,explorer_transactions,explorer_blocks,explorer_contracts,explorer_address_labels,projection_meta CASCADE");
  });

  afterAll(async () => { await db.close(); });

  it("resumes exactly from the committed checkpoint after repeated process restarts", async () => {
    for (let group = 0; group < 5; group += 1) {
      const first = group * 20 + 1;
      await db.applyBundles(Array.from({ length: 20 }, (_, index) => bundle(first + index)));
      await db.close();
      db = new ProjectionDb(databaseUrl!);
      await db.migrate();
      expect(await db.checkpoint()).toEqual({ seqno: first + 19, rootHash: `root-${first + 19}` });
    }
    const count = await db.pool.query<{ total: number }>("SELECT count(*)::int total FROM explorer_transactions");
    expect(count.rows[0]?.total).toBe(100);
  });

  it("rolls back chain-derived data and replays without deleting curated labels", async () => {
    await db.pool.query(`INSERT INTO explorer_address_labels(address,label,category,source,verified,updated_at)
      VALUES($1,'Genesis authority','system','genesis',true,1700000000)`, [address]);
    await db.resetChain();
    expect(await db.checkpoint()).toEqual({ seqno: 0, rootHash: null });
    const label = await db.pool.query("SELECT label FROM explorer_address_labels WHERE address=$1", [address]);
    expect(label.rows[0]?.label).toBe("Genesis authority");
    await db.applyBundles([bundle(1, "replacement-root")]);
    expect(await db.checkpoint()).toEqual({ seqno: 1, rootHash: "replacement-root" });
  });

  it("serializes writer failover through the PostgreSQL advisory lease", async () => {
    const peer = new ProjectionDb(databaseUrl!);
    const release = await db.acquireProjectionLease();
    expect(release).not.toBeNull();
    expect(await peer.acquireProjectionLease()).toBeNull();
    await release?.();
    const peerRelease = await peer.acquireProjectionLease();
    expect(peerRelease).not.toBeNull();
    await peerRelease?.();
    await peer.close();
  });
});
