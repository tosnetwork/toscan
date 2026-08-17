export interface BlockId {
  workchain: number;
  shard: string;
  seqno: number;
  root_hash: string;
  file_hash: string;
}

export interface MasterchainInfo {
  last: BlockId;
}

export interface ShardsInfo {
  shards: BlockId[];
}

export interface BlockHeader {
  gen_utime: number;
}

export interface BlockTransaction {
  account: string;
  lt: string;
  hash: string;
  utime?: number;
  fee?: string;
  in_msg_hash?: string;
  in_msg?: TransactionMessage | null;
  out_msgs?: TransactionMessage[];
  transaction_type?: string;
  aborted?: boolean | null;
  destroyed?: boolean | null;
  compute?: TransactionCompute | null;
  action?: TransactionAction | null;
}

export interface TransactionMessage {
  hash?: string;
  kind: string;
  source?: string;
  destination?: string;
  value?: string;
  bounced?: boolean;
  created_lt?: string;
  created_at?: number;
}

export interface TransactionCompute {
  skipped: boolean;
  success?: boolean;
  exit_code?: number;
  vm_steps?: number;
  account_activated?: boolean;
  skip_reason?: number;
}

export interface TransactionAction {
  success: boolean;
  valid: boolean;
  no_funds: boolean;
  result_code: number;
  total_actions: number;
  skipped_actions: number;
  messages_created: number;
}

export interface BlockTransactionsPage {
  id?: BlockId;
  incomplete: boolean;
  transactions: BlockTransaction[];
}

export interface ProjectedTransaction {
  hash: string;
  account: string;
  lt: string;
  workchain: number;
  shard: string;
  seqno: number;
  fee: string | null;
  in_msg_hash: string | null;
  details?: Record<string, unknown>;
}

export interface ProjectedBlock {
  workchain: number;
  shard: string;
  seqno: number;
  root_hash: string;
  file_hash: string;
  gen_utime: number;
  observed_mc_seqno: number;
  transactions: ProjectedTransaction[];
}

export interface MasterchainBundle {
  seqno: number;
  rootHash: string;
  blocks: ProjectedBlock[];
}

export interface ExplorerContract {
  address: string;
  kind: string;
  creator: string | null;
  counterparty: string | null;
  status: string | null;
  deadline: number | null;
  last_seqno: number;
  updated_at: number;
  data: Record<string, unknown>;
}

export interface ContractListResponse {
  ok: boolean;
  total: number;
  offset: number;
  limit: number;
  result: ExplorerContract[];
}

export interface ExplorerStakingCycle {
  election_id: number;
  unfreeze_at: number;
  duration_seconds: number;
  total_stake: string;
  rewards: string;
  reward_rate: number;
  annualized_apr: number | null;
  compounded_apy: number | null;
  validator_count: number;
  vset_hash: string;
}

export interface ExplorerStakingOverview {
  current_election_available?: boolean;
  reward_history_available?: boolean;
  active_election_id: number;
  election_closes_at: number;
  current_election_stake: string;
  current_participants: number;
  minimum_stake: string;
  election_failed: boolean;
  election_finished: boolean;
  pools: number;
  active_pools: number;
  nominators: number;
  total_pool_stake: string;
  effective_stake?: {
    max_stake_factor_raw: number | null;
    max_stake_factor: number | null;
    smallest_elected_stake: string | null;
    effective_stake_cap: string | null;
    surplus_earns: boolean | null;
  };
  updated_at: number;
}

export interface ExplorerStakingResponse {
  ok: boolean;
  result: ExplorerStakingOverview;
  cycles: ExplorerStakingCycle[];
}

export interface ValidatorMember {
  public_key: string;
  adnl_address: string;
  weight: string;
  cumulative_weight: string;
}

export interface ValidatorSetConfig {
  utime_since: number;
  utime_until: number;
  total: number;
  main: number;
  total_weight: string;
  validators: ValidatorMember[];
}

export interface ValidatorSetSnapshot {
  observed_mc_seqno: number;
  observed_at: number;
  validator_set: ValidatorSetConfig | null;
  signatures: Array<{ node_id_short: string; signature: string }>;
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

export type TokenData = Record<string, unknown> & { "@type": string };

export interface ExplorerAsset {
  address: string;
  kind: "jetton" | "nft_item" | "nft_collection";
  updated_at: number;
  data: TokenData | Record<string, never>;
}
