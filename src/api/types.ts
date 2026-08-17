export interface BlockId {
  workchain: number;
  shard: string;
  seqno: number;
  root_hash: string;
  file_hash: string;
}

export interface MasterchainInfo {
  last: BlockId;
  state_root_hash: string;
  init: BlockId;
}

export interface BlockHeader {
  id: BlockId;
  global_id: number;
  version: number;
  after_merge: boolean;
  after_split: boolean;
  before_split: boolean;
  want_merge: boolean;
  want_split: boolean;
  validator_list_hash_short: number;
  catchain_seqno: number;
  min_ref_mc_seqno: number;
  is_key_block: boolean;
  prev_key_block_seqno: number;
  start_lt: string;
  end_lt: string;
  gen_utime: number;
  prev_blocks: BlockId[];
}

export interface ShortTransaction {
  account?: string;
  lt?: string;
  hash?: string;
}

export interface TransactionMessage {
  hash?: string;
  kind: "internal" | "external" | "unknown";
  source?: string;
  destination?: string;
  value?: string;
  bounced?: boolean;
  created_lt?: string;
  created_at?: number;
}

export interface RawTransaction {
  data?: string;
  transaction_id: { lt: string; hash: string };
  account?: string;
  utime?: number;
  fee?: string;
  in_msg_hash?: string;
  in_msg?: TransactionMessage | null;
  out_msgs?: TransactionMessage[];
}

export interface BlockTransactions {
  id: BlockId;
  req_count: number;
  incomplete: boolean;
  transactions: ShortTransaction[];
}

export interface BlockTransactionsExt {
  id: BlockId;
  req_count: number;
  incomplete: boolean;
  transactions: RawTransaction[];
}

export interface AccountInfo {
  balance: string;
  code: string;
  data: string;
  last_transaction_id: { lt: string; hash: string };
  block_id: BlockId;
  sync_utime: number;
  state: string;
  frozen_hash: string;
  extra_currencies?: Array<{ id: number; amount: string }>;
}

export interface AccountCapability {
  address: string;
  account_model: string;
  authorization_version: string;
  balance: string;
  account_state: string;
  wallet_type: string | null;
  seqno: number | null;
  supports_delegation: boolean;
  supports_sessions: boolean;
  supports_agents: boolean;
  revision: number;
  delegation_count: number;
  session_count: number;
  agent_count: number;
}

export interface AccountAgent {
  threshold_n: number;
  threshold_k: number;
  principals: string[];
  status: string;
}

export interface WalletEvent {
  event_id: string;
  lt: string;
  hash: string;
  timestamp?: number;
  fee?: string;
  transfers?: Array<{
    direction: "incoming" | "outgoing";
    source: string;
    destination: string;
    amount: string;
    bounced: boolean;
    comment?: string;
  }>;
}

export interface JettonPosition {
  jetton_master: string;
  jetton_wallet: string;
  last_lt: string;
}

export interface NftPosition {
  nft_item: string;
  collection: string | null;
  last_lt: string;
}

export interface JettonMasterData {
  "@type": "ext.tokens.jettonMasterData";
  total_supply: string;
  mintable: boolean;
  admin_address: string;
  jetton_content: string;
  jetton_wallet_code: string;
  jetton_name?: string;
  jetton_symbol?: string;
  jetton_decimals?: string;
  jetton_image?: string;
  jetton_description?: string;
}

export interface NftItemData {
  "@type": "ext.tokens.nftItemData";
  init: boolean;
  index: number;
  collection_address: string;
  owner_address: string;
  individual_content: string;
}

export interface NftCollectionData {
  "@type": "ext.tokens.nftCollectionData";
  next_item_index: number;
  collection_content: string;
  owner_address: string;
}

export type TokenData = JettonMasterData | NftItemData | NftCollectionData;

export interface BlockSummary extends BlockId {
  time: number;
  txCount: number;
  incomplete: boolean;
  keyBlock: boolean;
  startLt?: string;
  endLt?: string;
}

export interface TransactionSummary {
  hash: string;
  lt: string;
  account: string;
  fee?: string;
  time: number;
  block?: Pick<BlockId, "workchain" | "shard" | "seqno">;
}

export interface Task {
  name?: string | null;
  address: string;
  creator: string;
  assigned_agent?: string | null;
  verifier?: string | null;
  budget: string | number;
  deadline: number;
  review_period?: number;
  review_deadline?: number;
  status: string;
  result_hash?: string;
  evidence_hash?: string;
  settlement_policy_hash?: string;
  permission_hash?: string;
  dispute_hash?: string;
}

export interface Service {
  address: string;
  owner: string;
  authorized_caller?: string | null;
  open_access: boolean;
  status: string;
  price_per_call: string | number;
  rate_limit_per_day: number;
  withdrawable_revenue: string | number;
  pending_count: number;
  live_count: number;
}

export interface Dispute {
  address: string;
  claimant: string;
  respondent: string;
  reviewer: string;
  status: string;
  ruling: number;
  split_bps: number;
  deadline: number;
  subject_hash: string;
}

export interface Agent {
  address: string;
  owner: string;
  controller_pubkey: string;
  seqno: number;
  spend_day: number;
  spent_today: string | number;
  max_per_tx: string | number;
  daily_limit: string | number;
  default_task_timeout_secs: number;
  metadata_hash?: string | null;
  service_endpoint_hash?: string | null;
  activeTasks?: number;
}

export interface ExplorerTransaction {
  hash: string;
  account: string;
  lt: string;
  workchain: number;
  shard: string;
  seqno: number;
  gen_utime: number;
  fee: string | null;
  in_msg_hash: string | null;
  indexed_at: number;
}

export interface ExplorerBlock {
  workchain: number;
  shard: string;
  seqno: number;
  root_hash: string;
  file_hash: string;
  gen_utime: number;
  tx_count: number;
  indexed_at: number;
  observed_mc_seqno: number;
}

export interface ExplorerContract<T extends object = Record<string, unknown>> {
  address: string;
  kind: string;
  creator: string | null;
  counterparty: string | null;
  status: string | null;
  deadline: number | null;
  last_seqno: number;
  updated_at: number;
  data: T;
}

export interface ExplorerIndexStatus {
  blocks: number;
  transactions: number;
  contracts: number;
  latest_indexed_at: number | null;
  masterchain_head: number | null;
  masterchain_indexed: number | null;
  masterchain_lag: number | null;
  checkpoints: Array<{ shard: string; seqno: number }>;
}

export type ExplorerSearchHit =
  | { kind: "transaction"; result: ExplorerTransaction }
  | { kind: "block"; result: ExplorerBlock }
  | { kind: "contract"; result: ExplorerContract };

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  complete: boolean;
}

export interface ListResponse<T> {
  ok: boolean;
  total: number;
  offset: number;
  limit: number;
  result: T[];
}

export interface HomeData {
  blocks: BlockSummary[];
  transactions: TransactionSummary[];
  tasks: Task[];
  services: Service[];
  consensusBlock: number | null;
  signers: number | null;
}

export interface BlockDetail {
  summary: BlockSummary;
  header: BlockHeader;
  transactions: TransactionSummary[];
}

export interface TransactionDetail extends TransactionSummary {
  raw: RawTransaction;
}

export interface AccountDetail {
  address: string;
  info: AccountInfo;
  capability: AccountCapability | null;
  agents: AccountAgent[];
  events: WalletEvent[];
  jettons: JettonPosition[];
  nfts: NftPosition[];
  indexedTransactions: TransactionSummary[];
  indexedTransactionTotal: number;
}

export type DataMode = "live" | "preview" | "offline";
