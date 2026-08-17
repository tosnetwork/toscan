import { setTimeout as delay } from "node:timers/promises";
import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { TosRpc } from "./rpc.js";
import type { ContractListResponse, ExplorerAsset, ExplorerContract, ExplorerStakingResponse, TokenData } from "./types.js";

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

    if (Date.now() - this.lastContractSync >= this.options.contractSyncMs) {
      await this.syncContracts();
      await this.syncStaking();
      this.lastContractSync = Date.now();
    }
    await this.syncAssets();
    this.metrics.projectionCycles += 1;
    this.metrics.lastProjectionSuccess = Math.floor(Date.now() / 1000);
    this.metrics.sourceHealthy = true;
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.cycle();
      } catch (error) {
        this.metrics.projectionErrors += 1;
        this.metrics.lastProjectionError = Math.floor(Date.now() / 1000);
        this.metrics.sourceHealthy = false;
        console.error("projection cycle failed", error);
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

  private async syncStaking(): Promise<void> {
    const response = await fetch(new URL("/explorer/staking", this.options.sourceUrl), {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`staking sync failed (${response.status})`);
    await this.db.replaceStaking(await response.json() as ExplorerStakingResponse);
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
