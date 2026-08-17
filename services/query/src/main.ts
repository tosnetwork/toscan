import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { Projector } from "./projector.js";
import { TosRpc } from "./rpc.js";
import { buildServer } from "./server.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const db = new ProjectionDb(databaseUrl);
await db.migrate();
const metrics = new Metrics();
const checkpoint = await db.checkpoint();
metrics.indexed = checkpoint.seqno;
const rpc = new TosRpc({
  baseUrl: process.env.TOS_RPC_UPSTREAM ?? "http://127.0.0.1:8011",
  apiKey: process.env.TOS_RPC_API_KEY,
  timeoutMs: Number(process.env.TOS_RPC_TIMEOUT_MS ?? 15_000),
});
const projector = new Projector(db, rpc, metrics, {
  sourceUrl: process.env.TOS_SOURCE_EXPLORER ?? "http://127.0.0.1:8080",
  batchSize: Math.max(1, Number(process.env.QUERY_PROJECT_BATCH ?? 8)),
  pollMs: Math.max(250, Number(process.env.QUERY_POLL_MS ?? 1_000)),
  contractSyncMs: Math.max(5_000, Number(process.env.QUERY_CONTRACT_SYNC_MS ?? 30_000)),
});
const app = buildServer(db, metrics);
const abort = new AbortController();
const shutdown = async (): Promise<void> => {
  abort.abort();
  await app.close();
  await db.close();
};
process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });

void projector.run(abort.signal);
await app.listen({
  host: process.env.QUERY_HOST ?? "0.0.0.0",
  port: Number(process.env.QUERY_PORT ?? 8081),
});
