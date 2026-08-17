import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProjectionDb } from "./db";
import { Metrics } from "./metrics";
import { buildServer } from "./server";

const databaseUrl = process.env.QUERY_SCALE_DATABASE_URL;
const rows = Math.max(10_000, Number(process.env.QUERY_SCALE_ROWS ?? 1_000_000));
const suite = databaseUrl ? describe : describe.skip;

suite("million-row query release gate", () => {
  const db = new ProjectionDb(databaseUrl!);
  const metrics = new Metrics();
  const app = buildServer(db, metrics);

  beforeAll(async () => {
    await db.migrate();
    await db.pool.query("TRUNCATE explorer_messages,explorer_transactions,explorer_blocks RESTART IDENTITY CASCADE");
    await db.pool.query(`INSERT INTO explorer_blocks
      (workchain,shard,seqno,root_hash,file_hash,gen_utime,observed_mc_seqno,indexed_at)
      SELECT -1,-9223372036854775808,g,md5('root-'||g)||md5('root2-'||g),
             md5('file-'||g)||md5('file2-'||g),1700000000+g,g,1700000000+g
      FROM generate_series(1,10000) g`);
    await db.pool.query(`INSERT INTO explorer_transactions
      (hash,account,lt,workchain,shard,seqno,fee,in_msg_hash,details,indexed_at)
      SELECT md5('tx-'||g)||md5('tx2-'||g),
             '0:'||md5('account-'||(g%10000))||md5('account2-'||(g%10000)),
             g,-1,-9223372036854775808,1+(g%10000),g%1000000,
             md5('message-'||g)||md5('message2-'||g),'{}'::jsonb,1700000000+g
      FROM generate_series(1,$1::integer) g`, [rows]);
    await db.pool.query("ANALYZE explorer_transactions");
    metrics.head = 10_000;
    metrics.indexed = 10_000;
    metrics.sourceHealthy = true;
    metrics.lastProjectionSuccess = Math.floor(Date.now() / 1_000);
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it("keeps keyset pages unique and bounded at scale", async () => {
    const durations: number[] = [];
    const observed = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < 25; page += 1) {
      const started = performance.now();
      const response = await app.inject(`/explorer/transactions?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      durations.push(performance.now() - started);
      expect(response.statusCode).toBe(200);
      const body = response.json() as { result: Array<{ hash: string }>; next_cursor: string | null };
      expect(body.result).toHaveLength(200);
      for (const transaction of body.result) {
        expect(observed.has(transaction.hash)).toBe(false);
        observed.add(transaction.hash);
      }
      cursor = body.next_cursor;
    }
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? Number.POSITIVE_INFINITY;
    expect(p95).toBeLessThan(Number(process.env.QUERY_SCALE_P95_MS ?? 1_000));
    expect(observed.size).toBe(5_000);
  }, 60_000);

  it("uses the recent-history index and remains stable while a newer row arrives", async () => {
    const first = (await app.inject("/explorer/transactions?limit=2")).json() as {
      result: Array<{ hash: string }>;
      next_cursor: string;
    };
    await db.pool.query(`INSERT INTO explorer_transactions
      (hash,account,lt,workchain,shard,seqno,fee,in_msg_hash,details,indexed_at)
      VALUES($1,$2,$3,-1,-9223372036854775808,10000,1,NULL,'{}',$4)`,
    ["f".repeat(64), `0:${"e".repeat(64)}`, String(rows + 1), 1_700_000_000 + rows + 1]);
    const second = (await app.inject(`/explorer/transactions?limit=2&cursor=${encodeURIComponent(first.next_cursor)}`)).json() as {
      result: Array<{ hash: string }>;
    };
    expect(second.result.map((item) => item.hash)).not.toContain("f".repeat(64));
    expect(second.result.map((item) => item.hash)).not.toContain(first.result[0]?.hash);

    const plan = await db.pool.query<{ "QUERY PLAN": Array<{ Plan: Record<string, unknown> }> }>(
      `EXPLAIN (FORMAT JSON) SELECT hash,indexed_at,lt FROM explorer_transactions
       WHERE (indexed_at<$1 OR (indexed_at=$1 AND lt<$2))
       ORDER BY indexed_at DESC,lt DESC LIMIT 200`,
      [1_700_000_000 + rows, String(rows)],
    );
    const rendered = JSON.stringify(plan.rows[0]?.["QUERY PLAN"] ?? []);
    expect(rendered).toMatch(/explorer_transactions_recent|Index Scan/);
  });
});
