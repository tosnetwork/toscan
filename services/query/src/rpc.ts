import type {
  BlockHeader,
  BlockId,
  BlockTransactionsPage,
  JettonPosition,
  MasterchainBundle,
  MasterchainInfo,
  ProjectedBlock,
  ProjectedTransaction,
  NftPosition,
  ShardsInfo,
  TokenData,
} from "./types.js";

interface RpcEnvelope<T> {
  ok?: boolean;
  result?: T;
  error?: string | { message?: string };
}

export interface RpcOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class TosRpc {
  constructor(private readonly options: RpcOptions) {}

  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/${method}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.apiKey ? { "x-api-key": this.options.apiKey } : {}),
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      const payload = await response.json() as RpcEnvelope<T>;
      if (!response.ok || payload.error || payload.result === undefined) {
        const detail = typeof payload.error === "string" ? payload.error : payload.error?.message;
        throw new Error(`${method} failed (${response.status}): ${detail ?? "invalid response"}`);
      }
      return payload.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  masterchainInfo(): Promise<MasterchainInfo> {
    return this.call("getMasterchainInfo");
  }

  accountJettons(address: string): Promise<JettonPosition[]> {
    return this.call<{ jettons: JettonPosition[] }>("getAccountJettons", { address, limit: 256 })
      .then((result) => result.jettons);
  }

  accountNfts(address: string): Promise<NftPosition[]> {
    return this.call<{ nfts: NftPosition[] }>("getAccountNfts", { address, limit: 256 })
      .then((result) => result.nfts);
  }

  tokenData(address: string): Promise<TokenData> {
    return this.call<TokenData>("getTokenData", { address });
  }

  blockId(workchain: number, shard: string, seqno: number): Promise<BlockId> {
    return this.call("lookupBlock", { workchain, shard, seqno });
  }

  private async block(workchain: number, shard: string, seqno: number, observedMcSeqno: number): Promise<ProjectedBlock> {
    const transactions: ProjectedTransaction[] = [];
    let afterLt: string | undefined;
    let afterAccount: string | undefined;
    let id: BlockId | undefined;
    let incomplete = true;
    let genUtime = 0;

    while (incomplete) {
      const page = await this.call<BlockTransactionsPage>("getBlockTransactionsExt", {
        workchain,
        shard,
        seqno,
        count: 256,
        ...(afterLt ? { after_lt: afterLt, after_account: afterAccount } : {}),
      });
      id ??= page.id;
      for (const transaction of page.transactions) {
        genUtime ||= transaction.utime ?? 0;
        transactions.push({
          hash: transaction.hash,
          account: `${workchain}:${transaction.account.toLowerCase()}`,
          lt: transaction.lt,
          workchain,
          shard,
          seqno,
          fee: transaction.fee ?? null,
          in_msg_hash: transaction.in_msg_hash ?? null,
          details: {
            transaction_type: transaction.transaction_type ?? "unknown",
            aborted: transaction.aborted ?? null,
            destroyed: transaction.destroyed ?? null,
            compute: transaction.compute ?? null,
            action: transaction.action ?? null,
            in_msg: transaction.in_msg ?? null,
            out_msgs: transaction.out_msgs ?? [],
          },
        });
      }
      incomplete = page.incomplete;
      if (!incomplete) break;
      const last = page.transactions.at(-1);
      if (!last) throw new Error(`incomplete transaction page has no cursor for ${workchain}:${shard}:${seqno}`);
      afterLt = last.lt;
      afterAccount = last.account;
    }

    id ??= await this.blockId(workchain, shard, seqno);
    if (genUtime === 0) {
      const header = await this.call<BlockHeader>("getBlockHeader", { workchain, shard, seqno });
      genUtime = header.gen_utime;
    }
    return {
      workchain,
      shard,
      seqno,
      root_hash: id.root_hash,
      file_hash: id.file_hash,
      gen_utime: genUtime,
      observed_mc_seqno: observedMcSeqno,
      transactions,
    };
  }

  async masterchainBundle(masterShard: string, seqno: number): Promise<MasterchainBundle> {
    const [master, topology] = await Promise.all([
      this.block(-1, masterShard, seqno, seqno),
      this.call<ShardsInfo>("shards", { seqno }),
    ]);
    const shardBlocks = await Promise.all(topology.shards
      .filter((shard) => shard.seqno > 0)
      .map((shard) => this.block(shard.workchain, shard.shard, shard.seqno, seqno)));
    return { seqno, rootHash: master.root_hash, blocks: [master, ...shardBlocks] };
  }
}
