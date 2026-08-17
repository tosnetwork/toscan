import type {
  AccountDetail,
  Agent,
  BlockDetail,
  BlockSummary,
  Dispute,
  HomeData,
  Service,
  Task,
  TransactionDetail,
  TransactionSummary,
  TokenData,
} from "@/api/types";

const now = Math.floor(Date.now() / 1000);
export const previewAddress = "0:8a76df4d2f8a57a8b4b78f2d63156496dde6f17bb1a3df86f367dd2d6ab0a921";
const agentAddress = "0:4bd621937f6f00f68169ad5843924e092b3f89f84a1abf283113e0b9c97e41c2";
const serviceAddress = "0:e59cd1e7780b9f6dac188fa9f15acc678efe5a86f524b6f879ae469aafd85036";
const taskAddress = "0:91bd10a94892f3f1064f9e65a336a47d5ecfed4a0ea26d180b1375f9d4dc772a";
const shard = "-9223372036854775808";

function hash(seed: number): string {
  return Array.from({ length: 64 }, (_, index) => ((seed * 13 + index * 7) % 16).toString(16)).join("");
}

export const previewBlocks: BlockSummary[] = Array.from({ length: 10 }, (_, index) => ({
  workchain: -1,
  shard,
  seqno: 4_281_904 - index,
  root_hash: hash(21 + index),
  file_hash: hash(47 + index),
  time: now - index * 6,
  txCount: [34, 27, 41, 18, 52, 23, 31, 29, 36, 25][index] ?? 0,
  incomplete: false,
  keyBlock: index === 7,
  startLt: String(49_218_440_000_000n - BigInt(index) * 100_000n),
  endLt: String(49_218_440_099_999n - BigInt(index) * 100_000n),
}));

const txAccounts = [previewAddress, agentAddress, serviceAddress, taskAddress];
export const previewTransactions: TransactionSummary[] = Array.from({ length: 12 }, (_, index) => ({
  hash: hash(80 + index),
  lt: String(49_218_440_083_000n - BigInt(index) * 17n),
  account: txAccounts[index % txAccounts.length] ?? previewAddress,
  fee: String(1_420_000 + index * 73_000),
  time: now - index * 3,
  block: { workchain: -1, shard, seqno: 4_281_904 - Math.floor(index / 4) },
}));

export const previewTasks: Task[] = [
  {
    name: "Market signal synthesis",
    address: taskAddress,
    creator: previewAddress,
    assigned_agent: agentAddress,
    verifier: "0:0f44e4411036769cd689279982bc2378049507f5b776425406609074579b3980",
    budget: 125_000_000_000,
    deadline: now + 5_400,
    status: "accepted",
    result_hash: hash(105),
    evidence_hash: hash(106),
  },
  {
    name: "Verify inference receipt batch",
    address: `0:${hash(108)}`,
    creator: `0:${hash(109)}`,
    assigned_agent: `0:${hash(110)}`,
    budget: 48_000_000_000,
    deadline: now + 11_700,
    status: "open",
  },
  {
    name: "Edge terminal latency audit",
    address: `0:${hash(112)}`,
    creator: previewAddress,
    assigned_agent: agentAddress,
    budget: 230_000_000_000,
    deadline: now - 3_900,
    status: "settled",
  },
  {
    name: "Dataset provenance review",
    address: `0:${hash(115)}`,
    creator: `0:${hash(116)}`,
    assigned_agent: null,
    budget: 75_000_000_000,
    deadline: now + 28_800,
    status: "open",
  },
];

export const previewDisputes: Dispute[] = [
  {
    address: `0:${hash(118)}`,
    claimant: previewAddress,
    respondent: agentAddress,
    reviewer: `0:${hash(119)}`,
    status: "open",
    ruling: 0,
    split_bps: 0,
    deadline: now + 18_000,
    subject_hash: hash(120),
  },
];

export const previewServices: Service[] = [
  {
    address: serviceAddress,
    owner: previewAddress,
    authorized_caller: agentAddress,
    open_access: true,
    status: "active",
    price_per_call: 2_500_000_000,
    rate_limit_per_day: 1_000,
    withdrawable_revenue: 384_500_000_000,
    pending_count: 3,
    live_count: 8,
  },
  {
    address: `0:${hash(125)}`,
    owner: `0:${hash(126)}`,
    open_access: true,
    status: "active",
    price_per_call: 900_000_000,
    rate_limit_per_day: 4_000,
    withdrawable_revenue: 927_200_000_000,
    pending_count: 11,
    live_count: 19,
  },
  {
    address: `0:${hash(128)}`,
    owner: `0:${hash(129)}`,
    open_access: false,
    status: "paused",
    price_per_call: 8_000_000_000,
    rate_limit_per_day: 250,
    withdrawable_revenue: 66_000_000_000,
    pending_count: 0,
    live_count: 2,
  },
];

export const previewAgents: Agent[] = [
  {
    address: agentAddress,
    owner: previewAddress,
    controller_pubkey: hash(140),
    seqno: 184,
    spend_day: Math.floor(now / 86_400),
    spent_today: 38_500_000_000,
    max_per_tx: 50_000_000_000,
    daily_limit: 500_000_000_000,
    default_task_timeout_secs: 7_200,
    metadata_hash: hash(141),
    service_endpoint_hash: hash(142),
    activeTasks: 1,
  },
  {
    address: `0:${hash(145)}`,
    owner: `0:${hash(146)}`,
    controller_pubkey: hash(147),
    seqno: 72,
    spend_day: Math.floor(now / 86_400),
    spent_today: 12_100_000_000,
    max_per_tx: 25_000_000_000,
    daily_limit: 200_000_000_000,
    default_task_timeout_secs: 3_600,
    activeTasks: 0,
  },
];

export const previewHome: HomeData = {
  blocks: previewBlocks.slice(0, 6),
  transactions: previewTransactions.slice(0, 8),
  tasks: previewTasks.slice(0, 3),
  services: previewServices.slice(0, 3),
  consensusBlock: 4_281_902,
  signers: 27,
};

export function getPreviewBlock(seqno: number): BlockDetail {
  const summary = previewBlocks.find((block) => block.seqno === seqno) ?? { ...previewBlocks[0]!, seqno };
  return {
    summary,
    header: {
      id: summary,
      global_id: -239,
      version: 0,
      after_merge: false,
      after_split: false,
      before_split: false,
      want_merge: false,
      want_split: false,
      validator_list_hash_short: 1_982_411_762,
      catchain_seqno: 7_891,
      min_ref_mc_seqno: summary.seqno - 4,
      is_key_block: summary.keyBlock,
      prev_key_block_seqno: summary.seqno - 120,
      start_lt: summary.startLt ?? "0",
      end_lt: summary.endLt ?? "0",
      gen_utime: summary.time,
      prev_blocks: [{ ...summary, seqno: summary.seqno - 1 }],
    },
    transactions: previewTransactions.filter((transaction) => transaction.block?.seqno === summary.seqno),
  };
}

export function getPreviewTransaction(account: string, lt: string, txHash: string): TransactionDetail {
  const summary = previewTransactions.find((transaction) => transaction.hash === txHash) ?? {
    ...previewTransactions[0]!, account, lt, hash: txHash,
  };
  return {
    ...summary,
    raw: {
      transaction_id: { lt: summary.lt, hash: summary.hash },
      fee: summary.fee ?? "1420000",
      in_msg: { kind: "internal", source: previewAddress, destination: summary.account, value: "125000000000" },
      out_msgs: [{ kind: "internal", source: summary.account, destination: serviceAddress, value: "2500000000" }],
    },
  };
}

export function getPreviewToken(address: string, hint?: string): TokenData {
  if (hint === "nft") {
    return {
      "@type": "ext.tokens.nftItemData",
      init: true,
      index: 42,
      collection_address: `0:${hash(166)}`,
      owner_address: previewAddress,
      individual_content: "te6cckEBAQEAIgAAQFByZXZpZXcgTkZUIGNvbnRlbnQgY29tbWl0bWVudA==",
    };
  }
  return {
    "@type": "ext.tokens.jettonMasterData",
    total_supply: "1000000000000000",
    mintable: true,
    admin_address: previewAddress,
    jetton_content: "te6cckEBAQEAIwAAQlByZXZpZXcgSmV0dG9uIG1ldGFkYXRh",
    jetton_wallet_code: "te6cckEBAQEAAwAAAgA=",
    jetton_name: address === serviceAddress ? "Service Credit" : "TOS Preview Asset",
    jetton_symbol: address === serviceAddress ? "SRV" : "TPA",
    jetton_decimals: "9",
    jetton_description: "Preview metadata illustrating the node-authoritative token detail view.",
  };
}

export function getPreviewAccount(address: string): AccountDetail {
  return {
    address,
    info: {
      balance: "2847350000000",
      code: "te6cckEBAQEAAwAAAgA=",
      data: "te6cckEBAQEAJgAASERlbW8gc3RhdGUgZm9yIFRPU0NBTiBwcmV2aWV3",
      last_transaction_id: { lt: previewTransactions[0]!.lt, hash: previewTransactions[0]!.hash },
      block_id: previewBlocks[0]!,
      sync_utime: now,
      state: "active",
      frozen_hash: "",
      extra_currencies: [],
    },
    capability: {
      address,
      account_model: "capability-v1",
      authorization_version: "1",
      balance: "2847350000000",
      account_state: "active",
      wallet_type: "tos-wallet-v5",
      seqno: 412,
      supports_delegation: true,
      supports_sessions: true,
      supports_agents: true,
      revision: 3,
      delegation_count: 2,
      session_count: 1,
      agent_count: 1,
    },
    agents: [{ threshold_n: 2, threshold_k: 1, principals: [agentAddress, `0:${hash(151)}`], status: "active" }],
    events: previewTransactions.slice(0, 5).map((transaction, index) => ({
      event_id: `${transaction.lt}:${transaction.hash}`,
      lt: transaction.lt,
      hash: transaction.hash,
      timestamp: transaction.time,
      fee: transaction.fee,
      transfers: [{
        direction: index % 2 ? "outgoing" : "incoming",
        source: index % 2 ? address : serviceAddress,
        destination: index % 2 ? serviceAddress : address,
        amount: String((index + 1) * 12_500_000_000),
        bounced: false,
        comment: index === 0 ? "Task settlement" : undefined,
      }],
    })),
    jettons: [{ jetton_master: `0:${hash(154)}`, jetton_wallet: `0:${hash(155)}`, last_lt: previewTransactions[0]!.lt }],
    nfts: [{ nft_item: `0:${hash(157)}`, collection: `0:${hash(158)}`, last_lt: previewTransactions[1]!.lt }],
    indexedTransactions: previewTransactions.filter((transaction) => transaction.account === address),
    indexedTransactionTotal: previewTransactions.filter((transaction) => transaction.account === address).length,
  };
}
