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
  HomeData,
  JettonPosition,
  ListResponse,
  MasterchainInfo,
  NftPosition,
  RawTransaction,
  Service,
  Task,
  TransactionDetail,
  TransactionSummary,
  WalletEvent,
} from "./types";
import {
  getPreviewAccount,
  getPreviewBlock,
  getPreviewTransaction,
  previewAgents,
  previewBlocks,
  previewHome,
  previewServices,
  previewTasks,
  previewTransactions,
} from "@/data/preview";
import { runtime } from "@/stores/runtime";

const rpc = new JsonRpcClient({
  endpoint: import.meta.env.VITE_TOS_RPC_URL || "/jsonRPC",
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
  const [header, transactionResponse] = await Promise.all([
    rpc.call<BlockHeader>("getBlockHeader", { workchain, shard, seqno }),
    rpc.call<BlockTransactions>("getBlockTransactions", { workchain, shard, seqno, count: 100 }),
  ]);
  const summary = mapBlock(id, header, transactionResponse);
  const transactions = transactionResponse.transactions.map((transaction) => ({
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
      getLiveTransactions(blocks, 8),
      optional(listLiveTasks(3), []),
      optional(listLiveServices(3), []),
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

export async function getBlocks(limit = 20): Promise<BlockSummary[]> {
  return withPreview(() => getLiveRecentBlocks(limit), () => previewBlocks.slice(0, limit));
}

export async function getBlock(workchain: number, shard: string, seqno: number): Promise<BlockDetail> {
  return withPreview(() => getLiveBlock(workchain, shard, seqno), () => getPreviewBlock(seqno));
}

export async function getTransactions(limit = 40): Promise<TransactionSummary[]> {
  return withPreview(async () => {
    const blocks = await getLiveRecentBlocks(8);
    return getLiveTransactions(blocks, limit);
  }, () => previewTransactions.slice(0, limit));
}

export async function getTransaction(account: string, lt: string, hash: string): Promise<TransactionDetail> {
  return withPreview<TransactionDetail>(async () => {
    const response = await rpc.call<RawTransaction[] | { transactions: RawTransaction[] }>("getTransactions", {
      address: account,
      limit: 1,
      lt,
      hash,
    });
    const transaction = Array.isArray(response) ? response[0] : response.transactions[0];
    if (!transaction) throw new Error("Transaction not found");
    return { account, lt, hash, fee: transaction.fee, time: 0, raw: transaction };
  }, () => getPreviewTransaction(account, lt, hash));
}

export async function getAccount(address: string): Promise<AccountDetail> {
  return withPreview(async () => {
    const info = await rpc.call<AccountInfo>("getAddressInformation", { address });
    const [capability, agents, events, jettons, nfts] = await Promise.all([
      optional(rpc.call<AccountCapability>("getAccountCapability", { address }), null),
      optional(rpc.call<{ agents: AccountAgent[] }>("getAccountAgents", { address }).then((value) => value.agents), []),
      optional(rpc.call<{ events: WalletEvent[] }>("getAccountEvents", { address, limit: 50 }).then((value) => value.events), []),
      optional(rpc.call<{ jettons: JettonPosition[] }>("getAccountJettons", { address, limit: 100 }).then((value) => value.jettons), []),
      optional(rpc.call<{ nfts: NftPosition[] }>("getAccountNfts", { address, limit: 100 }).then((value) => value.nfts), []),
    ]);
    return { address, info, capability, agents, events, jettons, nfts };
  }, () => getPreviewAccount(address));
}

export async function getTasks(limit = 100): Promise<Task[]> {
  return withPreview(() => listLiveTasks(limit), () => previewTasks.slice(0, limit));
}

export async function getServices(limit = 100): Promise<Service[]> {
  return withPreview(() => listLiveServices(limit), () => previewServices.slice(0, limit));
}

export async function getAgents(limit = 100): Promise<Agent[]> {
  return withPreview(async () => {
    const tasks = await listLiveTasks(limit);
    const addresses = [...new Set(tasks.flatMap((task) => task.assigned_agent ? [task.assigned_agent] : []))];
    const agents = await Promise.all(addresses.map(async (address) => {
      const response = await serviceApi.get<{ ok: boolean; result: Agent }>(`/agents/${encodeURIComponent(address)}`);
      return { ...response.result, activeTasks: tasks.filter((task) => task.assigned_agent === address && task.status !== "settled").length };
    }));
    return agents;
  }, () => previewAgents.slice(0, limit));
}
