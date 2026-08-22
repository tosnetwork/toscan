import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { buildServer } from "./server.js";
import type { DnsDomainHistoryItem, MasterchainBundle, ProjectedBlock } from "./types.js";

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
      details: {
        transaction_type: "ordinary",
        aborted: false,
        compute: { skipped: false, success: true, exit_code: 0, vm_steps: 12 },
        action: { success: true, valid: true, no_funds: false, result_code: 0, total_actions: 1, skipped_actions: 0, messages_created: 1 },
        in_msg: { hash: `msg-${hash}`, kind: "internal", source: `-1:${"22".repeat(32)}`, destination: `-1:${"11".repeat(32)}`, value: "10" },
        out_msgs: [{ hash: `out-${hash}`, kind: "internal", source: `-1:${"11".repeat(32)}`, destination: `-1:${"33".repeat(32)}`, value: "5" }],
      },
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
    await db.migrate();
    expect(await db.schemaVersion()).toBe(8);
    await db.resetChain();
    await db.pool.query("TRUNCATE explorer_address_labels");
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

  it("paginates immutable history with opaque keyset cursors", async () => {
    const metrics = new Metrics();
    const app = buildServer(db, metrics);
    const first = await app.inject("/explorer/transactions?limit=1");
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.next_cursor).toBeTypeOf("string");
    const second = await app.inject(`/explorer/transactions?limit=1&cursor=${encodeURIComponent(firstBody.next_cursor)}`);
    expect(second.statusCode).toBe(200);
    expect(second.json().result[0].hash).not.toBe(firstBody.result[0].hash);
    expect((await app.inject("/explorer/transactions?cursor=broken")).statusCode).toBe(400);
    const malformed = Buffer.from(JSON.stringify({ version: 1, kind: "transactions", indexed: "nope" })).toString("base64url");
    expect((await app.inject(`/explorer/transactions?cursor=${malformed}`)).statusCode).toBe(400);
    await app.close();
  });

  it("indexes message causality and execution details through reorg replacement", async () => {
    const metrics = new Metrics();
    const app = buildServer(db, metrics);
    const message = await app.inject("/explorer/message?hash=out-canonical");
    expect(message.statusCode).toBe(200);
    expect(message.json().result.occurrences[0]).toMatchObject({
      direction: "out", transaction_hash: "tx-canonical", value: "5",
    });
    const transaction = await app.inject("/explorer/transaction?hash=tx-canonical");
    expect(transaction.json().result.details).toMatchObject({
      transaction_type: "ordinary", aborted: false,
      compute: { success: true, exit_code: 0 },
    });
    expect((await app.inject("/explorer/message?hash=out-two")).statusCode).toBe(404);
    await app.close();
  });

  it("aggregates the indexed Agent Economy without estimates", async () => {
    await db.replaceContracts("agent_account", [{
      address: `0:${"44".repeat(32)}`, kind: "agent_account", creator: null, counterparty: null,
      status: "active", deadline: null, last_seqno: 2, updated_at: 1_700_000_002, data: {},
    }]);
    await db.replaceContracts("task_escrow", [
      { address: `0:${"55".repeat(32)}`, kind: "task_escrow", creator: null, counterparty: null,
        status: "open", deadline: null, last_seqno: 2, updated_at: 1_700_000_002, data: { budget: "100" } },
      { address: `0:${"66".repeat(32)}`, kind: "task_escrow", creator: null, counterparty: null,
        status: "settled", deadline: null, last_seqno: 2, updated_at: 1_700_000_002, data: { budget: "250" } },
    ]);
    const app = buildServer(db, new Metrics());
    const response = await app.inject("/explorer/economy");
    expect(response.statusCode).toBe(200);
    expect(response.json().result).toMatchObject({ agents: 1, tasks: 2, open_tasks: 1, settled_tasks: 1, total_task_budget: "350" });
    await app.close();
  });

  it("persists Elector reward cycles and joins code-verified Nominator Pools", async () => {
    const poolAddress = `0:${"77".repeat(32)}`;
    await db.replaceContracts("contract.pool.nominator", [{
      address: poolAddress, kind: "contract.pool.nominator", creator: `0:${"88".repeat(32)}`,
      counterparty: null, status: "staked", deadline: 1_700_004_000,
      last_seqno: 2, updated_at: 1_700_000_002,
      data: {
        validator_address: `0:${"88".repeat(32)}`, nominators_count: 2,
        max_nominators_count: 40, total_balance_at_risk: "6000000000",
        validator_reward_share_bps: 4000, min_nominator_stake: "100000000",
      },
    }]);
    await db.replaceStaking({
      ok: true,
      result: {
        active_election_id: 101, election_closes_at: 1_700_003_000,
        current_election_stake: "9000000000", current_participants: 3,
        minimum_stake: "1000000000", election_failed: false, election_finished: false,
        pools: 1, active_pools: 1, nominators: 2, total_pool_stake: "6000000000",
        effective_stake: {
          max_stake_factor_raw: 65_536, max_stake_factor: 1,
          smallest_elected_stake: "10000000000000",
          effective_stake_cap: "10000000000000", surplus_earns: false,
        },
        updated_at: 1_700_000_100,
      },
      cycles: [{
        election_id: 100, unfreeze_at: 1_700_002_000, duration_seconds: 3600,
        total_stake: "8000000000", rewards: "80000000", reward_rate: 0.01,
        annualized_apr: 87.66, compounded_apy: 9.9e37, validator_count: 3,
        vset_hash: "aa".repeat(32),
      }],
    });
    const app = buildServer(db, new Metrics());
    const response = await app.inject("/explorer/staking");
    expect(response.statusCode).toBe(200);
    expect(response.json().result).toMatchObject({
      active_election_id: 101, current_election_stake: "9000000000",
      effective_stake: { max_stake_factor_raw: 65_536, max_stake_factor: 1, effective_stake_cap: "10000000000000", surplus_earns: false },
      cycles: [{ election_id: 100, rewards: "80000000" }],
      pool_records: [{ address: poolAddress, kind: "contract.pool.nominator", status: "staked" }],
    });
    await app.close();
  });

  it("retains pool and validator evidence history without inventing reward attribution", async () => {
    const poolAddress = `0:${"79".repeat(32)}`;
    const poolData = {
      validator_address: `0:${"80".repeat(32)}`, nominators_count: 1,
      max_nominators_count: 40, total_balance_at_risk: "7000000000",
      validator_reward_share_bps: 1000, min_nominator_stake: "100000000",
      nominators: [{ address: `0:${"81".repeat(32)}`, amount: "6000000000", pending_deposit: "0", withdraw_requested: false }],
    };
    await db.replaceContracts("contract.pool.nominator", [{
      address: poolAddress, kind: "contract.pool.nominator", creator: null, counterparty: null,
      status: "active", deadline: null, last_seqno: 20, updated_at: 1_700_001_000, data: poolData,
    }]);
    await db.replaceContracts("contract.pool.nominator", [{
      address: poolAddress, kind: "contract.pool.nominator", creator: null, counterparty: null,
      status: "active", deadline: null, last_seqno: 21, updated_at: 1_700_001_100,
      data: { ...poolData, total_balance_at_risk: "7100000000" },
    }]);
    const publicKey = Buffer.alloc(32, 0xff).toString("base64");
    const nextPublicKey = "validator-next-only-proof";
    for (const seqno of [500, 501]) {
      await db.recordValidatorSet({
        observed_mc_seqno: seqno,
        observed_at: 1_700_001_000 + seqno,
        validator_set: {
          utime_since: 1_700_000_000, utime_until: 1_700_100_000,
          total: 1, main: 1, total_weight: "100",
          validators: [{ public_key: publicKey, adnl_address: "adnl-proof", weight: "100", cumulative_weight: "100" }],
        },
        next_validator_set: {
          utime_since: 1_700_100_000, utime_until: 1_700_200_000,
          total: 2, main: 2, total_weight: "200",
          validators: [
            { public_key: publicKey, adnl_address: "adnl-proof", weight: "100", cumulative_weight: "100" },
            { public_key: nextPublicKey, adnl_address: "adnl-next", weight: "100", cumulative_weight: "200" },
          ],
        },
        signatures: [{ node_id_short: "proof-signer", signature: "proof-signature" }],
      });
    }
    const app = buildServer(db, new Metrics());
    const pool = await app.inject(`/explorer/staking/pools/${encodeURIComponent(poolAddress)}`);
    expect(pool.statusCode).toBe(200);
    expect(pool.json().result).toMatchObject({
      pool: { address: poolAddress, data: { total_balance_at_risk: "7100000000" } },
      history: [{ observed_at: 1_700_001_100 }, { observed_at: 1_700_001_000 }],
      effective_stake: { max_stake_factor_raw: 65_536, max_stake_factor: 1, effective_stake_cap: "10000000000000", surplus_earns: false },
    });
    const validators = await app.inject("/explorer/validators");
    expect(validators.json().result).toMatchObject({
      observed_mc_seqno: 501,
      validator_set: { total: 1 },
      next_validator_set: { total: 2 },
      staking: {
        current_election_available: false,
        current_election_stake: "9000000000",
        latest_cycle: { election_id: 100, rewards: "80000000" },
        effective_stake: { max_stake_factor: 1, surplus_earns: false },
      },
    });
    const validator = await app.inject(`/explorer/validators/${encodeURIComponent(publicKey)}`);
    expect(validator.json().result).toMatchObject({
      public_key: publicKey, currently_selected: true, selected_for_next_set: true,
      selected_sets: 2, observed_signature_count: 1,
      reward_attribution_available: false, signature_attribution_available: false,
      effective_stake: { max_stake_factor: 1, surplus_earns: false },
      history: [{ observed_mc_seqno: 501, selection_phase: "current" }, { observed_mc_seqno: 500 }],
    });
    const routeSafeValidator = await app.inject(
      `/explorer/validators/${publicKey.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`,
    );
    expect(routeSafeValidator.statusCode).toBe(200);
    expect(routeSafeValidator.json().result.public_key).toBe(publicKey);
    const nextValidator = await app.inject(`/explorer/validators/${encodeURIComponent(nextPublicKey)}`);
    expect(nextValidator.statusCode).toBe(200);
    expect(nextValidator.json().result).toMatchObject({
      public_key: nextPublicKey, currently_selected: false, selected_for_next_set: true,
      selected_sets: 2,
      history: [
        { observed_mc_seqno: 501, selection_phase: "next", adnl_address: "adnl-next" },
        { observed_mc_seqno: 500, selection_phase: "next", adnl_address: "adnl-next" },
      ],
    });
    await app.close();
  });

  it("serves evidence-bearing address labels and resolves exact names", async () => {
    const address = `0:${"82".repeat(32)}`;
    await db.pool.query(`INSERT INTO explorer_address_labels
      (address,label,category,source,source_url,verified,updated_at)
      VALUES($1,'Genesis Treasury','system','genesis manifest','https://tos.network',true,1700002000)`, [address]);
    const app = buildServer(db, new Metrics());
    const label = await app.inject(`/explorer/labels/${encodeURIComponent(address)}`);
    expect(label.json().result).toMatchObject({ label: "Genesis Treasury", verified: true });
    const search = await app.inject("/explorer/search?q=Genesis%20Treasury");
    expect(search.json().result).toMatchObject({ kind: "label", result: { address } });
    await app.close();
  });

  it("discovers assets and atomically refreshes owner positions", async () => {
    const owner = `0:${"99".repeat(32)}`;
    const master = `0:${"aa".repeat(32)}`;
    await db.replaceAssetSnapshot(owner, [{
      jetton_master: master, jetton_wallet: `0:${"bb".repeat(32)}`, last_lt: "700",
    }], [], [{
      address: master, kind: "jetton", updated_at: 1_700_000_700,
      data: { "@type": "ext.tokens.jettonMasterData", jetton_name: "Indexed Credit", total_supply: "1000" },
    }]);
    const app = buildServer(db, new Metrics());
    const listing = await app.inject("/explorer/assets?kind=jetton");
    expect(listing.statusCode).toBe(200);
    expect(listing.json().result[0]).toMatchObject({ address: master, holder_count: 1 });
    const detail = await app.inject(`/explorer/assets/${encodeURIComponent(master)}`);
    expect(detail.json().result.holders[0]).toMatchObject({ owner_address: owner, last_lt: "700" });
    const holders = await app.inject(`/explorer/assets/${encodeURIComponent(master)}/holders`);
    expect(holders.json()).toMatchObject({ total: 1, result: [{ owner_address: owner, last_lt: "700" }] });
    const observed = await app.inject(`/explorer/assets/activity?asset=${encodeURIComponent(master)}`);
    expect(observed.json()).toMatchObject({ total: 1, result: [{ event_type: "observed", asset_address: master, owner_address: owner }] });
    const search = await app.inject(`/explorer/search?q=${encodeURIComponent(master)}`);
    expect(search.json().result).toMatchObject({ kind: "asset", result: { address: master } });

    await db.replaceAssetSnapshot(owner, [], [], []);
    const refreshed = await app.inject(`/explorer/assets/${encodeURIComponent(master)}`);
    expect(refreshed.json().result.holder_count).toBe(0);
    const removed = await app.inject(`/explorer/assets/activity?asset=${encodeURIComponent(master)}`);
    expect(removed.json().result.map((event: { event_type: string }) => event.event_type).sort()).toEqual(["observed", "removed"]);
    await app.close();
  });

  it("serves only build attestations whose deployed code was matched by the importer", async () => {
    const address = `0:${"cc".repeat(32)}`;
    await db.pool.query(
      `INSERT INTO explorer_contract_verifications
       (address,compiler,compiler_version,repository_url,source_commit,source_digest,build_command,
        code_boc,verified_at,observed_mc_seqno,manifest)
       VALUES($1,'func','1.0','https://example.com/source','abc123',$2,'func contract.fc','boc',1700000900,500,'{}')
       ON CONFLICT(address) DO UPDATE SET verified_at=EXCLUDED.verified_at`,
      [address, "dd".repeat(32)],
    );
    const app = buildServer(db, new Metrics());
    const response = await app.inject(`/explorer/verifications/${encodeURIComponent(address)}`);
    expect(response.statusCode).toBe(200);
    expect(response.json().result).toMatchObject({ address, compiler: "func", observed_mc_seqno: 500 });
    const listing = await app.inject("/explorer/verifications");
    expect(listing.json()).toMatchObject({ total: 1, result: [{ address, compiler: "func" }] });
    const suggestion = await app.inject(`/explorer/search/suggest?q=${encodeURIComponent(address.slice(0, 20))}`);
    expect(suggestion.json().result).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "verification", route: `/contracts/verified/${address}` }),
    ]));
    expect((await app.inject(`/explorer/verifications/${encodeURIComponent(`0:${"ee".repeat(32)}`)}`)).statusCode).toBe(404);
    await app.close();
  });

  it("retains proof-backed governance configuration history without vote attribution", async () => {
    await db.recordGovernanceSnapshot({
      observed_mc_seqno: 700,
      observed_at: 1_700_003_000,
      parameters: [{ id: 0, bytes: "authority-a" }, { id: 34, bytes: "validators-a" }],
    });
    await db.recordGovernanceSnapshot({
      observed_mc_seqno: 701,
      observed_at: 1_700_003_100,
      parameters: [{ id: 0, bytes: "authority-a" }, { id: 34, bytes: "validators-b" }],
    });
    const app = buildServer(db, new Metrics());
    const response = await app.inject("/explorer/governance/history?limit=10");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 2,
      result: [
        { observed_mc_seqno: 701, parameters: [{ id: 0, bytes: "authority-a" }, { id: 34, bytes: "validators-b" }] },
        { observed_mc_seqno: 700 },
      ],
    });
    await app.close();
  });

  it("keeps keyset pages stable while newer history arrives at scale", async () => {
    const blocks = Array.from({ length: 120 }, (_, blockIndex) => {
      const seqno = 10 + blockIndex;
      const projected = block(seqno, `load-${seqno}`);
      projected.transactions = Array.from({ length: 25 }, (_, txIndex) => ({
        hash: `tx-load-${seqno}-${txIndex.toString().padStart(2, "0")}`,
        account: `-1:${(txIndex % 2 ? "77" : "88").repeat(32)}`,
        lt: String(seqno * 1_000 + txIndex), workchain: -1,
        shard: "-9223372036854775808", seqno, fee: String(txIndex), in_msg_hash: null,
      }));
      return projected;
    });
    await db.applyBundles(blocks.map((projected) => bundle(projected.seqno, [projected])));
    const app = buildServer(db, new Metrics());
    const first = (await app.inject("/explorer/transactions?limit=200")).json();
    expect(first.result).toHaveLength(200);
    expect(new Set(first.result.map((row: { hash: string }) => row.hash)).size).toBe(200);

    await db.applyBundle(bundle(130, [block(130, "arrived-after-page-one")]));
    const second = (await app.inject(
      `/explorer/transactions?limit=200&cursor=${encodeURIComponent(first.next_cursor)}`,
    )).json();
    const overlap = second.result.filter((row: { hash: string }) =>
      first.result.some((old: { hash: string }) => old.hash === row.hash));
    expect(overlap).toEqual([]);
    expect(second.result.some((row: { hash: string }) => row.hash === "tx-arrived-after-page-one")).toBe(false);
    await app.close();
  }, 20_000);

  it("atomically replaces every block retired by a same-height reorg", async () => {
    const oldShard = block(7, "old-shard", 400);
    oldShard.workchain = 0;
    oldShard.shard = "-9223372036854775808";
    oldShard.transactions[0]!.workchain = 0;
    const oldMaster = block(400, "old-master", 400);
    await db.applyBundle(bundle(400, [oldMaster, oldShard]));

    const newShard = block(8, "new-shard", 400);
    newShard.workchain = 0;
    newShard.shard = "-9223372036854775808";
    newShard.transactions[0]!.workchain = 0;
    const newMaster = block(400, "new-master", 400);
    await db.applyBundle(bundle(400, [newMaster, newShard]));

    const rows = await db.pool.query<{ root_hash: string }>(
      "SELECT root_hash FROM explorer_blocks WHERE observed_mc_seqno=400 ORDER BY root_hash",
    );
    expect(rows.rows.map((row) => row.root_hash)).toEqual(["root-new-master", "root-new-shard"]);
    expect((await db.pool.query("SELECT 1 FROM explorer_transactions WHERE hash IN ('tx-old-master','tx-old-shard')")).rowCount).toBe(0);
  });

  it("binds DNS lifecycle history to the canonical full block identity", async () => {
    const observedAt = Math.floor(Date.now() / 1_000);
    const lastFillUpTime = observedAt - 100;
    const master = block(450, "dns-master");
    master.root_hash = "ab".repeat(32);
    master.file_hash = "cd".repeat(32);
    await db.applyBundle(bundle(450, [master]));
    const item: DnsDomainHistoryItem = {
      address: `0:${"44".repeat(32)}`,
      account_seqno: 9,
      observed_mc_seqno: 450,
      observed_at: observedAt,
      root_hash: master.root_hash,
      file_hash: master.file_hash,
      data: {
        name: "alice.tos", label: "alice", index: "1",
        collection: `0:cec242160fa821bc402586947649f25d4a0c1b02808d1dce93c893e98061bb8a`,
        owner: `0:${"55".repeat(32)}`, max_bid_address: null, max_bid_amount: "0",
        auction_end_time: 0, last_fill_up_time: lastFillUpTime,
        renewal_deadline: lastFillUpTime + 31_622_400, safe_to_resolve: true,
        content_boc_base64: "te6ccgEBAQEAAgAAAA==", content_hash: "66".repeat(32),
      },
    };
    await db.applyDnsHistory([item]);
    expect(await db.dnsCursor()).toEqual({ mcSeqno: 450, address: item.address });
    const app = buildServer(db, new Metrics());
    const response = await app.inject("/explorer/dns/domains/alice.tos");
    expect(response.statusCode).toBe(200);
    expect(response.json().result.current).toMatchObject({
      name: "alice.tos", status: "leased", safe_to_resolve: true,
      observed_mc_seqno: 450, root_hash: master.root_hash,
    });
    await app.close();
    await expect(db.applyDnsHistory([{ ...item, address: `0:${"45".repeat(32)}`, root_hash: "ef".repeat(32) }]))
      .rejects.toThrow("not canonical");
  });

  it("rolls back a malformed projection without advancing its durable checkpoint", async () => {
    const before = await db.checkpoint();
    const malformed = block(401, "malformed");
    malformed.shard = "not-a-number";
    await expect(db.applyBundle(bundle(401, [malformed]))).rejects.toThrow();
    expect(await db.checkpoint()).toEqual(before);
    expect((await db.pool.query("SELECT 1 FROM explorer_blocks WHERE root_hash='root-malformed'")).rowCount).toBe(0);
  });
});
