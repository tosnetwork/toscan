import pg from "pg";
import type { DnsDomainHistoryItem, ExplorerAsset, ExplorerContract, ExplorerStakingResponse, GovernanceSnapshot, JettonPosition, MasterchainBundle, NftPosition, ValidatorSetSnapshot } from "./types.js";

const { Pool } = pg;
const SCHEMA_VERSION = 9;
const RAW_ADDRESS = /^-?\d+:[0-9a-f]{64}$/;
const HEX_HASH = /^[0-9a-f]{64}$/;
const DNS_LEASE_SECONDS = 31_622_400;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projection_schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
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
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(1414480719)");
      await client.query(
        "CREATE TABLE IF NOT EXISTS projection_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const current = await client.query<{ version: number }>(
        "SELECT COALESCE(max(version),0)::int version FROM projection_schema_migrations",
      );
      const version = current.rows[0]?.version ?? 0;
      if (version > SCHEMA_VERSION) {
        throw new Error(`database schema ${version} is newer than supported ${SCHEMA_VERSION}`);
      }
      if (version < 1) {
        await client.query(SCHEMA);
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (1)");
      }
      if (version < 2) {
        await client.query("ALTER TABLE explorer_transactions ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb");
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_messages (
          hash text NOT NULL,
          transaction_hash text NOT NULL REFERENCES explorer_transactions(hash) ON DELETE CASCADE,
          direction text NOT NULL CHECK (direction IN ('in','out')),
          kind text NOT NULL,
          source text,
          destination text,
          value numeric(40,0),
          bounced boolean,
          created_lt numeric(20,0),
          created_at integer,
          PRIMARY KEY(hash,transaction_hash,direction)
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_messages_hash ON explorer_messages(hash)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_messages_source ON explorer_messages(source,created_lt DESC)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_messages_destination ON explorer_messages(destination,created_lt DESC)");
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (2)");
      }
      if (version < 3) {
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_asset_accounts (
          address text PRIMARY KEY,
          last_seen_at bigint NOT NULL,
          scanned_at bigint NOT NULL DEFAULT 0
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_asset_accounts_pending ON explorer_asset_accounts(scanned_at,last_seen_at)");
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_assets (
          address text PRIMARY KEY,
          kind text NOT NULL CHECK (kind IN ('jetton','nft_item','nft_collection')),
          updated_at bigint NOT NULL,
          data jsonb NOT NULL
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_assets_kind ON explorer_assets(kind,updated_at DESC,address)");
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_asset_positions (
          owner_address text NOT NULL,
          asset_address text NOT NULL,
          position_address text,
          kind text NOT NULL CHECK (kind IN ('jetton','nft_item')),
          last_lt numeric(20,0) NOT NULL,
          PRIMARY KEY(owner_address,asset_address,kind)
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_asset_positions_asset ON explorer_asset_positions(asset_address,last_lt DESC,owner_address)");
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (3)");
      }
      if (version < 4) {
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_contract_verifications (
          address text PRIMARY KEY,
          compiler text NOT NULL,
          compiler_version text NOT NULL,
          repository_url text NOT NULL,
          source_commit text NOT NULL,
          source_digest text NOT NULL,
          build_command text NOT NULL,
          code_boc text NOT NULL,
          verified_at bigint NOT NULL,
          observed_mc_seqno integer NOT NULL,
          manifest jsonb NOT NULL
        )`);
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (4)");
      }
      if (version < 5) {
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_staking_overview (
          singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
          data jsonb NOT NULL,
          updated_at bigint NOT NULL
        )`);
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_staking_cycles (
          election_id bigint PRIMARY KEY,
          unfreeze_at bigint NOT NULL,
          duration_seconds bigint NOT NULL,
          total_stake numeric(40,0) NOT NULL,
          rewards numeric(40,0) NOT NULL,
          reward_rate double precision NOT NULL,
          annualized_apr double precision,
          compounded_apy double precision,
          validator_count integer NOT NULL,
          vset_hash text NOT NULL,
          observed_at bigint NOT NULL
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_staking_cycles_recent ON explorer_staking_cycles(election_id DESC)");
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (5)");
      }
      if (version < 6) {
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_pool_snapshots (
          address text NOT NULL,
          observed_at bigint NOT NULL,
          status text,
          last_seqno integer NOT NULL,
          data jsonb NOT NULL,
          PRIMARY KEY(address,observed_at)
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_pool_snapshots_recent ON explorer_pool_snapshots(address,observed_at DESC)");
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_validator_sets (
          observed_mc_seqno integer PRIMARY KEY,
          observed_at bigint NOT NULL,
          data jsonb NOT NULL
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_validator_sets_recent ON explorer_validator_sets(observed_at DESC,observed_mc_seqno DESC)");
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_address_labels (
          address text PRIMARY KEY,
          label text NOT NULL,
          category text NOT NULL,
          source text NOT NULL,
          source_url text,
          verified boolean NOT NULL DEFAULT false,
          updated_at bigint NOT NULL
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_address_labels_search ON explorer_address_labels(lower(label),category,address)");
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (6)");
      }
      if (version < 7) {
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_asset_position_events (
          id bigserial PRIMARY KEY,
          owner_address text NOT NULL,
          asset_address text NOT NULL,
          position_address text,
          kind text NOT NULL CHECK (kind IN ('jetton','nft_item')),
          event_type text NOT NULL CHECK (event_type IN ('observed','removed')),
          last_lt numeric(20,0) NOT NULL,
          observed_at bigint NOT NULL,
          UNIQUE(owner_address,asset_address,kind,last_lt,event_type)
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_asset_position_events_recent ON explorer_asset_position_events(observed_at DESC,id DESC)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_asset_position_events_asset ON explorer_asset_position_events(asset_address,observed_at DESC,id DESC)");
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_governance_snapshots (
          observed_mc_seqno integer PRIMARY KEY,
          observed_at bigint NOT NULL,
          data jsonb NOT NULL
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_governance_snapshots_recent ON explorer_governance_snapshots(observed_at DESC,observed_mc_seqno DESC)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_address_labels_prefix ON explorer_address_labels(lower(label) text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_address_labels_address_prefix ON explorer_address_labels(address text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_contracts_name_prefix ON explorer_contracts(lower(COALESCE(data->>'name',data->>'title','')) text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_contracts_address_prefix ON explorer_contracts(address text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_assets_name_prefix ON explorer_assets(lower(COALESCE(data->>'jetton_name',data->>'jetton_symbol','')) text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_assets_address_prefix ON explorer_assets(address text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_transactions_hash_prefix ON explorer_transactions(lower(hash) text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_messages_hash_prefix ON explorer_messages(lower(hash) text_pattern_ops)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_verifications_address_prefix ON explorer_contract_verifications(address text_pattern_ops)");
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (7)");
      }
      if (version < 8) {
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_dns_domain_history (
          address text NOT NULL,
          account_seqno integer NOT NULL,
          observed_mc_seqno integer NOT NULL,
          observed_at bigint NOT NULL,
          root_hash text NOT NULL,
          file_hash text NOT NULL,
          data jsonb NOT NULL,
          PRIMARY KEY(address,observed_mc_seqno)
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_dns_history_checkpoint ON explorer_dns_domain_history(observed_mc_seqno,address)");
        await client.query(`CREATE TABLE IF NOT EXISTS explorer_dns_domains (
          address text PRIMARY KEY,
          name text NOT NULL UNIQUE,
          status text NOT NULL,
          owner text,
          renewal_deadline bigint,
          safe_to_resolve boolean NOT NULL,
          observed_mc_seqno integer NOT NULL,
          observed_at bigint NOT NULL,
          root_hash text NOT NULL,
          file_hash text NOT NULL,
          data jsonb NOT NULL
        )`);
        await client.query("CREATE INDEX IF NOT EXISTS explorer_dns_domains_owner ON explorer_dns_domains(owner,name)");
        await client.query("CREATE INDEX IF NOT EXISTS explorer_dns_domains_status ON explorer_dns_domains(status,renewal_deadline,name)");
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (8)");
      }
      if (version < 9) {
        await client.query(
          "DELETE FROM explorer_contracts WHERE kind IN ('aipow_commitment','aipow_distributor')",
        );
        await client.query("INSERT INTO projection_schema_migrations(version) VALUES (9)");
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async schemaVersion(): Promise<number> {
    const result = await this.pool.query<{ version: number }>(
      "SELECT COALESCE(max(version),0)::int version FROM projection_schema_migrations",
    );
    return result.rows[0]?.version ?? 0;
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
      await client.query("TRUNCATE explorer_dns_domains, explorer_dns_domain_history, explorer_governance_snapshots, explorer_asset_position_events, explorer_pool_snapshots, explorer_validator_sets, explorer_staking_cycles, explorer_staking_overview, explorer_asset_positions, explorer_asset_accounts, explorer_assets, explorer_messages, explorer_transactions, explorer_blocks, explorer_contracts RESTART IDENTITY");
      await client.query("DELETE FROM projection_meta WHERE key IN ('master_seqno', 'master_root', 'dns_mc_seqno', 'dns_address')");
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

  async dnsCursor(): Promise<{ mcSeqno: number; address: string }> {
    const result = await this.pool.query<{ key: string; value: string }>(
      "SELECT key,value FROM projection_meta WHERE key IN ('dns_mc_seqno','dns_address')",
    );
    const values = new Map(result.rows.map((row) => [row.key, row.value]));
    return { mcSeqno: Number(values.get("dns_mc_seqno") ?? 0), address: values.get("dns_address") ?? "" };
  }

  async applyDnsHistory(items: DnsDomainHistoryItem[]): Promise<void> {
    if (items.length === 0) return;
    const ordered = [...items].sort((left, right) =>
      left.observed_mc_seqno - right.observed_mc_seqno || left.address.localeCompare(right.address));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of ordered) {
        if (!RAW_ADDRESS.test(item.address) || !HEX_HASH.test(item.root_hash) || !HEX_HASH.test(item.file_hash) ||
            !Number.isSafeInteger(item.account_seqno) || !Number.isSafeInteger(item.observed_mc_seqno) ||
            !Number.isSafeInteger(item.observed_at) || item.observed_mc_seqno <= 0 || item.observed_at <= 0 ||
            item.data.name !== `${item.data.label}.tos` || !/^[a-z0-9][a-z0-9-]{2,124}[a-z0-9]$/.test(item.data.label) ||
            item.data.collection !== "0:cec242160fa821bc402586947649f25d4a0c1b02808d1dce93c893e98061bb8a" ||
            item.data.owner !== null && !RAW_ADDRESS.test(item.data.owner) ||
            item.data.max_bid_address !== null && !RAW_ADDRESS.test(item.data.max_bid_address) ||
            !/^\d+$/.test(item.data.index) || !/^\d+$/.test(item.data.max_bid_amount) ||
            !Number.isSafeInteger(item.data.auction_end_time) || item.data.auction_end_time < 0 ||
            !Number.isSafeInteger(item.data.last_fill_up_time) || item.data.last_fill_up_time <= 0 ||
            !HEX_HASH.test(item.data.content_hash)) {
          throw new Error("DNS history item violates the TIP-1 projection shape");
        }
        const canonical = await client.query<{ root_hash: string; file_hash: string }>(
          "SELECT root_hash,file_hash FROM explorer_blocks WHERE workchain=-1 AND seqno=$1",
          [item.observed_mc_seqno],
        );
        const block = canonical.rows[0];
        if (!block || block.root_hash !== item.root_hash || block.file_hash !== item.file_hash) {
          throw new Error(`DNS history checkpoint ${item.observed_mc_seqno} is not canonical`);
        }
        const status = item.data.auction_end_time !== 0
          ? (item.observed_at > item.data.auction_end_time ? "auction-ended-unfinalized" : "auction")
          : (item.data.renewal_deadline !== null && item.observed_at > item.data.renewal_deadline ? "releasable" : "leased");
        const expectedDeadline = item.data.auction_end_time === 0
          ? item.data.last_fill_up_time + DNS_LEASE_SECONDS : null;
        if (item.data.renewal_deadline !== expectedDeadline || item.data.safe_to_resolve !== (status === "leased")) {
          throw new Error("DNS history lifecycle fields disagree with inherited contract rules");
        }
        await client.query(
          `INSERT INTO explorer_dns_domain_history
            (address,account_seqno,observed_mc_seqno,observed_at,root_hash,file_hash,data)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT(address,observed_mc_seqno) DO UPDATE SET
             account_seqno=EXCLUDED.account_seqno,observed_at=EXCLUDED.observed_at,
             root_hash=EXCLUDED.root_hash,file_hash=EXCLUDED.file_hash,data=EXCLUDED.data`,
          [item.address, item.account_seqno, item.observed_mc_seqno, item.observed_at,
            item.root_hash, item.file_hash, item.data],
        );
        await client.query(
          `INSERT INTO explorer_dns_domains
            (address,name,status,owner,renewal_deadline,safe_to_resolve,observed_mc_seqno,
             observed_at,root_hash,file_hash,data)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT(address) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,
             owner=EXCLUDED.owner,renewal_deadline=EXCLUDED.renewal_deadline,
             safe_to_resolve=EXCLUDED.safe_to_resolve,observed_mc_seqno=EXCLUDED.observed_mc_seqno,
             observed_at=EXCLUDED.observed_at,root_hash=EXCLUDED.root_hash,
             file_hash=EXCLUDED.file_hash,data=EXCLUDED.data
           WHERE explorer_dns_domains.observed_mc_seqno<=EXCLUDED.observed_mc_seqno`,
          [item.address, item.data.name, status, item.data.owner, item.data.renewal_deadline,
            item.data.safe_to_resolve, item.observed_mc_seqno, item.observed_at,
            item.root_hash, item.file_hash, item.data],
        );
      }
      const last = ordered.at(-1)!;
      await client.query(
        `INSERT INTO projection_meta(key,value) VALUES('dns_mc_seqno',$1),('dns_address',$2)
         ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,
        [String(last.observed_mc_seqno), last.address],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    const transactionRows = transactions.map((transaction) => ({
      ...transaction,
      details: transaction.details ?? {},
    }));
    const messages = transactions.flatMap((transaction) => {
      const details = (transaction.details ?? {}) as {
        in_msg?: Record<string, unknown> | null;
        out_msgs?: Array<Record<string, unknown>>;
      };
      const rows: Array<Record<string, unknown>> = [];
      const add = (message: Record<string, unknown>, direction: "in" | "out") => {
        if (!message.hash) return;
        rows.push({
          hash: message.hash, transaction_hash: transaction.hash, direction,
          kind: message.kind ?? "unknown", source: message.source ?? null,
          destination: message.destination ?? null, value: message.value ?? null,
          bounced: message.bounced ?? null, created_lt: message.created_lt ?? null,
          created_at: message.created_at ?? null,
        });
      };
      if (details.in_msg) add(details.in_msg, "in");
      for (const message of details.out_msgs ?? []) add(message, "out");
      return rows;
    });
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
            (hash,account,lt,workchain,shard,seqno,fee,in_msg_hash,details,indexed_at)
           SELECT x.hash,x.account,x.lt,x.workchain,x.shard,x.seqno,x.fee,x.in_msg_hash,x.details,$2
           FROM jsonb_to_recordset($1::jsonb) AS x(
             hash text, account text, lt numeric(20,0), workchain integer,
             shard numeric(20,0), seqno integer, fee numeric(40,0), in_msg_hash text, details jsonb
           )
           ON CONFLICT (hash) DO UPDATE SET account=EXCLUDED.account,lt=EXCLUDED.lt,
             workchain=EXCLUDED.workchain,shard=EXCLUDED.shard,seqno=EXCLUDED.seqno,
             fee=EXCLUDED.fee,in_msg_hash=EXCLUDED.in_msg_hash,details=EXCLUDED.details,indexed_at=EXCLUDED.indexed_at`,
          [JSON.stringify(transactionRows), indexedAt],
        );
        await client.query(
          `INSERT INTO explorer_asset_accounts(address,last_seen_at)
           SELECT account,max($2::bigint) FROM jsonb_to_recordset($1::jsonb) AS x(account text) GROUP BY account
           ON CONFLICT(address) DO UPDATE SET last_seen_at=GREATEST(explorer_asset_accounts.last_seen_at,EXCLUDED.last_seen_at)`,
          [JSON.stringify(transactionRows), indexedAt],
        );
      }
      if (messages.length > 0) {
        await client.query(
          `INSERT INTO explorer_messages
            (hash,transaction_hash,direction,kind,source,destination,value,bounced,created_lt,created_at)
           SELECT x.hash,x.transaction_hash,x.direction,x.kind,x.source,x.destination,
                  x.value,x.bounced,x.created_lt,x.created_at
           FROM jsonb_to_recordset($1::jsonb) AS x(
             hash text,transaction_hash text,direction text,kind text,source text,destination text,
             value numeric(40,0),bounced boolean,created_lt numeric(20,0),created_at integer
           ) ON CONFLICT(hash,transaction_hash,direction) DO UPDATE SET
             kind=EXCLUDED.kind,source=EXCLUDED.source,destination=EXCLUDED.destination,
             value=EXCLUDED.value,bounced=EXCLUDED.bounced,created_lt=EXCLUDED.created_lt,
             created_at=EXCLUDED.created_at`,
          [JSON.stringify(messages)],
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
        if (record.kind === "contract.pool.nominator") {
          await client.query(
            `INSERT INTO explorer_pool_snapshots(address,observed_at,status,last_seqno,data)
             VALUES($1,$2,$3,$4,$5)
             ON CONFLICT(address,observed_at) DO UPDATE SET
               status=EXCLUDED.status,last_seqno=EXCLUDED.last_seqno,data=EXCLUDED.data`,
            [record.address, record.updated_at, record.status, record.last_seqno, record.data],
          );
        }
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

  async replaceStaking(snapshot: ExplorerStakingResponse): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO explorer_staking_overview(singleton,data,updated_at) VALUES(true,$1,$2)
         ON CONFLICT(singleton) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at`,
        [snapshot.result, snapshot.result.updated_at],
      );
      for (const cycle of snapshot.cycles) {
        await client.query(
          `INSERT INTO explorer_staking_cycles
            (election_id,unfreeze_at,duration_seconds,total_stake,rewards,reward_rate,
             annualized_apr,compounded_apy,validator_count,vset_hash,observed_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT(election_id) DO UPDATE SET
             unfreeze_at=EXCLUDED.unfreeze_at,duration_seconds=EXCLUDED.duration_seconds,
             total_stake=EXCLUDED.total_stake,rewards=EXCLUDED.rewards,
             reward_rate=EXCLUDED.reward_rate,annualized_apr=EXCLUDED.annualized_apr,
             compounded_apy=EXCLUDED.compounded_apy,validator_count=EXCLUDED.validator_count,
             vset_hash=EXCLUDED.vset_hash,observed_at=EXCLUDED.observed_at`,
          [cycle.election_id, cycle.unfreeze_at, cycle.duration_seconds, cycle.total_stake,
            cycle.rewards, cycle.reward_rate, cycle.annualized_apr, cycle.compounded_apy,
            cycle.validator_count, cycle.vset_hash, snapshot.result.updated_at],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordValidatorSet(snapshot: ValidatorSetSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO explorer_validator_sets(observed_mc_seqno,observed_at,data)
       VALUES($1,$2,$3)
       ON CONFLICT(observed_mc_seqno) DO UPDATE SET observed_at=EXCLUDED.observed_at,data=EXCLUDED.data`,
      [snapshot.observed_mc_seqno, snapshot.observed_at, snapshot],
    );
  }

  async recordGovernanceSnapshot(snapshot: GovernanceSnapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO explorer_governance_snapshots(observed_mc_seqno,observed_at,data)
       VALUES($1,$2,$3)
       ON CONFLICT(observed_mc_seqno) DO UPDATE SET observed_at=EXCLUDED.observed_at,data=EXCLUDED.data`,
      [snapshot.observed_mc_seqno, snapshot.observed_at, snapshot],
    );
  }

  async pendingAssetAccounts(limit: number): Promise<string[]> {
    const result = await this.pool.query<{ address: string }>(
      "SELECT address FROM explorer_asset_accounts WHERE scanned_at<last_seen_at ORDER BY last_seen_at,address LIMIT $1",
      [limit],
    );
    return result.rows.map((row) => row.address);
  }

  async replaceAssetSnapshot(
    owner: string,
    jettons: JettonPosition[],
    nfts: NftPosition[],
    assets: ExplorerAsset[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<{
        owner_address: string;
        asset_address: string;
        position_address: string | null;
        kind: "jetton" | "nft_item";
        last_lt: string;
      }>(
        `SELECT owner_address,asset_address,position_address,kind,last_lt::text
         FROM explorer_asset_positions WHERE owner_address=$1`,
        [owner],
      );
      const observedAt = Math.floor(Date.now() / 1000);
      const next = [
        ...jettons.map((position) => ({
          owner_address: owner,
          asset_address: position.jetton_master,
          position_address: position.jetton_wallet,
          kind: "jetton" as const,
          last_lt: position.last_lt,
        })),
        ...nfts.map((position) => ({
          owner_address: owner,
          asset_address: position.nft_item,
          position_address: position.nft_item,
          kind: "nft_item" as const,
          last_lt: position.last_lt,
        })),
      ];
      const identity = (position: { asset_address: string; kind: string }) => `${position.kind}:${position.asset_address}`;
      const previousByIdentity = new Map(previous.rows.map((position) => [identity(position), position]));
      const nextByIdentity = new Map(next.map((position) => [identity(position), position]));
      const positionEvents = [
        ...next.filter((position) => {
          const old = previousByIdentity.get(identity(position));
          return !old || old.last_lt !== position.last_lt || old.position_address !== position.position_address;
        }).map((position) => ({ ...position, event_type: "observed" as const })),
        ...previous.rows.filter((position) => !nextByIdentity.has(identity(position)))
          .map((position) => ({ ...position, event_type: "removed" as const })),
      ];
      for (const asset of assets) {
        await client.query(
          `INSERT INTO explorer_assets(address,kind,updated_at,data) VALUES($1,$2,$3,$4)
           ON CONFLICT(address) DO UPDATE SET kind=EXCLUDED.kind,updated_at=EXCLUDED.updated_at,data=EXCLUDED.data`,
          [asset.address, asset.kind, asset.updated_at, asset.data],
        );
      }
      await client.query("DELETE FROM explorer_asset_positions WHERE owner_address=$1", [owner]);
      for (const position of jettons) {
        await client.query(
          `INSERT INTO explorer_asset_positions(owner_address,asset_address,position_address,kind,last_lt)
           VALUES($1,$2,$3,'jetton',$4)`,
          [owner, position.jetton_master, position.jetton_wallet, position.last_lt],
        );
      }
      for (const position of nfts) {
        await client.query(
          `INSERT INTO explorer_asset_positions(owner_address,asset_address,position_address,kind,last_lt)
           VALUES($1,$2,$2,'nft_item',$3)`,
          [owner, position.nft_item, position.last_lt],
        );
      }
      for (const event of positionEvents) {
        await client.query(
          `INSERT INTO explorer_asset_position_events
            (owner_address,asset_address,position_address,kind,event_type,last_lt,observed_at)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT(owner_address,asset_address,kind,last_lt,event_type) DO NOTHING`,
          [event.owner_address, event.asset_address, event.position_address, event.kind,
            event.event_type, event.last_lt, observedAt],
        );
      }
      await client.query(
        "UPDATE explorer_asset_accounts SET scanned_at=last_seen_at WHERE address=$1",
        [owner],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
