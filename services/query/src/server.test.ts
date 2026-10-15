import { describe, expect, it } from "vitest";
import type { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { buildServer } from "./server.js";

function database(): ProjectionDb {
  return {
    pool: { query: async () => ({ rows: [] }) },
  } as unknown as ProjectionDb;
}

describe("query readiness", () => {
  it("fails closed until projection is fresh, healthy and caught up", async () => {
    const metrics = new Metrics();
    const app = buildServer(database(), metrics, { maxLag: 2, maxStaleSeconds: 30 });

    expect((await app.inject("/readyz")).statusCode).toBe(503);

    metrics.head = 100;
    metrics.indexed = 90;
    metrics.lastProjectionSuccess = Math.floor(Date.now() / 1000);
    metrics.sourceHealthy = true;
    const catchingUp = await app.inject("/readyz");
    expect(catchingUp.statusCode).toBe(503);
    expect(catchingUp.json().error.message).toBe("projection is still catching up");

    metrics.indexed = 99;
    metrics.sourceHealthy = false;
    expect((await app.inject("/readyz")).json().error.message).toBe("projection source is unhealthy");

    metrics.sourceHealthy = true;
    metrics.lastProjectionSuccess = Math.floor(Date.now() / 1000) - 31;
    expect((await app.inject("/readyz")).json().error.message).toBe("projection is stale");

    metrics.lastProjectionSuccess = Math.floor(Date.now() / 1000);
    const ready = await app.inject("/readyz");
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ ok: true, indexed: 99, head: 100, lag: 1 });
    await app.close();
  });

  it("rejects malformed numeric filters before PostgreSQL", async () => {
    const app = buildServer(database(), new Metrics());
    expect((await app.inject("/explorer/transactions?workchain=zero&shard=1&seqno=2")).statusCode).toBe(400);
    expect((await app.inject("/explorer/transactions?workchain=0&shard=not-a-shard&seqno=2")).statusCode).toBe(400);
    expect((await app.inject("/explorer/contracts/task_escrow?deadline_after=tomorrow")).statusCode).toBe(400);
    expect((await app.inject(`/explorer/search/suggest?q=${"a".repeat(257)}`)).statusCode).toBe(400);
    expect((await app.inject("/explorer/assets/activity?kind=coin")).statusCode).toBe(400);
    expect((await app.inject("/explorer/assets/not-an-address/holders")).statusCode).toBe(400);
    expect((await app.inject("/explorer/dns/domains?status=owned")).statusCode).toBe(400);
    expect((await app.inject("/explorer/dns/domains?owner=not-an-address")).statusCode).toBe(400);
    expect((await app.inject("/explorer/dns/domains?safe=yes")).statusCode).toBe(400);
    expect((await app.inject("/explorer/dns/domains/Alice.tos")).statusCode).toBe(400);
    await app.close();
  });

  it("exports bounded route-template latency metrics without address-cardinality labels", async () => {
    const metrics = new Metrics();
    const app = buildServer(database(), metrics);
    await app.inject("/healthz");
    const response = await app.inject("/metrics");
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('toscan_query_duration_seconds_count{method="GET",route="/healthz",status="200"} 1');
    expect(response.body).not.toContain("127.0.0.1");
    await app.close();
  });
});

describe("PQ validator history", () => {
  it("keeps key rotations under one stable identity without inventing an Ed25519 public key", async () => {
    const identity = "YQ".repeat(21) + "==";
    const snapshots = [2, 1].map((seqno) => ({ observed_mc_seqno: seqno, observed_at: 100 + seqno, data: {
      observed_mc_seqno: seqno, observed_at: 100 + seqno,
      signature_count: 2, signature_payloads_retained: false, signatures: [],
      validator_set: { total_weight: "10", validators: [{ validator_id: identity, public_key: null, key_id: `key-${seqno}`, algorithm_id: 1, pq_public_key: "public-pq-bytes", weight: "10" }] },
    } }));
    const db = { pool: { query: async (sql: string) => ({ rows: sql.includes("explorer_validator_sets") ? snapshots : [] }) } } as unknown as ProjectionDb;
    const app = buildServer(db, new Metrics());
    const reply = await app.inject(`/explorer/validators/${encodeURIComponent(identity)}`);
    expect(reply.statusCode).toBe(200);
    const result = reply.json().result;
    expect(result).toMatchObject({ identity, validator_id: identity, public_key: null, currently_selected: true, selected_sets: 2, observed_signature_count: 2 });
    expect(result.history.map((point: { key_id: string }) => point.key_id)).toEqual(["key-2", "key-1"]);
    await app.close();
  });
});

describe("compact signature summaries", () => {
  it("coalesces polling reads and returns counts without validator keys or signature payloads", async () => {
    let reads = 0;
    const db = { pool: { query: async () => { reads++; return { rows: [{ observed_mc_seqno: 7, signature_count: 3, signatures_available: true }] }; } } } as unknown as ProjectionDb;
    const app = buildServer(db, new Metrics());
    const replies = await Promise.all(Array.from({ length: 10 }, () => app.inject("/explorer/validators/signature-summary")));
    expect(reads).toBe(1);
    for (const response of replies) {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true, result: { observed_mc_seqno: 7, signature_count: 3, signatures_available: true } });
      expect(response.body.length).toBeLessThan(200);
    }
    await app.close();
  });
  it("does not fabricate a zero count before projection", async () => {
    const app = buildServer(database(), new Metrics());
    expect((await app.inject("/explorer/validators/signature-summary")).statusCode).toBe(503);
    await app.close();
  });
});
