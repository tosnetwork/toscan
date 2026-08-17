import { setTimeout as delay } from "node:timers/promises";
import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { TosRpc } from "./rpc.js";
import type { ContractListResponse, ExplorerContract } from "./types.js";

export const CONTRACT_KINDS = [
  "agent_account",
  "task_escrow",
  "dispute",
  "service_actor",
  "capability_registry",
  "aipow_commitment",
  "aipow_distributor",
] as const;

interface ProjectorOptions {
  sourceUrl: string;
  batchSize: number;
  pollMs: number;
  contractSyncMs: number;
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
      this.lastContractSync = Date.now();
    }
    this.metrics.projectionCycles += 1;
    this.metrics.lastProjectionSuccess = Math.floor(Date.now() / 1000);
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.cycle();
      } catch (error) {
        this.metrics.projectionErrors += 1;
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
}
