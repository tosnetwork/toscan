import { HttpClient } from "./http";
import { JsonRpcClient, TransportError } from "./jsonRpc";
import type {
  AccountAgent,
  AccountCapability,
  AccountDetail,
  AccountInfo,
  Agent,
  BlockDetail,
  BlockHeader,
  BlockId,
  BlockSummary,
  BlockTransactions,
  Dispute,
  ExplorerBlock,
  ExplorerContract,
  ExplorerIndexStatus,
  ExplorerSearchHit,
  ExplorerTransaction,
  HomeData,
  JettonPosition,
  ListResponse,
  MasterchainInfo,
  NftPosition,
  Page,
  RawTransaction,
  Service,
  Task,
  TransactionDetail,
  TransactionSummary,
  TokenData,
  WalletEvent,
} from "./types";
import {
  getPreviewAccount,
  getPreviewBlock,
  getPreviewTransaction,
  getPreviewToken,
  previewAgents,
  previewBlocks,
  previewDisputes,
  previewHome,
  previewServices,
  previewTasks,
  previewTransactions,
} from "@/data/preview";
import { runtime } from "@/stores/runtime";

const rpc = new JsonRpcClient({
  endpoint: import.meta.env.VITE_TOS_RPC_URL || (import.meta.env.PROD ? "/tos-rpc" : "/jsonRPC"),
  transport: import.meta.env.VITE_TOS_RPC_TRANSPORT || (import.meta.env.PROD ? "rest" : "json-rpc"),
  timeout: Number(import.meta.env.VITE_TOS_RPC_TIMEOUT_MS) || (import.meta.env.DEV ? 2_500 : 12_000),
});
const serviceApi = new HttpClient(import.meta.env.VITE_TOS_SERVICE_API_URL || "/tos-service-api");
const previewEnabled = import.meta.env.VITE_ENABLE_PREVIEW === "true" || import.meta.env.DEV;

async function withPreview<T>(live: () => Promise<T>, preview: () => T): Promise<T> {
  if (runtime.mode.value === "preview") return preview();
  try {
    const result = await live();
    runtime.useLive();
    return result;
  } catch (error) {
    if (!(error instanceof TransportError) || !previewEnabled) throw error;
    runtime.usePreview(error.message);
    return preview();
  }
}

async function optional<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

async function prefer<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if (!(error instanceof TransportError)) throw error;
    return fallback();
  }
}

function page<T>(response: ListResponse<T>, complete = true): Page<T> {
  return {
    items: response.result,
    total: response.total,
    offset: response.offset,
    limit: response.limit,
    complete,
  };
}

function indexedTransactionSummary(transaction: ExplorerTransaction): TransactionSummary {
  return {
    hash: transaction.hash,
    lt: transaction.lt,
    account: transaction.account,
    fee: transaction.fee ?? undefined,
    time: transaction.gen_utime || transaction.indexed_at,
    block: {
      workchain: transaction.workchain,
      shard: transaction.shard,
      seqno: transaction.seqno,
    },
  };
}

function indexedBlockSummary(block: ExplorerBlock): BlockSummary {
  return {
    workchain: block.workchain,
    shard: block.shard,
    seqno: block.seqno,
    root_hash: block.root_hash,
    file_hash: block.file_hash,
    time: block.gen_utime || block.indexed_at,
    txCount: block.tx_count,
    incomplete: false,
    keyBlock: false,
  };
}

async function listIndexedBlocks(offset: number, limit: number): Promise<Page<BlockSummary>> {
  const response = await serviceApi.get<ListResponse<ExplorerBlock>>("/explorer/blocks", {
    offset,
    limit,
  });
  const result = page(response);
  return { ...result, items: result.items.map(indexedBlockSummary) };
}

async function listIndexedTransactions(
  offset: number,
  limit: number,
  account?: string,
): Promise<Page<TransactionSummary>> {
  const response = await serviceApi.get<ListResponse<ExplorerTransaction>>("/explorer/transactions", {
    account,
    offset,
    limit,
  });
  const result = page(response);
  return { ...result, items: result.items.map(indexedTransactionSummary) };
}

async function listIndexedBlockTransactions(
  workchain: number,
  shard: string,
  seqno: number,
  offset: number,
  limit: number,
): Promise<Page<TransactionSummary>> {
  const response = await serviceApi.get<ListResponse<ExplorerTransaction>>("/explorer/transactions", {
    workchain,
    shard,
    seqno,
    offset,
    limit,
  });
  const result = page(response);
  return { ...result, items: result.items.map(indexedTransactionSummary) };
}

async function listIndexedContracts<T extends object>(
  kind: string,
  offset: number,
  limit: number,
  params: Record<string, string | number | undefined> = {},
): Promise<Page<ExplorerContract<T>>> {
  const response = await serviceApi.get<ListResponse<ExplorerContract<T>>>(
    `/explorer/contracts/${encodeURIComponent(kind)}`,
    { ...params, offset, limit },
  );
  return page(response);
}

export async function getIndexedContract<T extends object>(
  kind: string,
  address: string,
): Promise<ExplorerContract<T>> {
  return withPreview(async () => {
    const response = await serviceApi.get<{ ok: boolean; result: ExplorerContract<T> }>(
      `/explorer/contracts/${encodeURIComponent(kind)}/${encodeURIComponent(address)}`,
    );
    return response.result;
  }, () => {
    const fallback = kind === "agent_account"
      ? previewAgents.find((agent) => agent.address === address)
      : kind === "task_escrow"
        ? previewTasks.find((task) => task.address === address)
        : kind === "service_actor"
          ? previewServices.find((service) => service.address === address)
          : kind === "dispute"
            ? previewDisputes.find((dispute) => dispute.address === address)
          : undefined;
    if (!fallback) throw new Error("Contract not found");
    return {
      address,
      kind,
      creator: "owner" in fallback ? String(fallback.owner) : "creator" in fallback ? String(fallback.creator) : null,
      counterparty: null,
      status: "status" in fallback ? String(fallback.status) : "active",
      deadline: "deadline" in fallback ? Number(fallback.deadline) : null,
      last_seqno: previewBlocks[0]?.seqno ?? 0,
      updated_at: Math.floor(Date.now() / 1000),
      data: fallback as T,
    };
  });
}

function mapBlock(id: BlockId, header: BlockHeader, transactions: BlockTransactions): BlockSummary {
  return {
    ...id,
    time: header.gen_utime,
    txCount: transactions.transactions.length,
    incomplete: transactions.incomplete,
    keyBlock: header.is_key_block,
    startLt: header.start_lt,
    endLt: header.end_lt,
  };
}

async function getLiveBlock(workchain: number, shard: string, seqno: number): Promise<BlockDetail> {
  const id = await rpc.call<BlockId>("lookupBlock", { workchain, shard, seqno });
  const [header, transactionResponse, indexedTransactions] = await Promise.all([
    rpc.call<BlockHeader>("getBlockHeader", { workchain, shard, seqno }),
    rpc.call<BlockTransactions>("getBlockTransactions", { workchain, shard, seqno, count: 100 }),
    optional(listIndexedBlockTransactions(workchain, shard, seqno, 0, 100), null),
  ]);
  const summary = mapBlock(id, header, transactionResponse);
  if (indexedTransactions) {
    summary.txCount = indexedTransactions.total;
    summary.incomplete = false;
  }
  const transactions = indexedTransactions?.items ?? transactionResponse.transactions.map((transaction) => ({
      hash: transaction.hash ?? "",
      lt: transaction.lt ?? "",
      account: transaction.account ?? "",
      time: header.gen_utime,
      block: { workchain, shard, seqno },
    }));
  return { summary, header, transactions };
}

async function getLiveRecentBlocks(limit: number): Promise<BlockSummary[]> {
  const info = await rpc.call<MasterchainInfo>("getMasterchainInfo");
  const seqnos = Array.from({ length: limit }, (_, index) => info.last.seqno - index).filter((seqno) => seqno >= 0);
  const blocks = await Promise.all(seqnos.map(async (seqno) => {
    const detail = await getLiveBlock(info.last.workchain, info.last.shard, seqno);
    return detail.summary;
  }));
  return blocks;
}

async function getLiveTransactions(blocks: BlockSummary[], limit: number): Promise<TransactionSummary[]> {
  const results = await Promise.all(blocks.slice(0, 4).map(async (block) => {
    const response = await rpc.call<BlockTransactions>("getBlockTransactions", {
      workchain: block.workchain,
      shard: block.shard,
      seqno: block.seqno,
      count: Math.max(10, limit),
    });
    return response.transactions.map((transaction) => ({
      hash: transaction.hash ?? "",
      lt: transaction.lt ?? "",
      account: transaction.account ?? "",
      time: block.time,
      block: { workchain: block.workchain, shard: block.shard, seqno: block.seqno },
    }));
  }));
  return results.flat().slice(0, limit);
}

async function listLiveTasks(limit = 100): Promise<Task[]> {
  const response = await serviceApi.get<ListResponse<Task | { task?: Task | null }>>("/tasks", { limit });
  const tasks: Task[] = [];
  for (const entry of response.result) {
    if (isTaskWrapper(entry)) {
      if (entry.task) tasks.push(entry.task);
    } else {
      tasks.push(entry);
    }
  }
  return tasks;
}

function isTaskWrapper(entry: Task | { task?: Task | null }): entry is { task?: Task | null } {
  return "task" in entry;
}

async function listLiveServices(limit = 100): Promise<Service[]> {
  return (await serviceApi.get<ListResponse<Service>>("/services", { limit })).result;
}

export async function getHome(): Promise<HomeData> {
  return withPreview(async () => {
    const blocks = await getLiveRecentBlocks(6);
    const [transactions, tasks, services, consensus, signatures] = await Promise.all([
      prefer(
        () => listIndexedTransactions(0, 8).then((value) => value.items),
        () => getLiveTransactions(blocks, 8),
      ),
      optional(getTasksPage(0, 3).then((value) => value.items), []),
      optional(getServicesPage(0, 3).then((value) => value.items), []),
      optional(rpc.call<{ consensus_block: number }>("getConsensusBlock"), { consensus_block: 0 }),
      optional(rpc.call<{ signatures: unknown[] }>("getMasterchainBlockSignatures", { seqno: blocks[0]?.seqno }), { signatures: [] }),
    ]);
    return {
      blocks,
      transactions,
      tasks,
      services,
      consensusBlock: consensus.consensus_block || null,
      signers: signatures.signatures.length || null,
    };
  }, () => previewHome);
}

export async function getBlocksPage(offset = 0, limit = 20): Promise<Page<BlockSummary>> {
  return withPreview(
    () => prefer(
      () => listIndexedBlocks(offset, limit),
      async () => {
        const items = (await getLiveRecentBlocks(offset + limit)).slice(offset, offset + limit);
        return { items, total: items.length, offset, limit, complete: false };
      },
    ),
    () => ({
      items: previewBlocks.slice(offset, offset + limit),
      total: previewBlocks.length,
      offset,
      limit,
      complete: true,
    }),
  );
}

export async function getBlocks(limit = 20): Promise<BlockSummary[]> {
  return (await getBlocksPage(0, limit)).items;
}

export async function getBlock(workchain: number, shard: string, seqno: number): Promise<BlockDetail> {
  return withPreview(() => getLiveBlock(workchain, shard, seqno), () => getPreviewBlock(seqno));
}

export async function getBlockTransactionsPage(
  workchain: number,
  shard: string,
  seqno: number,
  offset = 0,
  limit = 50,
): Promise<Page<TransactionSummary>> {
  return withPreview(
    () => prefer(
      () => listIndexedBlockTransactions(workchain, shard, seqno, offset, limit),
      async () => {
        const response = await rpc.call<BlockTransactions>("getBlockTransactions", {
          workchain,
          shard,
          seqno,
          count: Math.min(100, offset + limit),
        });
        const header = await rpc.call<BlockHeader>("getBlockHeader", { workchain, shard, seqno });
        const all = response.transactions.map((transaction) => ({
          hash: transaction.hash ?? "",
          lt: transaction.lt ?? "",
          account: transaction.account ?? "",
          time: header.gen_utime,
          block: { workchain, shard, seqno },
        }));
        return {
          items: all.slice(offset, offset + limit),
          total: all.length,
          offset,
          limit,
          complete: !response.incomplete,
        };
      },
    ),
    () => {
      const transactions = getPreviewBlock(seqno).transactions;
      return {
        items: transactions.slice(offset, offset + limit),
        total: transactions.length,
        offset,
        limit,
        complete: true,
      };
    },
  );
}

export async function getTransactionsPage(offset = 0, limit = 40): Promise<Page<TransactionSummary>> {
  return withPreview(
    () => prefer<Page<TransactionSummary>>(
      () => listIndexedTransactions(offset, limit),
      async () => {
        const blocks = await getLiveRecentBlocks(8);
        const items = await getLiveTransactions(blocks, limit);
        return { items, total: items.length, offset: 0, limit, complete: false };
      },
    ),
    () => ({
      items: previewTransactions.slice(offset, offset + limit),
      total: previewTransactions.length,
      offset,
      limit,
      complete: true,
    }),
  );
}

export async function getTransactions(limit = 40): Promise<TransactionSummary[]> {
  return (await getTransactionsPage(0, limit)).items;
}

export async function getAccountTransactionsPage(
  account: string,
  offset = 0,
  limit = 50,
): Promise<Page<TransactionSummary>> {
  return withPreview(
    () => listIndexedTransactions(offset, limit, account),
    () => {
      const items = previewTransactions.filter((transaction) => transaction.account === account);
      return {
        items: items.slice(offset, offset + limit),
        total: items.length,
        offset,
        limit,
        complete: true,
      };
    },
  );
}

export async function getTransaction(account: string, lt: string, hash: string): Promise<TransactionDetail> {
  return withPreview<TransactionDetail>(async () => {
    const indexed = await optional(
      serviceApi.get<{ ok: boolean; result: ExplorerTransaction }>("/explorer/transaction", { hash })
        .then((value) => value.result),
      null,
    );
    const [response, header] = await Promise.all([
      rpc.call<RawTransaction[] | { transactions: RawTransaction[] }>("getTransactions", {
        address: account,
        limit: 1,
        lt,
        hash,
      }),
      indexed
        ? optional(rpc.call<BlockHeader>("getBlockHeader", {
          workchain: indexed.workchain,
          shard: indexed.shard,
          seqno: indexed.seqno,
        }), null)
        : Promise.resolve(null),
    ]);
    const transaction = Array.isArray(response) ? response[0] : response.transactions[0];
    if (!transaction) throw new Error("Transaction not found");
    return {
      account,
      lt,
      hash,
      fee: transaction.fee,
      time: transaction.utime ?? header?.gen_utime ?? indexed?.indexed_at ?? 0,
      block: indexed ? { workchain: indexed.workchain, shard: indexed.shard, seqno: indexed.seqno } : undefined,
      raw: transaction,
    };
  }, () => getPreviewTransaction(account, lt, hash));
}

export async function getAccount(address: string): Promise<AccountDetail> {
  return withPreview(async () => {
    const info = await rpc.call<AccountInfo>("getAddressInformation", { address });
    const [capability, agents, events, jettons, nfts, indexedTransactions] = await Promise.all([
      optional(rpc.call<AccountCapability>("getAccountCapability", { address }), null),
      optional(rpc.call<{ agents: AccountAgent[] }>("getAccountAgents", { address }).then((value) => value.agents), []),
      optional(rpc.call<{ events: WalletEvent[] }>("getAccountEvents", { address, limit: 50 }).then((value) => value.events), []),
      optional(rpc.call<{ jettons: JettonPosition[] }>("getAccountJettons", { address, limit: 100 }).then((value) => value.jettons), []),
      optional(rpc.call<{ nfts: NftPosition[] }>("getAccountNfts", { address, limit: 100 }).then((value) => value.nfts), []),
      optional(listIndexedTransactions(0, 50, address), {
        items: [], total: 0, offset: 0, limit: 50, complete: false,
      }),
    ]);
    return {
      address,
      info,
      capability,
      agents,
      events,
      jettons,
      nfts,
      indexedTransactions: indexedTransactions.items,
      indexedTransactionTotal: indexedTransactions.total,
    };
  }, () => getPreviewAccount(address));
}

export async function getToken(address: string, previewHint?: string): Promise<TokenData> {
  return withPreview(
    () => rpc.call<TokenData>("getTokenData", { address }),
    () => getPreviewToken(address, previewHint),
  );
}

export async function getTasksPage(offset = 0, limit = 100, status?: string): Promise<Page<Task>> {
  return withPreview(
    () => prefer(
      async () => {
        const indexed = await listIndexedContracts<Task>("task_escrow", offset, limit, { status });
        return { ...indexed, items: indexed.items.map((contract) => ({ ...contract.data, address: contract.address })) };
      },
      async () => {
        const filtered = (await listLiveTasks(offset + limit)).filter((task) => !status || task.status === status);
        const items = filtered.slice(offset, offset + limit);
        return { items, total: items.length, offset, limit, complete: false };
      },
    ),
    () => {
      const filtered = previewTasks.filter((task) => !status || task.status === status);
      return { items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit, complete: true };
    },
  );
}

export async function getTasks(limit = 100): Promise<Task[]> {
  return (await getTasksPage(0, limit)).items;
}

export async function getServicesPage(offset = 0, limit = 100): Promise<Page<Service>> {
  return withPreview(
    () => prefer(
      async () => {
        const indexed = await listIndexedContracts<Service>("service_actor", offset, limit);
        return { ...indexed, items: indexed.items.map((contract) => ({ ...contract.data, address: contract.address })) };
      },
      async () => {
        const items = (await listLiveServices(offset + limit)).slice(offset, offset + limit);
        return { items, total: items.length, offset, limit, complete: false };
      },
    ),
    () => ({ items: previewServices.slice(offset, offset + limit), total: previewServices.length, offset, limit, complete: true }),
  );
}

export async function getServices(limit = 100): Promise<Service[]> {
  return (await getServicesPage(0, limit)).items;
}

export async function getDisputesPage(offset = 0, limit = 100): Promise<Page<Dispute>> {
  return withPreview(
    async () => {
      const indexed = await listIndexedContracts<Dispute>("dispute", offset, limit);
      return { ...indexed, items: indexed.items.map((contract) => ({ ...contract.data, address: contract.address })) };
    },
    () => ({
      items: previewDisputes.slice(offset, offset + limit),
      total: previewDisputes.length,
      offset,
      limit,
      complete: true,
    }),
  );
}

export async function getAgentsPage(offset = 0, limit = 100): Promise<Page<Agent>> {
  return withPreview(
    () => prefer<Page<Agent>>(
      async () => {
        const [indexed, tasks] = await Promise.all([
          listIndexedContracts<Agent>("agent_account", offset, limit),
          getTasks(200),
        ]);
        return {
          ...indexed,
          items: indexed.items.map((contract) => ({
            ...contract.data,
            address: contract.address,
            activeTasks: tasks.filter((task) =>
              task.assigned_agent === contract.address && !["settled", "cancelled", "expired", "rejected"].includes(task.status)
            ).length,
          })),
        };
      },
      async () => {
        const tasks = await listLiveTasks(limit);
        const addresses = [...new Set(tasks.flatMap((task) => task.assigned_agent ? [task.assigned_agent] : []))];
        const agents = await Promise.all(addresses.map(async (address) => {
          const response = await serviceApi.get<{ ok: boolean; result: Agent }>(`/agents/${encodeURIComponent(address)}`);
          return { ...response.result, activeTasks: tasks.filter((task) => task.assigned_agent === address && task.status !== "settled").length };
        }));
        const items = agents.slice(offset, offset + limit);
        return { items, total: agents.length, offset, limit, complete: false };
      },
    ),
    () => ({ items: previewAgents.slice(offset, offset + limit), total: previewAgents.length, offset, limit, complete: true }),
  );
}

export async function getAgents(limit = 100): Promise<Agent[]> {
  return (await getAgentsPage(0, limit)).items;
}

export async function getExplorerStatus(): Promise<ExplorerIndexStatus | null> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: ExplorerIndexStatus }>("/explorer/status")
      .then((value) => value.result),
    () => ({
      blocks: previewBlocks.length,
      transactions: previewTransactions.length,
      contracts: previewAgents.length + previewTasks.length + previewServices.length,
      latest_indexed_at: previewBlocks[0]?.time ?? null,
      masterchain_head: previewBlocks[0]?.seqno ?? null,
      masterchain_indexed: previewBlocks[0]?.seqno ?? null,
      masterchain_lag: 0,
      checkpoints: [{ shard: `-1:${previewBlocks[0]?.shard ?? "-9223372036854775808"}`, seqno: previewBlocks[0]?.seqno ?? 0 }],
    }),
  );
}

export async function searchExplorer(query: string): Promise<ExplorerSearchHit | null> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: ExplorerSearchHit | null }>("/explorer/search", { q: query })
      .then((value) => value.result),
    () => {
      const transaction = previewTransactions.find((item) => item.hash === query);
      if (transaction) {
        return {
          kind: "transaction",
          result: {
            hash: transaction.hash,
            account: transaction.account,
            lt: transaction.lt,
            workchain: transaction.block?.workchain ?? -1,
            shard: transaction.block?.shard ?? "-9223372036854775808",
            seqno: transaction.block?.seqno ?? 0,
            gen_utime: transaction.time,
            fee: transaction.fee ?? null,
            in_msg_hash: null,
            indexed_at: transaction.time,
          },
        };
      }
      const block = previewBlocks.find((item) => item.root_hash === query || item.file_hash === query);
      if (block) {
        return {
          kind: "block",
          result: {
            ...block,
            gen_utime: block.time,
            tx_count: block.txCount,
            observed_mc_seqno: block.workchain === -1 ? block.seqno : previewBlocks[0]?.seqno ?? block.seqno,
            indexed_at: block.time,
          },
        };
      }
      return null;
    },
  );
}
