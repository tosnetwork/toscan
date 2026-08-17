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
