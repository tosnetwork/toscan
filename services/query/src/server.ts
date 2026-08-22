import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { QueryResultRow } from "pg";
import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { CONTRACT_KINDS } from "./projector.js";

const MAX_PAGE = 200;
const ADDRESS = /^-?\d+:[0-9a-f]{64}$/i;

function page(query: Record<string, unknown>): { offset: number; limit: number } {
  const rawOffset = Number(query.offset ?? 0);
  const rawLimit = Number(query.limit ?? 50);
  const offset = Number.isFinite(rawOffset) ? Math.min(10_000_000, Math.max(0, Math.floor(rawOffset))) : 0;
  const limit = Number.isFinite(rawLimit) ? Math.min(MAX_PAGE, Math.max(1, Math.floor(rawLimit))) : 50;
  return { offset, limit };
}

function encodeCursor(kind: string, values: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify({ version: 1, kind, ...values })).toString("base64url");
}

function decodeCursor(query: Record<string, unknown>, kind: string): Record<string, unknown> | null {
  if (query.cursor === undefined) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(query.cursor), "base64url").toString("utf8")) as Record<string, unknown>;
    if (decoded.version !== 1 || decoded.kind !== kind) throw new Error("cursor kind mismatch");
    return decoded;
  } catch {
    throw Object.assign(new Error("invalid pagination cursor"), { statusCode: 400 });
  }
}

function cursorNumber(cursor: Record<string, unknown>, field: string): number {
  const value = Number(cursor[field]);
  if (!Number.isSafeInteger(value)) throw Object.assign(new Error("invalid pagination cursor"), { statusCode: 400 });
  return value;
}

function queryInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw Object.assign(new Error(`${field} must be an integer`), { statusCode: 400 });
  return parsed;
}

function cursorString(cursor: Record<string, unknown>, field: string): string {
  const value = cursor[field];
  if (typeof value !== "string" || !value) {
    throw Object.assign(new Error("invalid pagination cursor"), { statusCode: 400 });
  }
  return value;
}

function decimalString(value: unknown, field: string): string {
  const parsed = String(value);
  if (!/^-?\d{1,20}$/.test(parsed)) throw Object.assign(new Error(`${field} must be a signed 64-bit decimal`), { statusCode: 400 });
  return parsed;
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

function canonicalValidatorPublicKey(value: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === 32 ? decoded.toString("base64") : value;
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
    details: row.details ?? {},
  };
}

function message(row: QueryResultRow): Record<string, unknown> {
  return {
    hash: row.hash,
    transaction_hash: row.transaction_hash,
    direction: row.direction,
    kind: row.kind,
    source: row.source,
    destination: row.destination,
    value: row.value === null ? null : String(row.value),
    bounced: row.bounced,
    created_lt: row.created_lt === null ? null : String(row.created_lt),
    created_at: row.created_at,
    account: row.account,
    transaction_lt: row.transaction_lt === null ? null : String(row.transaction_lt),
    workchain: row.workchain,
    shard: row.shard === null ? null : String(row.shard),
    seqno: row.seqno,
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

function asset(row: QueryResultRow): Record<string, unknown> {
  return {
    address: row.address,
    kind: row.kind,
    updated_at: Number(row.updated_at),
    holder_count: row.holder_count === undefined ? undefined : Number(row.holder_count),
    data: row.data,
  };
}

function assetPositionEvent(row: QueryResultRow): Record<string, unknown> {
  return {
    id: Number(row.id),
    owner_address: row.owner_address,
    asset_address: row.asset_address,
    position_address: row.position_address,
    kind: row.kind,
    event_type: row.event_type,
    last_lt: String(row.last_lt),
    observed_at: Number(row.observed_at),
  };
}

function dnsDomain(row: QueryResultRow): Record<string, unknown> {
  return {
    address: row.address,
    name: row.name,
    status: row.status_current ?? row.status,
    owner: row.owner,
    renewal_deadline: row.renewal_deadline === null ? null : Number(row.renewal_deadline),
    safe_to_resolve: row.safe_current ?? row.safe_to_resolve,
    observed_mc_seqno: row.observed_mc_seqno,
    observed_at: Number(row.observed_at),
    root_hash: row.root_hash,
    file_hash: row.file_hash,
    data: row.data,
  };
}

const DNS_CURRENT_SELECT = `SELECT d.*,
  CASE
    WHEN COALESCE((d.data->>'auction_end_time')::bigint,0)<>0
      THEN CASE WHEN extract(epoch FROM now())::bigint>(d.data->>'auction_end_time')::bigint
        THEN 'auction-ended-unfinalized' ELSE 'auction' END
    WHEN d.renewal_deadline IS NOT NULL AND extract(epoch FROM now())::bigint>d.renewal_deadline
      THEN 'releasable'
    ELSE 'leased'
  END status_current,
  (COALESCE((d.data->>'auction_end_time')::bigint,0)=0 AND
   d.renewal_deadline IS NOT NULL AND extract(epoch FROM now())::bigint<=d.renewal_deadline) safe_current
  FROM explorer_dns_domains d`;

const BLOCK_SELECT = `SELECT b.*,
  (SELECT count(*) FROM explorer_transactions t
   WHERE t.workchain=b.workchain AND t.shard=b.shard AND t.seqno=b.seqno) AS tx_count
  FROM explorer_blocks b`;
const TX_SELECT = `SELECT t.*, COALESCE(b.gen_utime,0) AS gen_utime
  FROM explorer_transactions t LEFT JOIN explorer_blocks b
    ON b.workchain=t.workchain AND b.shard=t.shard AND b.seqno=t.seqno`;

interface ReadinessOptions {
  maxLag: number;
  maxStaleSeconds: number;
}

export function buildServer(
  db: ProjectionDb,
  metrics: Metrics,
  readiness: ReadinessOptions = { maxLag: 2, maxStaleSeconds: 30 },
): FastifyInstance {
  const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 65_536 });
  const requestStarted = new WeakMap<object, bigint>();
  app.addHook("onRequest", async (request) => { requestStarted.set(request, process.hrtime.bigint()); });
  app.addHook("onResponse", async (request, reply) => {
    const started = requestStarted.get(request);
    if (!started) return;
    const route = request.routeOptions.url || "unmatched";
    const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    metrics.observeRequest(request.method, route, reply.statusCode, seconds);
  });
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
    const lag = Math.max(0, metrics.head - metrics.indexed);
    const age = Math.max(0, Math.floor(Date.now() / 1000) - metrics.lastProjectionSuccess);
    if (!metrics.sourceHealthy) {
      return reply.code(503).send({ ok: false, error: { message: "projection source is unhealthy" }, indexed: metrics.indexed, head: metrics.head, lag });
    }
    if (age > readiness.maxStaleSeconds) {
      return reply.code(503).send({ ok: false, error: { message: "projection is stale" }, indexed: metrics.indexed, head: metrics.head, lag, age });
    }
    if (lag > readiness.maxLag) {
      return reply.code(503).send({ ok: false, error: { message: "projection is still catching up" }, indexed: metrics.indexed, head: metrics.head, lag });
    }
    return reply.send({ ok: true, indexed: metrics.indexed, head: metrics.head, lag, age });
  });
  app.get("/metrics", async (_request, reply) => reply.type("text/plain; version=0.0.4").send(metrics.render()));

  app.get("/explorer/status", async () => {
    const [counts, checkpoints] = await Promise.all([
      db.pool.query(`SELECT
        (SELECT count(*) FROM explorer_blocks)::int blocks,
        (SELECT count(*) FROM explorer_transactions)::int transactions,
        (SELECT count(*) FROM explorer_contracts)::int contracts,
        (SELECT count(*) FROM explorer_assets)::int assets,
        (SELECT max(indexed_at) FROM explorer_blocks) latest_indexed_at`),
      db.pool.query("SELECT workchain, shard::text, max(seqno)::int seqno FROM explorer_blocks GROUP BY workchain,shard ORDER BY workchain,shard"),
    ]);
    const count = counts.rows[0];
    return { ok: true, result: {
      blocks: count.blocks,
      transactions: count.transactions,
      contracts: count.contracts,
      assets: count.assets,
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
    const cursor = decodeCursor(query, "blocks");
    const values: unknown[] = [];
    let where = "";
    if (cursor) {
      values.push(cursorNumber(cursor, "observed"), cursorNumber(cursor, "workchain"), decimalString(cursorString(cursor, "shard"), "cursor shard"), cursorNumber(cursor, "seqno"));
      where = ` WHERE (b.observed_mc_seqno < $1
        OR (b.observed_mc_seqno=$1 AND b.workchain>$2)
        OR (b.observed_mc_seqno=$1 AND b.workchain=$2 AND b.shard>$3)
        OR (b.observed_mc_seqno=$1 AND b.workchain=$2 AND b.shard=$3 AND b.seqno<$4))`;
    }
    values.push(cursor ? 0 : offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(`${BLOCK_SELECT}${where} ORDER BY b.observed_mc_seqno DESC,b.workchain,b.shard,b.seqno DESC OFFSET $${values.length - 1} LIMIT $${values.length}`, values),
      db.pool.query("SELECT count(*)::int total FROM explorer_blocks"),
    ]);
    const last = rows.rows.at(-1);
    return {
      ok: true, total: total.rows[0].total, offset: cursor ? 0 : offset, limit,
      next_cursor: rows.rows.length === limit && last ? encodeCursor("blocks", {
        observed: last.observed_mc_seqno, workchain: last.workchain, shard: String(last.shard), seqno: last.seqno,
      }) : null,
      result: rows.rows.map(block),
    };
  });

  app.get("/explorer/transactions", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const cursor = decodeCursor(query, "transactions");
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
      values.push(queryInteger(query.workchain, "workchain"), decimalString(query.shard, "shard"), queryInteger(query.seqno, "seqno"));
      filters.push(`t.workchain=$${values.length - 2} AND t.shard=$${values.length - 1} AND t.seqno=$${values.length}`);
    }
    const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    if (cursor) {
      values.push(cursorString(cursor, "indexed"), cursorString(cursor, "lt"), cursorString(cursor, "hash"));
      filters.push(`(t.indexed_at<$${values.length - 2}
        OR (t.indexed_at=$${values.length - 2} AND t.lt<$${values.length - 1})
        OR (t.indexed_at=$${values.length - 2} AND t.lt=$${values.length - 1} AND t.hash>$${values.length}))`);
    }
    const pagedWhere = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    const countValues = [...values];
    if (cursor) countValues.splice(-3, 3);
    values.push(cursor ? 0 : offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(`${TX_SELECT}${pagedWhere} ORDER BY t.indexed_at DESC,t.lt DESC,t.hash OFFSET $${values.length - 1} LIMIT $${values.length}`, values),
      db.pool.query(`SELECT count(*)::int total FROM explorer_transactions t${where}`, countValues),
    ]);
    const last = rows.rows.at(-1);
    return {
      ok: true, total: total.rows[0].total, offset: cursor ? 0 : offset, limit,
      next_cursor: rows.rows.length === limit && last ? encodeCursor("transactions", {
        indexed: String(last.indexed_at), lt: String(last.lt), hash: last.hash,
      }) : null,
      result: rows.rows.map(transaction),
    };
  });

  app.get("/explorer/transaction", async (request, reply) => {
    const hash = String((request.query as Record<string, unknown>).hash ?? "").trim();
    const result = await db.pool.query(`${TX_SELECT} WHERE t.hash=$1`, [hash]);
    if (!result.rows[0]) return reply.code(404).send({ ok: false, error: { message: "transaction hash is not indexed" } });
    return { ok: true, result: transaction(result.rows[0]) };
  });

  app.get("/explorer/message", async (request, reply) => {
    const hash = String((request.query as Record<string, unknown>).hash ?? "").trim();
    if (!hash) throw Object.assign(new Error("message hash is required"), { statusCode: 400 });
    const result = await db.pool.query(
      `SELECT m.*,t.account,t.lt transaction_lt,t.workchain,t.shard,t.seqno
       FROM explorer_messages m JOIN explorer_transactions t ON t.hash=m.transaction_hash
       WHERE m.hash=$1 ORDER BY m.direction,t.lt`, [hash],
    );
    if (result.rows.length === 0) return reply.code(404).send({ ok: false, error: { message: "message hash is not indexed" } });
    return { ok: true, result: { hash, occurrences: result.rows.map(message) } };
  });

  app.get("/explorer/dns/domains", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const filters: string[] = [];
    const values: unknown[] = [];
    if (query.status !== undefined) {
      const status = String(query.status);
      if (!["auction", "auction-ended-unfinalized", "leased", "releasable"].includes(status)) {
        throw Object.assign(new Error("invalid DNS lifecycle status"), { statusCode: 400 });
      }
      values.push(status);
      filters.push(`status_current=$${values.length}`);
    }
    if (query.owner !== undefined) {
      const owner = String(query.owner).toLowerCase();
      if (!ADDRESS.test(owner)) throw Object.assign(new Error("invalid DNS owner address"), { statusCode: 400 });
      values.push(owner);
      filters.push(`owner=$${values.length}`);
    }
    if (query.safe !== undefined) {
      if (query.safe !== "true" && query.safe !== "false") {
        throw Object.assign(new Error("DNS safe filter must be true or false"), { statusCode: 400 });
      }
      values.push(query.safe === "true");
      filters.push(`safe_current=$${values.length}`);
    }
    const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    values.push(offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(`SELECT * FROM (${DNS_CURRENT_SELECT}) dns${where} ORDER BY name OFFSET $${values.length - 1} LIMIT $${values.length}`, values),
      db.pool.query(`SELECT count(*)::int total FROM (${DNS_CURRENT_SELECT}) dns${where}`, values.slice(0, -2)),
    ]);
    return { ok: true, total: total.rows[0].total, offset, limit, result: rows.rows.map(dnsDomain) };
  });

  app.get<{ Params: { name: string } }>("/explorer/dns/domains/:name", async (request, reply) => {
    const name = request.params.name;
    if (name.length > 130 || name !== name.toLowerCase() || !name.endsWith(".tos")) {
      throw Object.assign(new Error("invalid canonical .tos name"), { statusCode: 400 });
    }
    const [current, history] = await Promise.all([
      db.pool.query(`SELECT * FROM (${DNS_CURRENT_SELECT}) dns WHERE name=$1`, [name]),
      db.pool.query(
        `SELECT h.address,h.account_seqno,h.observed_mc_seqno,h.observed_at::text,
                h.root_hash,h.file_hash,h.data
         FROM explorer_dns_domain_history h WHERE h.data->>'name'=$1
         ORDER BY h.observed_mc_seqno DESC,h.address LIMIT 512`,
        [name],
      ),
    ]);
    if (!current.rows[0]) return reply.code(404).send({ ok: false, error: { message: ".tos domain is not indexed" } });
    return { ok: true, result: {
      current: dnsDomain(current.rows[0]),
      history: history.rows.map((row) => ({ ...row, observed_at: Number(row.observed_at) })),
    } };
  });

  app.get("/explorer/economy", async () => {
    const result = await db.pool.query(`SELECT
      count(*) FILTER (WHERE kind='agent_account')::int agents,
      count(*) FILTER (WHERE kind='task_escrow')::int tasks,
      count(*) FILTER (WHERE kind='task_escrow' AND status='open')::int open_tasks,
      count(*) FILTER (WHERE kind='task_escrow' AND status='settled')::int settled_tasks,
      count(*) FILTER (WHERE kind='service_actor')::int services,
      count(*) FILTER (WHERE kind='dispute')::int disputes,
      COALESCE(sum(CASE WHEN kind='task_escrow' AND (data->>'budget') ~ '^[0-9]+$'
        THEN (data->>'budget')::numeric ELSE 0 END),0)::text total_task_budget,
      COALESCE(sum(CASE WHEN kind='service_actor' AND (data->>'withdrawable_revenue') ~ '^[0-9]+$'
        THEN (data->>'withdrawable_revenue')::numeric ELSE 0 END),0)::text service_revenue
      FROM explorer_contracts`);
    const statuses = await db.pool.query(
      "SELECT status,count(*)::int count FROM explorer_contracts WHERE kind='task_escrow' GROUP BY status ORDER BY count DESC,status",
    );
    return { ok: true, result: { ...result.rows[0], task_statuses: statuses.rows } };
  });

  app.get("/explorer/staking", async (_request, reply) => {
    const [overview, cycles, pools] = await Promise.all([
      db.pool.query("SELECT data,updated_at FROM explorer_staking_overview WHERE singleton=true"),
      db.pool.query(`SELECT election_id::text,unfreeze_at::text,duration_seconds::text,
        total_stake::text,rewards::text,reward_rate,annualized_apr,compounded_apy,
        validator_count,vset_hash,observed_at::text
        FROM explorer_staking_cycles ORDER BY election_id DESC LIMIT 64`),
      db.pool.query("SELECT * FROM explorer_contracts WHERE kind='contract.pool.nominator' ORDER BY updated_at DESC,address LIMIT 200"),
    ]);
    if (!overview.rows[0]) {
      return reply.code(503).send({ ok: false, error: { message: "staking projection has not completed" } });
    }
    return { ok: true, result: {
      ...overview.rows[0].data,
      updated_at: Number(overview.rows[0].updated_at),
      cycles: cycles.rows.map((row) => ({
        election_id: Number(row.election_id),
        unfreeze_at: Number(row.unfreeze_at),
        duration_seconds: Number(row.duration_seconds),
        total_stake: row.total_stake,
        rewards: row.rewards,
        reward_rate: row.reward_rate,
        annualized_apr: row.annualized_apr,
        compounded_apy: row.compounded_apy,
        validator_count: row.validator_count,
        vset_hash: row.vset_hash,
        observed_at: Number(row.observed_at),
      })),
      pool_records: pools.rows.map(contract),
    } };
  });

  app.get<{ Params: { address: string } }>("/explorer/staking/pools/:address", async (request, reply) => {
    const address = request.params.address.toLowerCase();
    if (!ADDRESS.test(address)) throw Object.assign(new Error("invalid TOS address"), { statusCode: 400 });
    const [pool, history, cycles, overview] = await Promise.all([
      db.pool.query(
        "SELECT * FROM explorer_contracts WHERE kind='contract.pool.nominator' AND address=$1",
        [address],
      ),
      db.pool.query(
        `SELECT observed_at::text,status,last_seqno,data FROM explorer_pool_snapshots
         WHERE address=$1 ORDER BY observed_at DESC LIMIT 512`,
        [address],
      ),
      db.pool.query(
        `SELECT election_id::text,unfreeze_at::text,duration_seconds::text,total_stake::text,
                rewards::text,reward_rate,annualized_apr,compounded_apy,validator_count,
                vset_hash,observed_at::text
         FROM explorer_staking_cycles ORDER BY election_id DESC LIMIT 128`,
      ),
      db.pool.query("SELECT data FROM explorer_staking_overview WHERE singleton=true"),
    ]);
    if (!pool.rows[0]) {
      return reply.code(404).send({ ok: false, error: { message: "Nominator Pool is not indexed" } });
    }
    return { ok: true, result: {
      pool: contract(pool.rows[0]),
      history: history.rows.map((row) => ({ ...row, observed_at: Number(row.observed_at) })),
      network_reward_cycles: cycles.rows.map((row) => ({
        ...row,
        election_id: Number(row.election_id),
        unfreeze_at: Number(row.unfreeze_at),
        duration_seconds: Number(row.duration_seconds),
        observed_at: Number(row.observed_at),
      })),
      effective_stake: overview.rows[0]?.data?.effective_stake ?? null,
    } };
  });

  app.get("/explorer/validators", async (_request, reply) => {
    const [latest, overview, cycle] = await Promise.all([
      db.pool.query(
        "SELECT observed_mc_seqno,observed_at,data FROM explorer_validator_sets ORDER BY observed_mc_seqno DESC LIMIT 1",
      ),
      db.pool.query("SELECT data,updated_at FROM explorer_staking_overview WHERE singleton=true"),
      db.pool.query(
        `SELECT election_id::text,unfreeze_at::text,duration_seconds::text,total_stake::text,
                rewards::text,reward_rate,annualized_apr,compounded_apy,validator_count,
                vset_hash,observed_at::text
         FROM explorer_staking_cycles ORDER BY election_id DESC LIMIT 1`,
      ),
    ]);
    if (!latest.rows[0]) {
      return reply.code(503).send({ ok: false, error: { message: "validator projection has not completed" } });
    }
    const snapshot = latest.rows[0].data as Record<string, unknown>;
    const latestCycle = cycle.rows[0] ? {
      ...cycle.rows[0],
      election_id: Number(cycle.rows[0].election_id),
      unfreeze_at: Number(cycle.rows[0].unfreeze_at),
      duration_seconds: Number(cycle.rows[0].duration_seconds),
      observed_at: Number(cycle.rows[0].observed_at),
    } : null;
    const staking = overview.rows[0] ? {
      current_election_available: Boolean(overview.rows[0].data.current_election_available),
      active_election_id: Number(overview.rows[0].data.active_election_id ?? 0),
      election_closes_at: Number(overview.rows[0].data.election_closes_at ?? 0),
      current_election_stake: String(overview.rows[0].data.current_election_stake ?? "0"),
      current_participants: Number(overview.rows[0].data.current_participants ?? 0),
      latest_cycle: latestCycle,
      effective_stake: overview.rows[0].data.effective_stake ?? null,
    } : null;
    return { ok: true, result: {
      ...snapshot,
      observed_mc_seqno: Number(snapshot.observed_mc_seqno ?? latest.rows[0].observed_mc_seqno),
      observed_at: Number(snapshot.observed_at ?? latest.rows[0].observed_at),
      staking,
    } };
  });

  app.get<{ Params: { publicKey: string } }>("/explorer/validators/:publicKey", async (request, reply) => {
    const publicKey = canonicalValidatorPublicKey(request.params.publicKey);
    if (!/^[A-Za-z0-9_+\-/=]{8,256}$/.test(publicKey)) {
      throw Object.assign(new Error("invalid validator public key"), { statusCode: 400 });
    }
    const [sets, cycles, overview] = await Promise.all([
      db.pool.query("SELECT observed_mc_seqno,observed_at,data FROM explorer_validator_sets ORDER BY observed_mc_seqno DESC LIMIT 2048"),
      db.pool.query(
        `SELECT election_id::text,unfreeze_at::text,duration_seconds::text,total_stake::text,
                rewards::text,reward_rate,annualized_apr,compounded_apy,validator_count,
                vset_hash,observed_at::text
         FROM explorer_staking_cycles ORDER BY election_id DESC LIMIT 128`,
      ),
      db.pool.query("SELECT data FROM explorer_staking_overview WHERE singleton=true"),
    ]);
    const history = sets.rows.flatMap((row) => {
      const snapshot = row.data as {
        observed_mc_seqno: number;
        observed_at: number;
        validator_set?: { total_weight?: string; validators?: Array<Record<string, unknown>> } | null;
        next_validator_set?: { total_weight?: string; validators?: Array<Record<string, unknown>> } | null;
      };
      const currentMember = snapshot.validator_set?.validators?.find((candidate) => candidate.public_key === publicKey);
      const nextMember = snapshot.next_validator_set?.validators?.find((candidate) => candidate.public_key === publicKey);
      const member = currentMember ?? nextMember;
      return member ? [{
        observed_mc_seqno: snapshot.observed_mc_seqno ?? row.observed_mc_seqno,
        observed_at: snapshot.observed_at ?? Number(row.observed_at),
        total_weight: currentMember ? snapshot.validator_set?.total_weight ?? "0" : snapshot.next_validator_set?.total_weight ?? "0",
        selection_phase: currentMember ? "current" : "next",
        ...member,
      }] : [];
    });
    if (!history.length) {
      return reply.code(404).send({ ok: false, error: { message: "validator is not present in retained set history" } });
    }
    const latest = sets.rows[0]?.data as {
      observed_mc_seqno?: number;
      validator_set?: { utime_until?: number; validators?: Array<Record<string, unknown>> } | null;
      next_validator_set?: { utime_since?: number; utime_until?: number; validators?: Array<Record<string, unknown>> } | null;
      signatures?: Array<Record<string, unknown>>;
    } | undefined;
    const currentlySelected = Boolean(latest?.validator_set?.validators?.some((candidate) => candidate.public_key === publicKey));
    const selectedForNextSet = Boolean(latest?.next_validator_set?.validators?.some((candidate) => candidate.public_key === publicKey));
    return { ok: true, result: {
      public_key: publicKey,
      current: history[0],
      currently_selected: currentlySelected,
      selected_for_next_set: selectedForNextSet,
      current_set_valid_until: latest?.validator_set?.utime_until ?? null,
      next_set_valid_from: latest?.next_validator_set?.utime_since ?? null,
      next_set_valid_until: latest?.next_validator_set?.utime_until ?? null,
      latest_observed_mc_seqno: latest?.observed_mc_seqno ?? history[0]?.observed_mc_seqno,
      observed_signature_count: latest?.signatures?.length ?? 0,
      selected_sets: history.length,
      first_observed_at: history.at(-1)?.observed_at ?? history[0]?.observed_at,
      last_observed_at: history[0]?.observed_at,
      history,
      network_reward_cycles: cycles.rows.map((row) => ({
        ...row,
        election_id: Number(row.election_id),
        unfreeze_at: Number(row.unfreeze_at),
        duration_seconds: Number(row.duration_seconds),
        observed_at: Number(row.observed_at),
      })),
      effective_stake: overview.rows[0]?.data?.effective_stake ?? null,
      reward_attribution_available: false,
      signature_attribution_available: false,
    } };
  });

  app.get("/explorer/analytics", async (request) => {
    const query = request.query as Record<string, unknown>;
    const window = String(query.window ?? "7d");
    const windows: Record<string, { seconds: number; bucket: string }> = {
      "24h": { seconds: 86_400, bucket: "hour" },
      "7d": { seconds: 604_800, bucket: "hour" },
      "30d": { seconds: 2_592_000, bucket: "day" },
      "90d": { seconds: 7_776_000, bucket: "day" },
    };
    const selected = windows[window];
    if (!selected) throw Object.assign(new Error("unsupported analytics window"), { statusCode: 400 });
    const since = Math.floor(Date.now() / 1000) - selected.seconds;
    const [activity, contracts, assets] = await Promise.all([
      db.pool.query(
        `SELECT extract(epoch from date_trunc($1,to_timestamp(b.gen_utime)))::bigint::text bucket,
                count(DISTINCT (b.workchain,b.shard,b.seqno))::int blocks,
                count(t.hash)::int transactions,
                COALESCE(sum(t.fee),0)::text fees
         FROM explorer_blocks b LEFT JOIN explorer_transactions t
           ON t.workchain=b.workchain AND t.shard=b.shard AND t.seqno=b.seqno
         WHERE b.gen_utime >= $2
         GROUP BY 1 ORDER BY 1`,
        [selected.bucket, since],
      ),
      db.pool.query("SELECT kind,count(*)::int count FROM explorer_contracts GROUP BY kind ORDER BY kind"),
      db.pool.query("SELECT kind,count(*)::int count FROM explorer_assets GROUP BY kind ORDER BY kind"),
    ]);
    return { ok: true, result: {
      window,
      bucket_seconds: selected.bucket === "hour" ? 3_600 : 86_400,
      activity: activity.rows.map((row) => ({ ...row, bucket: Number(row.bucket) })),
      contracts: contracts.rows,
      assets: assets.rows,
    } };
  });

  app.get("/explorer/governance/history", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const [rows, total] = await Promise.all([
      db.pool.query(
        `SELECT observed_mc_seqno,observed_at,data
         FROM explorer_governance_snapshots
         ORDER BY observed_mc_seqno DESC OFFSET $1 LIMIT $2`,
        [offset, limit],
      ),
      db.pool.query("SELECT count(*)::int total FROM explorer_governance_snapshots"),
    ]);
    return {
      ok: true,
      total: total.rows[0].total,
      offset,
      limit,
      complete: true,
      result: rows.rows.map((row) => ({
        ...row.data,
        observed_mc_seqno: Number(row.observed_mc_seqno),
        observed_at: Number(row.observed_at),
      })),
    };
  });

  app.get<{ Params: { address: string } }>("/explorer/labels/:address", async (request, reply) => {
    const address = request.params.address.toLowerCase();
    if (!ADDRESS.test(address)) throw Object.assign(new Error("invalid TOS address"), { statusCode: 400 });
    const [curated, indexed] = await Promise.all([
      db.pool.query("SELECT address,label,category,source,source_url,verified,updated_at::text FROM explorer_address_labels WHERE address=$1", [address]),
      db.pool.query("SELECT kind,data FROM explorer_contracts WHERE address=$1", [address]),
    ]);
    if (curated.rows[0]) {
      return { ok: true, result: { ...curated.rows[0], updated_at: Number(curated.rows[0].updated_at) } };
    }
    if (indexed.rows[0]) {
      const names: Record<string, string> = {
        agent_account: "Agent Account",
        task_escrow: "Task Escrow",
        dispute: "Dispute",
        service_actor: "Service Actor",
        capability_registry: "Capability Registry",
        aipow_commitment: "AIPoW Commitment",
        aipow_distributor: "AIPoW Distributor",
        "contract.pool.nominator": "Nominator Pool",
      };
      return { ok: true, result: {
        address,
        label: names[indexed.rows[0].kind] ?? indexed.rows[0].kind,
        category: indexed.rows[0].kind,
        source: "code-hash classification",
        source_url: null,
        verified: true,
        updated_at: 0,
      } };
    }
    return reply.code(404).send({ ok: false, error: { message: "address has no public label" } });
  });

  app.get("/explorer/assets", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const kind = query.kind === undefined ? null : String(query.kind);
    if (kind && !["jetton", "nft_item", "nft_collection"].includes(kind)) {
      throw Object.assign(new Error("unsupported asset kind"), { statusCode: 400 });
    }
    const cursorKind = `assets:${kind ?? "all"}`;
    const cursor = decodeCursor(query, cursorKind);
    const values: unknown[] = [];
    const filters: string[] = [];
    if (kind) {
      values.push(kind);
      filters.push(`a.kind=$${values.length}`);
    }
    const countValues = [...values];
    const countWhere = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    if (cursor) {
      values.push(cursorString(cursor, "updated"), cursorString(cursor, "address"));
      filters.push(`(a.updated_at<$${values.length - 1} OR (a.updated_at=$${values.length - 1} AND a.address>$${values.length}))`);
    }
    const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    values.push(cursor ? 0 : offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(`SELECT a.*,(SELECT count(*) FROM explorer_asset_positions p WHERE p.asset_address=a.address) holder_count
        FROM explorer_assets a${where} ORDER BY a.updated_at DESC,a.address OFFSET $${values.length - 1} LIMIT $${values.length}`, values),
      db.pool.query(`SELECT count(*)::int total FROM explorer_assets a${countWhere}`, countValues),
    ]);
    const last = rows.rows.at(-1);
    return {
      ok: true, total: total.rows[0].total, offset: cursor ? 0 : offset, limit,
      next_cursor: rows.rows.length === limit && last ? encodeCursor(cursorKind, {
        updated: String(last.updated_at), address: last.address,
      }) : null,
      result: rows.rows.map(asset),
    };
  });

  app.get("/explorer/assets/activity", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const filters: string[] = [];
    const values: unknown[] = [];
    if (query.asset !== undefined) {
      const address = String(query.asset).toLowerCase();
      if (!ADDRESS.test(address)) throw Object.assign(new Error("invalid TOS address"), { statusCode: 400 });
      values.push(address);
      filters.push(`asset_address=$${values.length}`);
    }
    if (query.kind !== undefined) {
      const kind = String(query.kind);
      if (!["jetton", "nft_item"].includes(kind)) {
        throw Object.assign(new Error("unsupported asset activity kind"), { statusCode: 400 });
      }
      values.push(kind);
      filters.push(`kind=$${values.length}`);
    }
    const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    const countValues = [...values];
    values.push(offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(
        `SELECT * FROM explorer_asset_position_events${where}
         ORDER BY observed_at DESC,id DESC OFFSET $${values.length - 1} LIMIT $${values.length}`,
        values,
      ),
      db.pool.query(`SELECT count(*)::int total FROM explorer_asset_position_events${where}`, countValues),
    ]);
    return { ok: true, total: total.rows[0].total, offset, limit, complete: true, result: rows.rows.map(assetPositionEvent) };
  });

  app.get<{ Params: { address: string } }>("/explorer/assets/:address/holders", async (request) => {
    const address = request.params.address.toLowerCase();
    if (!ADDRESS.test(address)) throw Object.assign(new Error("invalid TOS address"), { statusCode: 400 });
    const { offset, limit } = page(request.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      db.pool.query(
        `SELECT owner_address,position_address,kind,last_lt::text
         FROM explorer_asset_positions WHERE asset_address=$1
         ORDER BY last_lt DESC,owner_address OFFSET $2 LIMIT $3`,
        [address, offset, limit],
      ),
      db.pool.query("SELECT count(*)::int total FROM explorer_asset_positions WHERE asset_address=$1", [address]),
    ]);
    return { ok: true, total: total.rows[0].total, offset, limit, complete: true, result: rows.rows };
  });

  app.get<{ Params: { address: string } }>("/explorer/assets/:address/items", async (request) => {
    const address = request.params.address.toLowerCase();
    if (!ADDRESS.test(address)) throw Object.assign(new Error("invalid TOS address"), { statusCode: 400 });
    const { offset, limit } = page(request.query as Record<string, unknown>);
    const [rows, total] = await Promise.all([
      db.pool.query(
        `SELECT a.*,(SELECT count(*) FROM explorer_asset_positions p WHERE p.asset_address=a.address) holder_count
         FROM explorer_assets a
         WHERE a.kind='nft_item' AND lower(COALESCE(a.data->>'collection_address',''))=$1
         ORDER BY a.updated_at DESC,a.address OFFSET $2 LIMIT $3`,
        [address, offset, limit],
      ),
      db.pool.query(
        `SELECT count(*)::int total FROM explorer_assets
         WHERE kind='nft_item' AND lower(COALESCE(data->>'collection_address',''))=$1`,
        [address],
      ),
    ]);
    return { ok: true, total: total.rows[0].total, offset, limit, complete: true, result: rows.rows.map(asset) };
  });

  app.get<{ Params: { address: string } }>("/explorer/assets/:address", async (request, reply) => {
    const address = request.params.address.toLowerCase();
    const result = await db.pool.query(
      `SELECT a.*,(SELECT count(*) FROM explorer_asset_positions p WHERE p.asset_address=a.address) holder_count
       FROM explorer_assets a WHERE a.address=$1`, [address],
    );
    if (!result.rows[0]) return reply.code(404).send({ ok: false, error: { message: "asset is not indexed" } });
    const { offset, limit } = page(request.query as Record<string, unknown>);
    const holders = await db.pool.query(
      `SELECT owner_address,position_address,kind,last_lt::text FROM explorer_asset_positions
       WHERE asset_address=$1 ORDER BY last_lt DESC,owner_address OFFSET $2 LIMIT $3`,
      [address, offset, limit],
    );
    return { ok: true, result: { ...asset(result.rows[0]), holders: holders.rows, offset, limit } };
  });

  app.get<{ Params: { address: string } }>("/explorer/verifications/:address", async (request, reply) => {
    const address = request.params.address.toLowerCase();
    if (!ADDRESS.test(address)) throw Object.assign(new Error("invalid TOS address"), { statusCode: 400 });
    const result = await db.pool.query(
      `SELECT address,compiler,compiler_version,repository_url,source_commit,source_digest,
              build_command,verified_at,observed_mc_seqno,manifest
       FROM explorer_contract_verifications WHERE address=$1`, [address],
    );
    if (!result.rows[0]) return reply.code(404).send({ ok: false, error: { message: "contract has no matched build attestation" } });
    return { ok: true, result: { ...result.rows[0], verified_at: Number(result.rows[0].verified_at) } };
  });

  app.get("/explorer/verifications", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { offset, limit } = page(query);
    const [rows, total] = await Promise.all([
      db.pool.query(
        `SELECT address,compiler,compiler_version,repository_url,source_commit,source_digest,
                build_command,verified_at::text,observed_mc_seqno,manifest
         FROM explorer_contract_verifications ORDER BY verified_at DESC,address OFFSET $1 LIMIT $2`,
        [offset, limit],
      ),
      db.pool.query("SELECT count(*)::int total FROM explorer_contract_verifications"),
    ]);
    return {
      ok: true,
      total: total.rows[0].total,
      offset,
      limit,
      complete: true,
      result: rows.rows.map((row) => ({ ...row, verified_at: Number(row.verified_at) })),
    };
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
    const cursor = decodeCursor(query, `contracts:${kind}`);
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
        const value = Number(query[key]);
        if (!Number.isFinite(value)) throw Object.assign(new Error(`${key} must be numeric`), { statusCode: 400 });
        values.push(String(value));
        filters.push(`deadline${op}$${values.length}`);
      }
    }
    const countFilters = [...filters];
    const countValues = [...values];
    if (cursor) {
      values.push(cursorString(cursor, "updated"), cursorString(cursor, "address"));
      filters.push(`(updated_at<$${values.length - 1} OR (updated_at=$${values.length - 1} AND address>$${values.length}))`);
    }
    const where = ` WHERE ${filters.join(" AND ")}`;
    const countWhere = ` WHERE ${countFilters.join(" AND ")}`;
    values.push(cursor ? 0 : offset, limit);
    const [rows, total] = await Promise.all([
      db.pool.query(`SELECT * FROM explorer_contracts${where} ORDER BY updated_at DESC,address OFFSET $${values.length - 1} LIMIT $${values.length}`, values),
      db.pool.query(`SELECT count(*)::int total FROM explorer_contracts${countWhere}`, countValues),
    ]);
    const last = rows.rows.at(-1);
    return {
      ok: true, total: total.rows[0].total, offset: cursor ? 0 : offset, limit,
      next_cursor: rows.rows.length === limit && last ? encodeCursor(`contracts:${kind}`, {
        updated: String(last.updated_at), address: last.address,
      }) : null,
      result: rows.rows.map(contract),
    };
  });

  app.get<{ Params: { kind: string; address: string } }>("/explorer/contracts/:kind/:address", async (request, reply) => {
    const result = await db.pool.query("SELECT * FROM explorer_contracts WHERE kind=$1 AND address=$2", [request.params.kind, request.params.address.toLowerCase()]);
    if (!result.rows[0]) return reply.code(404).send({ ok: false, error: { message: "contract is not indexed under this kind" } });
    return { ok: true, result: contract(result.rows[0]) };
  });

  app.get("/explorer/search/suggest", async (request) => {
    const query = request.query as Record<string, unknown>;
    const q = String(query.q ?? "").trim();
    if (q.length < 2) return { ok: true, result: [] };
    if (q.length > 256) throw Object.assign(new Error("search query is too long"), { statusCode: 400 });
    const limit = Math.min(12, Math.max(1, Number(query.limit ?? 8) || 8));
    const prefix = `${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    const [domains, labels, contracts, assets, transactions, messages, blocks, verifications] = await Promise.all([
      db.pool.query("SELECT name,address,status FROM explorer_dns_domains WHERE name LIKE $1 ORDER BY name LIMIT 4", [prefix]),
      db.pool.query(
        `SELECT address,label,category FROM explorer_address_labels
         WHERE lower(label) LIKE $1 OR address LIKE $1
         ORDER BY CASE WHEN lower(label) LIKE $1 THEN 0 ELSE 1 END,label LIMIT 4`,
        [prefix],
      ),
      db.pool.query(
        `SELECT address,kind,status,data FROM explorer_contracts
         WHERE address LIKE $1
            OR lower(COALESCE(data->>'name',data->>'title','')) LIKE $1
         ORDER BY updated_at DESC LIMIT 4`,
        [prefix],
      ),
      db.pool.query(
        `SELECT address,kind,data FROM explorer_assets
         WHERE address LIKE $1
            OR lower(COALESCE(data->>'jetton_name',data->>'jetton_symbol','')) LIKE $1
         ORDER BY updated_at DESC LIMIT 4`,
        [prefix],
      ),
      db.pool.query("SELECT hash,account,lt::text FROM explorer_transactions WHERE lower(hash) LIKE $1 ORDER BY indexed_at DESC LIMIT 3", [prefix]),
      db.pool.query("SELECT DISTINCT ON (hash) hash,kind,source,destination FROM explorer_messages WHERE lower(hash) LIKE $1 ORDER BY hash,created_lt DESC LIMIT 3", [prefix]),
      /^\d+$/.test(q)
        ? db.pool.query("SELECT workchain,shard::text,seqno,root_hash FROM explorer_blocks WHERE seqno=$1 ORDER BY workchain,shard LIMIT 3", [Number(q)])
        : db.pool.query("SELECT workchain,shard::text,seqno,root_hash FROM explorer_blocks WHERE lower(root_hash) LIKE $1 OR lower(file_hash) LIKE $1 ORDER BY observed_mc_seqno DESC LIMIT 3", [prefix]),
      db.pool.query("SELECT address,compiler,repository_url FROM explorer_contract_verifications WHERE address LIKE $1 ORDER BY verified_at DESC LIMIT 3", [prefix]),
    ]);
    const routeForContract = (kind: string, address: string) => {
      const name = ({ agent_account: "agent", task_escrow: "task", service_actor: "service", dispute: "dispute" } as Record<string, string>)[kind] ?? "address";
      return `/${name}/${address}`;
    };
    const suggestions = [
      ...domains.rows.map((row) => ({ kind: "domain", title: row.name, subtitle: row.status, value: row.address, route: `/domain/${row.name}` })),
      ...labels.rows.map((row) => ({ kind: "label", title: row.label, subtitle: row.category, value: row.address, route: `/address/${row.address}` })),
      ...contracts.rows.map((row) => ({ kind: "contract", title: row.data?.name ?? row.kind, subtitle: row.status ?? row.kind, value: row.address, route: routeForContract(row.kind, row.address) })),
      ...assets.rows.map((row) => ({ kind: "asset", title: row.data?.jetton_name ?? row.data?.jetton_symbol ?? row.kind, subtitle: row.kind, value: row.address, route: `/token/${row.address}` })),
      ...transactions.rows.map((row) => ({ kind: "transaction", title: row.hash, subtitle: `LT ${row.lt}`, value: row.hash, route: `/tx/${row.account}/${row.lt}/${row.hash}` })),
      ...messages.rows.map((row) => ({ kind: "message", title: row.hash, subtitle: row.kind, value: row.hash, route: `/message/${row.hash}` })),
      ...blocks.rows.map((row) => ({ kind: "block", title: `Block ${row.seqno}`, subtitle: row.root_hash, value: String(row.seqno), route: `/block/${row.workchain}/${row.shard}/${row.seqno}` })),
      ...verifications.rows.map((row) => ({ kind: "verification", title: "Verified contract", subtitle: row.compiler, value: row.address, route: `/contracts/verified/${row.address}` })),
    ];
    const seen = new Set<string>();
    return { ok: true, result: suggestions.filter((item) => {
      if (seen.has(item.route)) return false;
      seen.add(item.route);
      return true;
    }).slice(0, limit) };
  });

  app.get("/explorer/search", async (request) => {
    const q = String((request.query as Record<string, unknown>).q ?? "").trim();
    if (!q) throw Object.assign(new Error("search query is required"), { statusCode: 400 });
    if (q.length > 256) throw Object.assign(new Error("search query is too long"), { statusCode: 400 });
    const foundDomain = await db.pool.query(`SELECT * FROM (${DNS_CURRENT_SELECT}) dns WHERE name=$1`, [q.toLowerCase()]);
    if (foundDomain.rows[0]) return { ok: true, result: { kind: "domain", result: dnsDomain(foundDomain.rows[0]) } };
    const tx = await db.pool.query(`${TX_SELECT} WHERE t.hash=$1`, [q]);
    if (tx.rows[0]) return { ok: true, result: { kind: "transaction", result: transaction(tx.rows[0]) } };
    const foundMessage = await db.pool.query(
      `SELECT m.*,t.account,t.lt transaction_lt,t.workchain,t.shard,t.seqno
       FROM explorer_messages m JOIN explorer_transactions t ON t.hash=m.transaction_hash
       WHERE m.hash=$1 ORDER BY m.direction LIMIT 1`, [q],
    );
    if (foundMessage.rows[0]) return { ok: true, result: { kind: "message", result: message(foundMessage.rows[0]) } };
    const foundBlock = await db.pool.query(
      `${BLOCK_SELECT} WHERE b.root_hash=ANY($1::text[]) OR b.file_hash=ANY($1::text[])`,
      [hashCandidates(q)],
    );
    if (foundBlock.rows[0]) return { ok: true, result: { kind: "block", result: block(foundBlock.rows[0]) } };
    const foundLabel = await db.pool.query(
      "SELECT address,label,category,source,source_url,verified,updated_at::text FROM explorer_address_labels WHERE lower(label)=lower($1) LIMIT 1",
      [q],
    );
    if (foundLabel.rows[0]) {
      return { ok: true, result: { kind: "label", result: { ...foundLabel.rows[0], updated_at: Number(foundLabel.rows[0].updated_at) } } };
    }
    if (ADDRESS.test(q)) {
      const foundAsset = await db.pool.query(
        `SELECT a.*,(SELECT count(*) FROM explorer_asset_positions p WHERE p.asset_address=a.address) holder_count
         FROM explorer_assets a WHERE a.address=$1`, [q.toLowerCase()],
      );
      if (foundAsset.rows[0]) return { ok: true, result: { kind: "asset", result: asset(foundAsset.rows[0]) } };
      const foundContract = await db.pool.query("SELECT * FROM explorer_contracts WHERE address=$1", [q.toLowerCase()]);
      if (foundContract.rows[0]) return { ok: true, result: { kind: "contract", result: contract(foundContract.rows[0]) } };
    }
    return { ok: true, result: null };
  });

  return app;
}
