import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProjectionDb } from "./db.js";
import type { MasterchainBundle, ProjectedBlock } from "./types.js";

const databaseUrl = process.env.QUERY_INTEGRATION_DATABASE_URL;
const suite = describe.runIf(Boolean(databaseUrl));
let db: ProjectionDb;

function block(seqno: number, hash: string, observed = seqno): ProjectedBlock {
  return {
    workchain: -1,
    shard: "-9223372036854775808",
    seqno,
    root_hash: `root-${hash}`,
    file_hash: `file-${hash}`,
    gen_utime: 1_700_000_000 + seqno,
    observed_mc_seqno: observed,
    transactions: [{
      hash: `tx-${hash}`,
      account: `-1:${"11".repeat(32)}`,
      lt: String(seqno * 10),
      workchain: -1,
      shard: "-9223372036854775808",
      seqno,
      fee: "42",
      in_msg_hash: `msg-${hash}`,
    }],
  };
}

function bundle(seqno: number, blocks: ProjectedBlock[]): MasterchainBundle {
  return { seqno, rootHash: blocks[0]!.root_hash, blocks };
}

suite("PostgreSQL projection", () => {
  beforeAll(async () => {
    db = new ProjectionDb(databaseUrl!);
    await db.migrate();
    await db.resetChain();
  });

  afterAll(async () => db.close());

  it("atomically applies batches and removes transactions retired by replacement", async () => {
    await db.applyBundles([
      bundle(1, [block(1, "one")]),
      bundle(2, [block(2, "two")]),
    ]);
    expect(await db.checkpoint()).toEqual({ seqno: 2, rootHash: "root-two" });

    const rich = await db.pool.query("SELECT fee::text,in_msg_hash FROM explorer_transactions WHERE hash='tx-two'");
    expect(rich.rows[0]).toEqual({ fee: "42", in_msg_hash: "msg-two" });

    await db.applyBundle(bundle(2, [block(2, "canonical")]));
    const hashes = await db.pool.query<{ hash: string }>("SELECT hash FROM explorer_transactions ORDER BY hash");
    expect(hashes.rows.map((row) => row.hash)).toEqual(["tx-canonical", "tx-one"]);
  });

  it("elects exactly one projection writer", async () => {
    const other = new ProjectionDb(databaseUrl!);
    const release = await db.acquireProjectionLease();
    expect(release).not.toBeNull();
    expect(await other.acquireProjectionLease()).toBeNull();
    await release!();
    const otherRelease = await other.acquireProjectionLease();
    expect(otherRelease).not.toBeNull();
    await otherRelease!();
    await other.close();
  });
});
