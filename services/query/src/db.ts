import pg from "pg";
import type { ExplorerContract, MasterchainBundle } from "./types.js";

const { Pool } = pg;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projection_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);
CREATE TABLE IF NOT EXISTS explorer_blocks (
  workchain integer NOT NULL,
  shard numeric(20,0) NOT NULL,
  seqno integer NOT NULL,
  root_hash text NOT NULL,
  file_hash text NOT NULL,
  gen_utime integer NOT NULL,
  observed_mc_seqno integer NOT NULL,
  indexed_at bigint NOT NULL,
  PRIMARY KEY (workchain, shard, seqno)
);
CREATE UNIQUE INDEX IF NOT EXISTS explorer_blocks_root_hash ON explorer_blocks(root_hash);
CREATE INDEX IF NOT EXISTS explorer_blocks_file_hash ON explorer_blocks(file_hash);
CREATE INDEX IF NOT EXISTS explorer_blocks_observed ON explorer_blocks(observed_mc_seqno);
CREATE TABLE IF NOT EXISTS explorer_transactions (
  hash text PRIMARY KEY,
  account text NOT NULL,
  lt numeric(20,0) NOT NULL,
  workchain integer NOT NULL,
  shard numeric(20,0) NOT NULL,
  seqno integer NOT NULL,
  fee numeric(40,0),
  in_msg_hash text,
  indexed_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS explorer_transactions_account ON explorer_transactions(account, lt DESC);
CREATE INDEX IF NOT EXISTS explorer_transactions_block ON explorer_transactions(workchain, shard, seqno, lt DESC);
CREATE INDEX IF NOT EXISTS explorer_transactions_recent ON explorer_transactions(indexed_at DESC, lt DESC);
CREATE TABLE IF NOT EXISTS explorer_contracts (
  address text PRIMARY KEY,
  kind text NOT NULL,
  creator text,
  counterparty text,
  status text,
  deadline numeric(20,0),
  last_seqno integer NOT NULL,
  updated_at bigint NOT NULL,
  data jsonb NOT NULL,
  sync_epoch bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS explorer_contracts_kind ON explorer_contracts(kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS explorer_contracts_filters ON explorer_contracts(kind, creator, status, deadline);
`;

export class ProjectionDb {
  readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: Number(process.env.QUERY_DB_POOL_SIZE ?? 20) });
  }

  async migrate(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async acquireProjectionLease(): Promise<(() => Promise<void>) | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock(1414480718) acquired",
      );
      if (!result.rows[0]?.acquired) {
        client.release();
        return null;
      }
      return async () => {
        try {
          await client.query("SELECT pg_advisory_unlock(1414480718)");
        } finally {
          client.release();
        }
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async checkpoint(): Promise<{ seqno: number; rootHash: string | null }> {
    const result = await this.pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM projection_meta WHERE key IN ('master_seqno', 'master_root')",
    );
    const values = new Map(result.rows.map((row) => [row.key, row.value]));
    return { seqno: Number(values.get("master_seqno") ?? 0), rootHash: values.get("master_root") ?? null };
  }

  async resetChain(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("TRUNCATE explorer_transactions, explorer_blocks, explorer_contracts");
      await client.query("DELETE FROM projection_meta WHERE key IN ('master_seqno', 'master_root')");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async applyBundle(bundle: MasterchainBundle): Promise<void> {
    await this.applyBundles([bundle]);
  }

  async applyBundles(bundles: MasterchainBundle[]): Promise<void> {
    if (bundles.length === 0) return;
    const ordered = [...bundles].sort((a, b) => a.seqno - b.seqno);
    const lastBundle = ordered.at(-1)!;
    const blockMap = new Map<string, MasterchainBundle["blocks"][number]>();
    for (const bundle of ordered) {
      for (const block of bundle.blocks) {
        blockMap.set(`${block.workchain}:${block.shard}:${block.seqno}`, block);
      }
    }
    const blocks = [...blockMap.values()];
    const blockRows = blocks.map((block) => ({
      workchain: block.workchain,
      shard: block.shard,
      seqno: block.seqno,
      root_hash: block.root_hash,
      file_hash: block.file_hash,
      gen_utime: block.gen_utime,
      observed_mc_seqno: block.observed_mc_seqno,
    }));
    const transactions = blocks.flatMap((block) => block.transactions);
    const client = await this.pool.connect();
    const indexedAt = Math.floor(Date.now() / 1000);
    try {
      await client.query("BEGIN");
      await client.query(
        `WITH incoming AS (
           SELECT * FROM jsonb_to_recordset($1::jsonb)
             AS x(workchain integer, shard numeric(20,0), seqno integer)
         )
         DELETE FROM explorer_transactions t USING incoming i
         WHERE t.workchain=i.workchain AND t.shard=i.shard AND t.seqno=i.seqno`,
        [JSON.stringify(blockRows)],
      );
      await client.query(
        `WITH incoming AS (
           SELECT * FROM jsonb_to_recordset($1::jsonb)
             AS x(workchain integer, shard numeric(20,0), seqno integer)
         ), stale AS (
           SELECT b.workchain,b.shard,b.seqno FROM explorer_blocks b
           WHERE b.observed_mc_seqno BETWEEN $2 AND $3
             AND NOT EXISTS (SELECT 1 FROM incoming i WHERE
               i.workchain=b.workchain AND i.shard=b.shard AND i.seqno=b.seqno)
         )
         DELETE FROM explorer_transactions t USING stale s
         WHERE t.workchain=s.workchain AND t.shard=s.shard AND t.seqno=s.seqno`,
        [JSON.stringify(blockRows), ordered[0]!.seqno, lastBundle.seqno],
      );
      await client.query(
        `WITH incoming AS (
           SELECT * FROM jsonb_to_recordset($1::jsonb)
             AS x(workchain integer, shard numeric(20,0), seqno integer)
         )
         DELETE FROM explorer_blocks b
         WHERE b.observed_mc_seqno BETWEEN $2 AND $3
           AND NOT EXISTS (SELECT 1 FROM incoming i WHERE
             i.workchain=b.workchain AND i.shard=b.shard AND i.seqno=b.seqno)`,
        [JSON.stringify(blockRows), ordered[0]!.seqno, lastBundle.seqno],
      );
      await client.query(
        `INSERT INTO explorer_blocks
          (workchain,shard,seqno,root_hash,file_hash,gen_utime,observed_mc_seqno,indexed_at)
         SELECT x.workchain,x.shard,x.seqno,x.root_hash,x.file_hash,x.gen_utime,
                x.observed_mc_seqno,$2
         FROM jsonb_to_recordset($1::jsonb) AS x(
           workchain integer, shard numeric(20,0), seqno integer, root_hash text,
           file_hash text, gen_utime integer, observed_mc_seqno integer
         )
         ON CONFLICT (workchain,shard,seqno) DO UPDATE SET
           root_hash=EXCLUDED.root_hash,file_hash=EXCLUDED.file_hash,
           gen_utime=EXCLUDED.gen_utime,observed_mc_seqno=EXCLUDED.observed_mc_seqno,
           indexed_at=EXCLUDED.indexed_at`,
        [JSON.stringify(blockRows), indexedAt],
      );
      if (transactions.length > 0) {
        await client.query(
          `INSERT INTO explorer_transactions
            (hash,account,lt,workchain,shard,seqno,fee,in_msg_hash,indexed_at)
           SELECT x.hash,x.account,x.lt,x.workchain,x.shard,x.seqno,x.fee,x.in_msg_hash,$2
           FROM jsonb_to_recordset($1::jsonb) AS x(
             hash text, account text, lt numeric(20,0), workchain integer,
             shard numeric(20,0), seqno integer, fee numeric(40,0), in_msg_hash text
           )
           ON CONFLICT (hash) DO UPDATE SET account=EXCLUDED.account,lt=EXCLUDED.lt,
             workchain=EXCLUDED.workchain,shard=EXCLUDED.shard,seqno=EXCLUDED.seqno,
             fee=EXCLUDED.fee,in_msg_hash=EXCLUDED.in_msg_hash,indexed_at=EXCLUDED.indexed_at`,
          [JSON.stringify(transactions), indexedAt],
        );
      }
      await client.query(
        `INSERT INTO projection_meta(key,value) VALUES ('master_seqno',$1),('master_root',$2)
         ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,
        [String(lastBundle.seqno), lastBundle.rootHash],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceContracts(kind: string, records: ExplorerContract[]): Promise<void> {
    const client = await this.pool.connect();
    const epoch = Date.now();
    try {
      await client.query("BEGIN");
      for (const record of records) {
        await client.query(
          `INSERT INTO explorer_contracts
            (address,kind,creator,counterparty,status,deadline,last_seqno,updated_at,data,sync_epoch)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT(address) DO UPDATE SET kind=EXCLUDED.kind, creator=EXCLUDED.creator,
             counterparty=EXCLUDED.counterparty, status=EXCLUDED.status,
             deadline=EXCLUDED.deadline, last_seqno=EXCLUDED.last_seqno,
             updated_at=EXCLUDED.updated_at, data=EXCLUDED.data, sync_epoch=EXCLUDED.sync_epoch`,
          [record.address, record.kind, record.creator, record.counterparty, record.status,
            record.deadline, record.last_seqno, record.updated_at, record.data, epoch],
        );
      }
      await client.query("DELETE FROM explorer_contracts WHERE kind=$1 AND sync_epoch<>$2", [kind, epoch]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
