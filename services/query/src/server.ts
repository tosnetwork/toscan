import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { QueryResultRow } from "pg";
import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { CONTRACT_KINDS } from "./projector.js";

const MAX_PAGE = 200;
const ADDRESS = /^-?\d+:[0-9a-f]{64}$/i;

function page(query: Record<string, unknown>): { offset: number; limit: number } {
  const offset = Math.max(0, Number(query.offset ?? 0) || 0);
  const limit = Math.min(MAX_PAGE, Math.max(1, Number(query.limit ?? 50) || 50));
  return { offset, limit };
}

function hashCandidates(raw: string): string[] {
  const candidates = [raw];
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    candidates.push(Buffer.from(raw, "hex").toString("base64"));
  } else {
    try {
      const decoded = Buffer.from(raw, "base64");
      if (decoded.length === 32) candidates.push(decoded.toString("hex"));
    } catch {
      // The exact raw value remains a valid search candidate.
    }
  }
  return [...new Set(candidates)];
}

function transaction(row: QueryResultRow): Record<string, unknown> {
  return {
    hash: row.hash,
    account: row.account,
    lt: String(row.lt),
    workchain: row.workchain,
    shard: String(row.shard),
    seqno: row.seqno,
    gen_utime: row.gen_utime,
    fee: row.fee === null ? null : String(row.fee),
    in_msg_hash: row.in_msg_hash,
    indexed_at: Number(row.indexed_at),
  };
}

function block(row: QueryResultRow): Record<string, unknown> {
  return {
    workchain: row.workchain,
    shard: String(row.shard),
    seqno: row.seqno,
    root_hash: row.root_hash,
    file_hash: row.file_hash,
    gen_utime: row.gen_utime,
    tx_count: Number(row.tx_count),
    indexed_at: Number(row.indexed_at),
    observed_mc_seqno: row.observed_mc_seqno,
  };
}

function contract(row: QueryResultRow): Record<string, unknown> {
  return {
    address: row.address,
    kind: row.kind,
    creator: row.creator,
    counterparty: row.counterparty,
    status: row.status,
    deadline: row.deadline === null ? null : Number(row.deadline),
    last_seqno: row.last_seqno,
    updated_at: Number(row.updated_at),
    data: row.data,
  };
}

const BLOCK_SELECT = `SELECT b.*,
  (SELECT count(*) FROM explorer_transactions t
   WHERE t.workchain=b.workchain AND t.shard=b.shard AND t.seqno=b.seqno) AS tx_count
  FROM explorer_blocks b`;
const TX_SELECT = `SELECT t.*, COALESCE(b.gen_utime,0) AS gen_utime
  FROM explorer_transactions t LEFT JOIN explorer_blocks b
    ON b.workchain=t.workchain AND b.shard=t.shard AND b.seqno=t.seqno`;

export function buildServer(db: ProjectionDb, metrics: Metrics): FastifyInstance {
  const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 65_536 });
  app.addHook("onRequest", async () => { metrics.queryRequests += 1; });
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (status === 500) app.log.error(error);
    void reply.code(status).send({ ok: false, error: { message: status === 500 ? "query service unavailable" : error.message } });
  });

  app.get("/healthz", async () => ({ ok: true }));
  app.get("/readyz", async (_request, reply) => {
    await db.pool.query("SELECT 1");
    if (metrics.lastProjectionSuccess === 0) {
      return reply.code(503).send({ ok: false, error: { message: "projection has not completed a cycle" } });
    }
    return reply.send({ ok: true, indexed: metrics.indexed, head: metrics.head });
  });
  app.get("/metrics", async (_request, reply) => reply.type("text/plain; version=0.0.4").send(metrics.render()));

  app.get("/explorer/status", async () => {
    const [counts, checkpoints] = await Promise.all([
      db.pool.query(`SELECT
        (SELECT count(*) FROM explorer_blocks)::int blocks,
        (SELECT count(*) FROM explorer_transactions)::int transactions,
        (SELECT count(*) FROM explorer_contracts)::int contracts,
        (SELECT max(indexed_at) FROM explorer_blocks) latest_indexed_at`),
      db.pool.query("SELECT workchain, shard::text, max(seqno)::int seqno FROM explorer_blocks GROUP BY workchain,shard ORDER BY workchain,shard"),
    ]);
    const count = counts.rows[0];
    return { ok: true, result: {
      blocks: count.blocks,
      transactions: count.transactions,
      contracts: count.contracts,
      latest_indexed_at: count.latest_indexed_at === null ? null : Number(count.latest_indexed_at),
      masterchain_head: metrics.head || null,
      masterchain_indexed: metrics.indexed || null,
      masterchain_lag: metrics.head ? Math.max(0, metrics.head - metrics.indexed) : null,
      checkpoints: checkpoints.rows.map((row) => ({ shard: `${row.workchain}:${row.shard}`, seqno: row.seqno })),
    } };
  });

  app.get("/explorer/blocks", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const [rows, total] = await Promise.all([
      db.pool.query(`${BLOCK_SELECT} ORDER BY b.observed_mc_seqno DESC,b.workchain,b.shard,b.seqno DESC OFFSET $1 LIMIT $2`, [offset, limit]),
      db.pool.query("SELECT count(*)::int total FROM explorer_blocks"),
    ]);
    return { ok: true, total: total.rows[0].total, offset, limit, result: rows.rows.map(block) };
  });

  app.get("/explorer/transactions", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const filters: string[] = [];
    const values: unknown[] = [];
    if (query.account !== undefined) {
      if (!ADDRESS.test(String(query.account))) throw Object.assign(new Error("invalid TOS address"), { statusCode: 400 });
      values.push(String(query.account).toLowerCase());
      filters.push(`t.account=$${values.length}`);
    }
    const blockFields = [query.workchain, query.shard, query.seqno];
    if (blockFields.some((value) => value !== undefined)) {
      if (blockFields.some((value) => value === undefined) || query.account !== undefined) {
        throw Object.assign(new Error("workchain, shard and seqno must be supplied together and without account"), { statusCode: 400 });
      }
      values.push(Number(query.workchain), String(query.shard), Number(query.seqno));
      filters.push(`t.workchain=$${values.length - 2} AND t.shard=$${values.length - 1} AND t.seqno=$${values.length}`);
    }
    const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    const countValues = [...values];
    values.push(offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(`${TX_SELECT}${where} ORDER BY t.indexed_at DESC,t.lt DESC OFFSET $${values.length - 1} LIMIT $${values.length}`, values),
      db.pool.query(`SELECT count(*)::int total FROM explorer_transactions t${where}`, countValues),
    ]);
    return { ok: true, total: total.rows[0].total, offset, limit, result: rows.rows.map(transaction) };
  });

  app.get("/explorer/transaction", async (request, reply) => {
    const hash = String((request.query as Record<string, unknown>).hash ?? "").trim();
    const result = await db.pool.query(`${TX_SELECT} WHERE t.hash=$1`, [hash]);
    if (!result.rows[0]) return reply.code(404).send({ ok: false, error: { message: "transaction hash is not indexed" } });
    return { ok: true, result: transaction(result.rows[0]) };
  });

  app.get("/explorer/block", async (request, reply) => {
    const hash = String((request.query as Record<string, unknown>).hash ?? "").trim();
    const result = await db.pool.query(
      `${BLOCK_SELECT} WHERE b.root_hash=ANY($1::text[]) OR b.file_hash=ANY($1::text[])`,
      [hashCandidates(hash)],
    );
    if (!result.rows[0]) return reply.code(404).send({ ok: false, error: { message: "block hash is not indexed" } });
    return { ok: true, result: block(result.rows[0]) };
  });

  app.get<{ Params: { kind: string } }>("/explorer/contracts/:kind", async (request) => {
    const { kind } = request.params;
    if (!CONTRACT_KINDS.includes(kind as typeof CONTRACT_KINDS[number])) {
      throw Object.assign(new Error("unsupported explorer contract kind"), { statusCode: 400 });
    }
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const filters = ["kind=$1"];
    const values: unknown[] = [kind];
    for (const key of ["creator", "status"] as const) {
      if (query[key] !== undefined) {
        values.push(String(query[key]));
        filters.push(`${key}=$${values.length}`);
      }
    }
    for (const [key, op] of [["deadline_after", ">"], ["deadline_before", "<"]] as const) {
      if (query[key] !== undefined) {
        values.push(String(query[key]));
        filters.push(`deadline${op}$${values.length}`);
      }
    }
    const where = ` WHERE ${filters.join(" AND ")}`;
    const countValues = [...values];
    values.push(offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(`SELECT * FROM explorer_contracts${where} ORDER BY updated_at DESC,address OFFSET $${values.length - 1} LIMIT $${values.length}`, values),
      db.pool.query(`SELECT count(*)::int total FROM explorer_contracts${where}`, countValues),
    ]);
    return { ok: true, total: total.rows[0].total, offset, limit, result: rows.rows.map(contract) };
  });

  app.get<{ Params: { kind: string; address: string } }>("/explorer/contracts/:kind/:address", async (request, reply) => {
    const result = await db.pool.query("SELECT * FROM explorer_contracts WHERE kind=$1 AND address=$2", [request.params.kind, request.params.address.toLowerCase()]);
    if (!result.rows[0]) return reply.code(404).send({ ok: false, error: { message: "contract is not indexed under this kind" } });
    return { ok: true, result: contract(result.rows[0]) };
  });

  app.get("/explorer/search", async (request) => {
    const q = String((request.query as Record<string, unknown>).q ?? "").trim();
    if (!q) throw Object.assign(new Error("search query is required"), { statusCode: 400 });
    const tx = await db.pool.query(`${TX_SELECT} WHERE t.hash=$1`, [q]);
    if (tx.rows[0]) return { ok: true, result: { kind: "transaction", result: transaction(tx.rows[0]) } };
    const foundBlock = await db.pool.query(
      `${BLOCK_SELECT} WHERE b.root_hash=ANY($1::text[]) OR b.file_hash=ANY($1::text[])`,
      [hashCandidates(q)],
    );
    if (foundBlock.rows[0]) return { ok: true, result: { kind: "block", result: block(foundBlock.rows[0]) } };
    if (ADDRESS.test(q)) {
      const foundContract = await db.pool.query("SELECT * FROM explorer_contracts WHERE address=$1", [q.toLowerCase()]);
      if (foundContract.rows[0]) return { ok: true, result: { kind: "contract", result: contract(foundContract.rows[0]) } };
    }
    return { ok: true, result: null };
  });

  return app;
}
