import { HttpClient } from "./http";
import { JsonRpcClient, TransportError } from "./jsonRpc";
import type {
  AccountAgent,
  AccountCapability,
  AccountDetail,
  AccountInfo,
  AddressLabel,
  Agent,
  BlockDetail,
  BlockHeader,
  BlockId,
  BlockSummary,
  BlockSignatures,
  BlockTransactions,
  ContractVerification,
  Dispute,
  ExplorerBlock,
  ExplorerAsset,
  ExplorerAssetDetail,
  ExplorerContract,
  ExplorerIndexStatus,
  ExplorerMessage,
  ExplorerSearchHit,
  ExplorerTransaction,
  EconomyStats,
  HomeData,
  GovernanceConfigProof,
  JettonPosition,
  ListResponse,
  MasterchainInfo,
  NetworkAnalytics,
  NftPosition,
  NominatorPoolData,
  NominatorPoolDetail,
  Page,
  RawTransaction,
  Service,
  StakingData,
  StakingCycle,
  Task,
  TransactionDetail,
  TransactionSummary,
  TokenData,
  ValidatorOverview,
  ValidatorDetail,
  ValidatorSetSnapshot,
  WalletEvent,
} from "./types";
import {
  getPreviewAccount,
  getPreviewBlock,
  getPreviewTransaction,
  getPreviewToken,
  previewAgents,
  previewAddress,
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

async function withPreview<T>(live: () => Promise<T>, preview: () => T | Promise<T>): Promise<T> {
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
    nextCursor: response.next_cursor,
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

async function listIndexedBlocks(offset: number, limit: number, cursor?: string): Promise<Page<BlockSummary>> {
  const response = await serviceApi.get<ListResponse<ExplorerBlock>>("/explorer/blocks", {
    offset,
    limit,
    cursor,
  });
  const result = page(response);
  return { ...result, items: result.items.map(indexedBlockSummary) };
}

async function listIndexedTransactions(
  offset: number,
  limit: number,
  account?: string,
  cursor?: string,
): Promise<Page<TransactionSummary>> {
  const response = await serviceApi.get<ListResponse<ExplorerTransaction>>("/explorer/transactions", {
    account,
    offset,
    limit,
    cursor,
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
  cursor?: string,
): Promise<Page<TransactionSummary>> {
  const response = await serviceApi.get<ListResponse<ExplorerTransaction>>("/explorer/transactions", {
    workchain,
    shard,
    seqno,
    offset,
    limit,
    cursor,
  });
  const result = page(response);
  return { ...result, items: result.items.map(indexedTransactionSummary) };
}

async function listIndexedContracts<T extends object>(
  kind: string,
  offset: number,
  limit: number,
  params: Record<string, string | number | undefined> = {},
  cursor?: string,
): Promise<Page<ExplorerContract<T>>> {
  const response = await serviceApi.get<ListResponse<ExplorerContract<T>>>(
    `/explorer/contracts/${encodeURIComponent(kind)}`,
    { ...params, offset, limit, cursor },
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

export async function getBlocksPage(offset = 0, limit = 20, cursor?: string): Promise<Page<BlockSummary>> {
  return withPreview(
    () => prefer(
      () => listIndexedBlocks(offset, limit, cursor),
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
  cursor?: string,
): Promise<Page<TransactionSummary>> {
  return withPreview(
    () => prefer(
      () => listIndexedBlockTransactions(workchain, shard, seqno, offset, limit, cursor),
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

export async function getTransactionsPage(offset = 0, limit = 40, cursor?: string): Promise<Page<TransactionSummary>> {
  return withPreview(
    () => prefer<Page<TransactionSummary>>(
      () => listIndexedTransactions(offset, limit, undefined, cursor),
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
  cursor?: string,
): Promise<Page<TransactionSummary>> {
  return withPreview(
    () => listIndexedTransactions(offset, limit, account, cursor),
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
      raw: { ...(indexed?.details ?? {}), ...transaction },
    };
  }, () => getPreviewTransaction(account, lt, hash));
}

export async function getMessage(hash: string): Promise<ExplorerMessage> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: ExplorerMessage }>("/explorer/message", { hash })
      .then((value) => value.result),
    () => {
      const occurrences = previewTransactions.flatMap((transaction) => {
        const raw = getPreviewTransaction(transaction.account, transaction.lt, transaction.hash).raw;
        return [
          ...(raw.in_msg?.hash === hash ? [{
            ...raw.in_msg, transaction_hash: transaction.hash, direction: "in" as const,
            account: transaction.account, transaction_lt: transaction.lt,
            workchain: transaction.block?.workchain ?? -1, shard: transaction.block?.shard ?? "-9223372036854775808",
            seqno: transaction.block?.seqno ?? 0,
          }] : []),
          ...(raw.out_msgs ?? []).filter((message) => message.hash === hash).map((message) => ({
            ...message, transaction_hash: transaction.hash, direction: "out" as const,
            account: transaction.account, transaction_lt: transaction.lt,
            workchain: transaction.block?.workchain ?? -1, shard: transaction.block?.shard ?? "-9223372036854775808",
            seqno: transaction.block?.seqno ?? 0,
          })),
        ];
      });
      if (!occurrences.length) throw new Error("Message not found");
      return { hash, occurrences };
    },
  );
}

export async function getEconomyStats(): Promise<EconomyStats> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: EconomyStats }>("/explorer/economy")
      .then((value) => value.result),
    () => ({
      agents: previewAgents.length,
      tasks: previewTasks.length,
      open_tasks: previewTasks.filter((task) => task.status === "open").length,
      settled_tasks: previewTasks.filter((task) => task.status === "settled").length,
      services: previewServices.length,
      disputes: previewDisputes.length,
      total_task_budget: previewTasks.reduce((sum, task) => sum + BigInt(task.budget), 0n).toString(),
      service_revenue: previewServices.reduce((sum, service) => sum + BigInt(service.withdrawable_revenue), 0n).toString(),
      task_statuses: [...previewTasks.reduce((statuses, task) => {
        statuses.set(task.status, (statuses.get(task.status) ?? 0) + 1);
        return statuses;
      }, new Map<string, number>())].map(([status, count]) => ({ status, count })),
    }),
  );
}

export async function getStakingData(): Promise<StakingData> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: StakingData }>("/explorer/staking")
      .then((value) => value.result),
    () => ({
      current_election_available: false,
      reward_history_available: true,
      active_election_id: 0,
      election_closes_at: 0,
      current_election_stake: "0",
      current_participants: 0,
      minimum_stake: "0",
      election_failed: false,
      election_finished: false,
      pools: 1,
      active_pools: 1,
      nominators: 3,
      total_pool_stake: "1000000000000",
      effective_stake: {
        max_stake_factor_raw: 65_536,
        max_stake_factor: 1,
        smallest_elected_stake: "10000000000000",
        effective_stake_cap: "10000000000000",
        surplus_earns: false,
      },
      updated_at: Math.floor(Date.now() / 1000),
      cycles: previewRewardCycles(),
      pool_records: [previewPool()],
    }),
  );
}

function previewPool(): ExplorerContract<NominatorPoolData> {
  const now = Math.floor(Date.now() / 1_000);
  return {
    address: `0:${"70".repeat(32)}`,
    kind: "contract.pool.nominator",
    creator: null,
    counterparty: null,
    status: "active",
    deadline: null,
    last_seqno: previewBlocks[0]?.seqno ?? 0,
    updated_at: now,
    data: {
      state: 2,
      nominators_count: 3,
      stake_amount_sent: "0",
      validator_amount: "300000000000",
      nominator_stake: "700000000000",
      total_balance_at_risk: "1000000000000",
      validator_address: `-1:${"71".repeat(32)}`,
      validator_reward_share_bps: 1_000,
      max_nominators_count: 40,
      min_validator_stake: "100000000000",
      min_nominator_stake: "10000000000",
      stake_at: now - 86_400,
      saved_validator_set_hash: "preview-validator-set",
      validator_set_changes_count: 4,
      validator_set_change_time: now - 43_200,
      stake_held_for: 86_400,
      nominators: [1, 2, 3].map((index) => ({
        address: `0:${String(71 + index).repeat(64).slice(0, 64)}`,
        amount: String(index * 200_000_000_000),
        pending_deposit: "0",
        withdraw_requested: index === 3,
      })),
    },
  };
}

function previewRewardCycles(): StakingCycle[] {
  const now = Math.floor(Date.now() / 1_000);
  return Array.from({ length: 12 }, (_, index) => ({
    election_id: 1200 - index,
    unfreeze_at: now - index * 86_400,
    duration_seconds: 86_400,
    total_stake: String(9_000_000_000_000 + index * 50_000_000_000),
    rewards: String(90_000_000_000 + index * 500_000_000),
    reward_rate: 0.01 + index * 0.00008,
    annualized_apr: 3.65 + index * 0.0292,
    compounded_apy: 36.78 + index * 0.5,
    validator_count: 3,
    vset_hash: `preview-vset-${1200 - index}`,
    observed_at: now - index * 86_400,
  }));
}

export async function getNominatorPoolDetail(address: string): Promise<NominatorPoolDetail> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: NominatorPoolDetail }>(
      `/explorer/staking/pools/${encodeURIComponent(address)}`,
    ).then((value) => value.result),
    () => {
      const pool = previewPool();
      if (address !== pool.address) throw new Error("Nominator Pool not found");
      return {
        pool,
        history: Array.from({ length: 16 }, (_, index) => ({
          observed_at: pool.updated_at - index * 21_600,
          status: pool.status,
          last_seqno: pool.last_seqno - index,
          data: {
            ...pool.data,
            total_balance_at_risk: String(BigInt(pool.data.total_balance_at_risk) - BigInt(index * 8_000_000_000)),
            nominators_count: Math.max(1, pool.data.nominators_count - Math.floor(index / 6)),
          },
        })),
        network_reward_cycles: previewRewardCycles(),
        effective_stake: {
          max_stake_factor_raw: 65_536,
          max_stake_factor: 1,
          smallest_elected_stake: "10000000000000",
          effective_stake_cap: "10000000000000",
          surplus_earns: false,
        },
      };
    },
  );
}

export async function getProjectedValidators(): Promise<ValidatorSetSnapshot> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: ValidatorSetSnapshot }>("/explorer/validators")
      .then((value) => value.result),
    async () => {
      const live = await getValidatorOverview();
      return {
        observed_mc_seqno: live.id.seqno,
        observed_at: Math.floor(Date.now() / 1_000),
        validator_set: live.validator_set,
        signatures: live.signatures,
      };
    },
  );
}

export async function getValidatorDetail(publicKey: string): Promise<ValidatorDetail> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: ValidatorDetail }>(
      `/explorer/validators/${encodeURIComponent(publicKey)}`,
    ).then((value) => value.result),
    async () => {
      const current = await getProjectedValidators();
      const member = current.validator_set?.validators.find((candidate) => candidate.public_key === publicKey);
      if (!member) throw new Error("Validator not found");
      const history = Array.from({ length: 18 }, (_, index) => ({
        observed_mc_seqno: current.observed_mc_seqno - index * 100,
        observed_at: current.observed_at - index * 21_600,
        total_weight: current.validator_set?.total_weight ?? "0",
        ...member,
        weight: String(BigInt(member.weight) + BigInt((index % 4) * 3)),
      }));
      return {
        public_key: publicKey,
        current: history[0]!,
        selected_sets: history.length,
        first_observed_at: history.at(-1)?.observed_at ?? current.observed_at,
        last_observed_at: current.observed_at,
        history,
        network_reward_cycles: previewRewardCycles(),
        reward_attribution_available: false,
      };
    },
  );
}

export async function getNetworkAnalytics(window: NetworkAnalytics["window"] = "7d"): Promise<NetworkAnalytics> {
  return withPreview(
    () => serviceApi.get<{ ok: boolean; result: NetworkAnalytics }>("/explorer/analytics", { window })
      .then((value) => value.result),
    () => {
      const bucketSeconds = window === "24h" || window === "7d" ? 3_600 : 86_400;
      const points = window === "24h" ? 24 : window === "7d" ? 7 * 24 : window === "30d" ? 30 : 90;
      const now = Math.floor(Date.now() / bucketSeconds) * bucketSeconds;
      return {
        window,
        bucket_seconds: bucketSeconds,
        activity: Array.from({ length: points }, (_, index) => ({
          bucket: now - (points - index - 1) * bucketSeconds,
          blocks: 60 + (index % 7),
          transactions: 280 + ((index * 37) % 190),
          fees: String(4_000_000_000 + ((index * 110_000_000) % 3_000_000_000)),
        })),
        contracts: [{ kind: "agent_account", count: 18 }, { kind: "task_escrow", count: 42 }],
        assets: [{ kind: "jetton", count: 4 }, { kind: "nft_item", count: 15 }],
      };
    },
  );
}

export async function getAddressLabel(address: string): Promise<AddressLabel | null> {
  return withPreview(
    () => optional(
      serviceApi.get<{ ok: boolean; result: AddressLabel }>(`/explorer/labels/${encodeURIComponent(address)}`)
        .then((value) => value.result),
      null,
    ),
    () => {
      const pool = previewPool();
      return address === pool.address ? {
        address,
        label: "Preview Nominator Pool",
        category: pool.kind,
        source: "preview fixture",
        source_url: null,
        verified: false,
        updated_at: pool.updated_at,
      } : null;
    },
  );
}

export async function getLatestBlockSignatures(): Promise<BlockSignatures> {
  return withPreview(async () => {
    const info = await rpc.call<MasterchainInfo>("getMasterchainInfo");
    return rpc.call<BlockSignatures>("getMasterchainBlockSignatures", { seqno: info.last.seqno });
  }, () => ({ id: previewBlocks[0]!, signatures: [] }));
}

export async function getValidatorOverview(): Promise<ValidatorOverview> {
  return withPreview(async () => {
    const info = await rpc.call<MasterchainInfo>("getMasterchainInfo");
    const [proof, config] = await Promise.all([
      rpc.call<BlockSignatures>("getMasterchainBlockSignatures", { seqno: info.last.seqno }),
      rpc.call<{ validator_set?: ValidatorOverview["validator_set"] }>("getConfigParam", {
        param: 34, seqno: info.last.seqno,
      }),
    ]);
    return { ...proof, validator_set: config.validator_set ?? null };
  }, () => ({
    id: previewBlocks[0]!, signatures: [],
    validator_set: {
      utime_since: (previewBlocks[0]?.time ?? 0) - 3_600,
      utime_until: (previewBlocks[0]?.time ?? 0) + 82_800,
      total: 3, main: 3, total_weight: "300",
      validators: [1, 2, 3].map((index) => ({
        public_key: `preview-validator-${index}`, adnl_address: `preview-adnl-${index}`,
        weight: "100", cumulative_weight: String(index * 100),
      })),
    },
  }));
}

export async function getGovernanceConfig(): Promise<GovernanceConfigProof> {
  const definitions = [
    { id: 0, name: "Configuration authority", description: "The account authorized to change network configuration." },
    { id: 8, name: "Global protocol version", description: "The chain-committed protocol capability and version cell." },
    { id: 34, name: "Current validator set", description: "The validator-set cell currently governing consensus." },
    { id: 36, name: "Next validator set", description: "The elected next validator set, when one is committed." },
    { id: 40, name: "Misbehavior and slashing", description: "The chain configuration for validator punishment, when enabled." },
  ];
  return withPreview(async () => {
    const info = await rpc.call<MasterchainInfo>("getMasterchainInfo");
    const parameters = await Promise.all(definitions.map(async (definition) => {
      const result = await optional(rpc.call<{ config: { bytes: string } }>("getConfigParam", {
        param: definition.id, seqno: info.last.seqno,
      }), null);
      return { ...definition, bytes: result?.config.bytes ?? null };
    }));
    return { seqno: info.last.seqno, parameters };
  }, () => ({
    seqno: previewBlocks[0]?.seqno ?? 0,
    parameters: definitions.map((definition) => ({ ...definition, bytes: definition.id === 36 ? null : "te6cckEBAQEA" })),
  }));
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

export async function getContractVerification(address: string): Promise<ContractVerification | null> {
  if (runtime.mode.value === "preview") return null;
  return optional(serviceApi.get<{ ok: boolean; result: ContractVerification }>(
    `/explorer/verifications/${encodeURIComponent(address)}`,
  ).then((response) => response.result), null);
}

export async function getToken(address: string, previewHint?: string): Promise<TokenData> {
  return withPreview(
    () => rpc.call<TokenData>("getTokenData", { address }),
    () => getPreviewToken(address, previewHint),
  );
}

export async function getAssetsPage(
  offset = 0,
  limit = 50,
  kind?: string,
  cursor?: string,
): Promise<Page<ExplorerAsset>> {
  return withPreview(async () => page(await serviceApi.get<ListResponse<ExplorerAsset>>("/explorer/assets", {
    offset, limit, kind, cursor,
  })), () => {
    const positions: ExplorerAsset[] = getPreviewAccount(previewAddress).jettons.map((position) => ({
      address: position.jetton_master,
      kind: "jetton" as const,
      updated_at: previewBlocks[0]?.time ?? Math.floor(Date.now() / 1000),
      holder_count: 1,
      data: { ...getPreviewToken(position.jetton_master) },
    }));
    positions.push(...getPreviewAccount(previewAddress).nfts.map((position) => ({
      address: position.nft_item,
      kind: "nft_item" as const,
      updated_at: previewBlocks[0]?.time ?? Math.floor(Date.now() / 1000),
      holder_count: 1,
      data: { ...getPreviewToken(position.nft_item, "nft") },
    })));
    const filtered = positions.filter((asset) => !kind || asset.kind === kind);
    return { items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit, complete: true };
  });
}

export async function getIndexedAsset(address: string): Promise<ExplorerAssetDetail | null> {
  return withPreview(
    () => optional(serviceApi.get<{ ok: boolean; result: ExplorerAssetDetail }>(
      `/explorer/assets/${encodeURIComponent(address)}`,
    ).then((response) => response.result), null),
    () => {
      const account = getPreviewAccount(previewAddress);
      const jetton = account.jettons.find((position) => position.jetton_master === address);
      const nft = account.nfts.find((position) => position.nft_item === address);
      if (!jetton && !nft) return null;
      return {
        address, kind: jetton ? "jetton" : "nft_item",
        updated_at: previewBlocks[0]?.time ?? Math.floor(Date.now() / 1000), holder_count: 1,
        data: { ...getPreviewToken(address, nft ? "nft" : undefined) },
        holders: [{ owner_address: previewAddress, position_address: jetton?.jetton_wallet ?? address,
          kind: jetton ? "jetton" : "nft_item", last_lt: jetton?.last_lt ?? nft!.last_lt }],
        offset: 0, limit: 50,
      };
    },
  );
}

export async function getTasksPage(offset = 0, limit = 100, status?: string, cursor?: string): Promise<Page<Task>> {
  return withPreview(
    () => prefer(
      async () => {
        const indexed = await listIndexedContracts<Task>("task_escrow", offset, limit, { status }, cursor);
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

export async function getServicesPage(offset = 0, limit = 100, cursor?: string): Promise<Page<Service>> {
  return withPreview(
    () => prefer(
      async () => {
        const indexed = await listIndexedContracts<Service>("service_actor", offset, limit, {}, cursor);
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

export async function getDisputesPage(offset = 0, limit = 100, cursor?: string): Promise<Page<Dispute>> {
  return withPreview(
    async () => {
      const indexed = await listIndexedContracts<Dispute>("dispute", offset, limit, {}, cursor);
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

export async function getAgentsPage(offset = 0, limit = 100, cursor?: string): Promise<Page<Agent>> {
  return withPreview(
    () => prefer<Page<Agent>>(
      async () => {
        const [indexed, tasks] = await Promise.all([
          listIndexedContracts<Agent>("agent_account", offset, limit, {}, cursor),
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
      assets: 2,
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
