import { setTimeout as delay } from "node:timers/promises";
import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { TosRpc } from "./rpc.js";
import type { ContractListResponse, DnsDomainHistoryResponse, ExplorerAsset, ExplorerContract, ExplorerStakingResponse, GovernanceSnapshot, TokenData, ValidatorSetConfig } from "./types.js";

export const CONTRACT_KINDS = [
  "agent_account",
  "task_escrow",
  "dispute",
  "service_actor",
  "capability_registry",
  "aipow_commitment",
  "aipow_distributor",
  "contract.pool.nominator",
] as const;

interface ProjectorOptions {
  sourceUrl: string;
  batchSize: number;
  pollMs: number;
  contractSyncMs: number;
  assetScanBatch?: number;
}

export class Projector {
  private lastContractSync = 0;

  constructor(
    private readonly db: ProjectionDb,
    private readonly rpc: TosRpc,
    private readonly metrics: Metrics,
    private readonly options: ProjectorOptions,
  ) {}

  async cycle(): Promise<void> {
    const info = await this.rpc.masterchainInfo();
    this.metrics.head = info.last.seqno;
    const release = await this.db.acquireProjectionLease();
    if (!release) {
      const checkpoint = await this.db.checkpoint();
      this.metrics.indexed = checkpoint.seqno;
      this.metrics.projectionCycles += 1;
      this.metrics.lastProjectionSuccess = Math.floor(Date.now() / 1000);
      this.metrics.sourceHealthy = true;
      return;
    }
    try {
      await this.projectUnderLease(info.last.shard, info.last.seqno);
    } finally {
      await release();
    }
  }

  private async projectUnderLease(masterShard: string, headSeqno: number): Promise<void> {
    let checkpoint = await this.db.checkpoint();
    if (checkpoint.seqno > headSeqno) {
      await this.db.resetChain();
      checkpoint = { seqno: 0, rootHash: null };
    } else if (checkpoint.seqno > 0 && checkpoint.rootHash) {
      const canonical = await this.rpc.blockId(-1, masterShard, checkpoint.seqno);
      if (canonical.root_hash !== checkpoint.rootHash) {
        await this.db.resetChain();
        checkpoint = { seqno: 0, rootHash: null };
      }
    }

    const first = checkpoint.seqno + 1;
    const last = Math.min(headSeqno, first + this.options.batchSize - 1);
    if (first <= last) {
      const bundles = await Promise.all(
        Array.from({ length: last - first + 1 }, (_, index) => first + index)
          .map((seqno) => this.rpc.masterchainBundle(masterShard, seqno)),
      );
      await this.db.applyBundles(bundles);
      this.metrics.indexed = last;
    } else {
      this.metrics.indexed = checkpoint.seqno;
    }

    await this.syncDnsHistory(this.metrics.indexed);

    if (Date.now() - this.lastContractSync >= this.options.contractSyncMs) {
      await this.syncContracts();
      await this.syncStaking();
      await this.syncValidators(headSeqno);
      await this.syncGovernance(headSeqno);
      this.lastContractSync = Date.now();
    }
    await this.syncAssets();
    this.metrics.projectionCycles += 1;
    this.metrics.lastProjectionSuccess = Math.floor(Date.now() / 1000);
    this.metrics.sourceHealthy = true;
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const started = performance.now();
      try {
        await this.cycle();
      } catch (error) {
        this.metrics.projectionErrors += 1;
        this.metrics.lastProjectionError = Math.floor(Date.now() / 1000);
        this.metrics.sourceHealthy = false;
        console.error("projection cycle failed", error);
      } finally {
        this.metrics.observeProjection((performance.now() - started) / 1_000);
      }
      await delay(this.options.pollMs, undefined, { signal }).catch(() => undefined);
    }
  }

  private async syncContracts(): Promise<void> {
    for (const kind of CONTRACT_KINDS) {
      const records: ExplorerContract[] = [];
      for (let offset = 0; ; offset += 200) {
        const url = new URL(`/explorer/contracts/${kind}`, this.options.sourceUrl);
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("limit", "200");
        const response = await fetch(url, { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`contract sync ${kind} failed (${response.status})`);
        const page = await response.json() as ContractListResponse;
        records.push(...page.result);
        if (records.length >= page.total || page.result.length === 0) break;
      }
      await this.db.replaceContracts(kind, records);
    }
  }

  private async syncDnsHistory(indexedMcSeqno: number): Promise<void> {
    let cursor = await this.db.dnsCursor();
    for (;;) {
      const url = new URL("/explorer/dns/history", this.options.sourceUrl);
      url.searchParams.set("after_mc_seqno", String(cursor.mcSeqno));
      if (cursor.address) url.searchParams.set("after_address", cursor.address);
      url.searchParams.set("limit", "200");
      const response = await fetch(url, { headers: { accept: "application/json" } });
      // During a rolling deployment the explorer node may briefly predate the
      // DNS history endpoint. An empty projection can safely retry next cycle;
      // once DNS data exists, fail closed rather than silently serving it stale.
      if ((response.status === 404 || response.status === 501) && cursor.mcSeqno === 0 && cursor.address === "") return;
      if (!response.ok) throw new Error(`DNS history sync failed (${response.status})`);
      const page = await response.json() as DnsDomainHistoryResponse;
      if (!page.ok || !Array.isArray(page.result)) throw new Error("DNS history source returned an invalid page");
      const eligible = page.result.filter((item) => item.observed_mc_seqno <= indexedMcSeqno);
      if (eligible.length > 0) {
        for (const item of eligible) {
          if (item.observed_mc_seqno < cursor.mcSeqno ||
              item.observed_mc_seqno === cursor.mcSeqno && item.address <= cursor.address) {
            throw new Error("DNS history source did not advance its cursor");
          }
          cursor = { mcSeqno: item.observed_mc_seqno, address: item.address };
        }
        await this.db.applyDnsHistory(eligible);
      }
      if (page.result.length < 200 || eligible.length !== page.result.length) return;
    }
  }

  private async syncStaking(): Promise<void> {
    const response = await fetch(new URL("/explorer/staking", this.options.sourceUrl), {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`staking sync failed (${response.status})`);
    await this.db.replaceStaking(await response.json() as ExplorerStakingResponse);
  }

  private async syncValidators(headSeqno: number): Promise<void> {
    const [config, nextConfig, proof] = await Promise.all([
      this.rpc.call<{ validator_set?: ValidatorSetConfig }>("getConfigParam", { param: 34, seqno: headSeqno }),
      this.rpc.call<{ validator_set?: ValidatorSetConfig }>("getConfigParam", { param: 36, seqno: headSeqno })
        .catch(() => null),
      this.rpc.call<{ signatures?: Array<{ node_id_short: string; signature: string }> }>(
        "getMasterchainBlockSignatures",
        { seqno: headSeqno },
      ),
    ]);
    await this.db.recordValidatorSet({
      observed_mc_seqno: headSeqno,
      observed_at: Math.floor(Date.now() / 1000),
      validator_set: config.validator_set ?? null,
      next_validator_set: nextConfig?.validator_set ?? null,
      signatures: proof.signatures ?? [],
    });
  }

  private async syncGovernance(headSeqno: number): Promise<void> {
    const ids = [0, 8, 34, 36, 40];
    const parameters = await Promise.all(ids.map(async (id) => {
      const request = this.rpc.call<{ config?: { bytes?: string } }>(
        "getConfigParam", { param: id, seqno: headSeqno },
      );
      const result = id === 36 ? await request.catch(() => null) : await request;
      return { id, bytes: result?.config?.bytes ?? null };
    }));
    const snapshot: GovernanceSnapshot = {
      observed_mc_seqno: headSeqno,
      observed_at: Math.floor(Date.now() / 1000),
      parameters,
    };
    await this.db.recordGovernanceSnapshot(snapshot);
  }

  private assetKind(data: TokenData): ExplorerAsset["kind"] | null {
    if (data["@type"] === "ext.tokens.jettonMasterData") return "jetton";
    if (data["@type"] === "ext.tokens.nftItemData") return "nft_item";
    if (data["@type"] === "ext.tokens.nftCollectionData") return "nft_collection";
    return null;
  }

  private async optionalToken(address: string): Promise<ExplorerAsset | null> {
    try {
      const data = await this.rpc.tokenData(address);
      const kind = this.assetKind(data);
      return kind ? { address, kind, updated_at: Math.floor(Date.now() / 1000), data } : null;
    } catch {
      return null;
    }
  }

  private async syncAssets(): Promise<void> {
    const accounts = await this.db.pendingAssetAccounts(this.options.assetScanBatch ?? 16);
    for (const owner of accounts) {
      const [jettons, nfts, direct] = await Promise.all([
        this.rpc.accountJettons(owner),
        this.rpc.accountNfts(owner),
        this.optionalToken(owner),
      ]);
      const candidates = new Map<string, ExplorerAsset>();
      if (direct) candidates.set(direct.address, direct);
      const referenced = new Map<string, ExplorerAsset["kind"]>();
      for (const position of jettons) referenced.set(position.jetton_master, "jetton");
      for (const position of nfts) {
        referenced.set(position.nft_item, "nft_item");
        if (position.collection) referenced.set(position.collection, "nft_collection");
      }
      const entries = [...referenced];
      for (let index = 0; index < entries.length; index += 8) {
        await Promise.all(entries.slice(index, index + 8).map(async ([address, kind]) => {
          const resolved = await this.optionalToken(address);
          candidates.set(address, resolved ?? {
            address, kind, updated_at: Math.floor(Date.now() / 1000), data: {},
          });
        }));
      }
      await this.db.replaceAssetSnapshot(owner, jettons, nfts, [...candidates.values()]);
    }
  }
}
