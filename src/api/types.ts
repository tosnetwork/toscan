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

export interface RawTransaction {
  data?: string;
  transaction_id: { lt: string; hash: string };
  account?: string;
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
  details?: Pick<RawTransaction,
    "transaction_type" | "aborted" | "destroyed" | "compute" | "action" | "in_msg" | "out_msgs">;
}

export interface ExplorerMessageOccurrence extends TransactionMessage {
  transaction_hash: string;
  direction: "in" | "out";
  account: string;
  transaction_lt: string;
  workchain: number;
  shard: string;
  seqno: number;
}

export interface ExplorerMessage {
  hash: string;
  occurrences: ExplorerMessageOccurrence[];
}

export interface EconomyStats {
  agents: number;
  tasks: number;
  open_tasks: number;
  settled_tasks: number;
  services: number;
  disputes: number;
  total_task_budget: string;
  service_revenue: string;
  task_statuses: Array<{ status: string | null; count: number }>;
}

export interface StakingCycle {
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
  observed_at: number;
}

export interface EffectiveStakePolicy {
  max_stake_factor_raw: number | null;
  max_stake_factor: number | null;
  smallest_elected_stake: string | null;
  effective_stake_cap: string | null;
  surplus_earns: boolean | null;
}

export interface NominatorPosition {
  address: string;
  amount: string | number;
  pending_deposit: string | number;
  withdraw_requested: boolean;
}

export interface NominatorPoolData {
  state: number;
  nominators_count: number;
  stake_amount_sent: string;
  validator_amount: string;
  nominator_stake: string;
  total_balance_at_risk: string;
  validator_address: string;
  validator_reward_share_bps: number;
  max_nominators_count: number;
  min_validator_stake: string;
  min_nominator_stake: string;
  stake_at: number;
  saved_validator_set_hash: string;
  validator_set_changes_count: number;
  validator_set_change_time: number;
  stake_held_for: number;
  nominators: NominatorPosition[];
}

export interface StakingData {
  current_election_available: boolean;
  reward_history_available: boolean;
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
  effective_stake?: EffectiveStakePolicy;
  updated_at: number;
  cycles: StakingCycle[];
  pool_records: Array<ExplorerContract<NominatorPoolData>>;
}

export interface PoolSnapshot {
  observed_at: number;
  status: string | null;
  last_seqno: number;
  data: NominatorPoolData;
}

export interface NominatorPoolDetail {
  pool: ExplorerContract<NominatorPoolData>;
  history: PoolSnapshot[];
  network_reward_cycles: StakingCycle[];
  effective_stake: EffectiveStakePolicy | null;
}

export interface BlockSignature {
  node_id_short: string;
  signature: string;
}

export interface BlockSignatures {
  id: BlockId;
  signatures: BlockSignature[];
}

export interface ValidatorSetConfig {
  utime_since: number;
  utime_until: number;
  total: number;
  main: number;
  total_weight: string;
  validators: Array<{
    public_key: string;
    adnl_address: string;
    weight: string;
    cumulative_weight: string;
  }>;
}

export interface ValidatorOverview extends BlockSignatures {
  validator_set: ValidatorSetConfig | null;
}

export interface ValidatorSetSnapshot {
  observed_mc_seqno: number;
  observed_at: number;
  validator_set: ValidatorSetConfig | null;
  next_validator_set?: ValidatorSetConfig | null;
  signatures: BlockSignature[];
}

export interface ValidatorStakingSummary {
  current_election_available: boolean;
  active_election_id: number;
  election_closes_at: number;
  current_election_stake: string;
  current_participants: number;
  latest_cycle: StakingCycle | null;
  effective_stake: EffectiveStakePolicy | null;
}

export interface ValidatorDashboard extends ValidatorSetSnapshot {
  staking: ValidatorStakingSummary | null;
}

export interface ValidatorHistoryPoint {
  observed_mc_seqno: number;
  observed_at: number;
  total_weight: string;
  selection_phase?: "current" | "next";
  public_key: string;
  adnl_address: string;
  weight: string;
  cumulative_weight: string;
}

export interface ValidatorDetail {
  public_key: string;
  current: ValidatorHistoryPoint;
  currently_selected: boolean;
  selected_for_next_set: boolean;
  current_set_valid_until: number | null;
  next_set_valid_from: number | null;
  next_set_valid_until: number | null;
  latest_observed_mc_seqno: number;
  observed_signature_count: number;
  selected_sets: number;
  first_observed_at: number;
  last_observed_at: number;
  history: ValidatorHistoryPoint[];
  network_reward_cycles: StakingCycle[];
  effective_stake: EffectiveStakePolicy | null;
  reward_attribution_available: false;
  signature_attribution_available: false;
}

export interface NetworkAnalytics {
  window: "24h" | "7d" | "30d" | "90d";
  bucket_seconds: number;
  activity: Array<{ bucket: number; blocks: number; transactions: number; fees: string }>;
  contracts: Array<{ kind: string; count: number }>;
  assets: Array<{ kind: string; count: number }>;
}

export interface AddressLabel {
  address: string;
  label: string;
  category: string;
  source: string;
  source_url: string | null;
  verified: boolean;
  updated_at: number;
}

export interface GovernanceConfigProof {
  seqno: number;
  parameters: Array<{
    id: number;
    name: string;
    description: string;
    bytes: string | null;
  }>;
}

export interface GovernanceSnapshot {
  observed_mc_seqno: number;
  observed_at: number;
  parameters: Array<{ id: number; bytes: string | null }>;
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
  assets: number;
  latest_indexed_at: number | null;
  masterchain_head: number | null;
  masterchain_indexed: number | null;
  masterchain_lag: number | null;
  checkpoints: Array<{ shard: string; seqno: number }>;
}

export interface ExplorerAsset {
  address: string;
  kind: "jetton" | "nft_item" | "nft_collection";
  updated_at: number;
  holder_count: number;
  data: Record<string, unknown>;
}

export interface ExplorerAssetDetail extends ExplorerAsset {
  holders: Array<{
    owner_address: string;
    position_address: string | null;
    kind: "jetton" | "nft_item";
    last_lt: string;
  }>;
  offset: number;
  limit: number;
}

export interface ExplorerAssetHolder {
  owner_address: string;
  position_address: string | null;
  kind: "jetton" | "nft_item";
  last_lt: string;
}

export interface ExplorerAssetPositionEvent extends ExplorerAssetHolder {
  id: number;
  asset_address: string;
  event_type: "observed" | "removed";
  observed_at: number;
}

export interface ContractVerification {
  address: string;
  compiler: string;
  compiler_version: string;
  repository_url: string;
  source_commit: string;
  source_digest: string;
  build_command: string;
  verified_at: number;
  observed_mc_seqno: number;
  manifest: Record<string, unknown>;
}

export interface ExplorerSearchSuggestion {
  kind: "label" | "contract" | "asset" | "transaction" | "message" | "block" | "verification";
  title: string;
  subtitle: string;
  value: string;
  route: string;
}

export type ExplorerSearchHit =
  | { kind: "transaction"; result: ExplorerTransaction }
  | { kind: "message"; result: ExplorerMessageOccurrence }
  | { kind: "asset"; result: ExplorerAsset }
  | { kind: "block"; result: ExplorerBlock }
  | { kind: "contract"; result: ExplorerContract }
  | { kind: "label"; result: AddressLabel };

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  complete: boolean;
  nextCursor?: string | null;
}

export interface ListResponse<T> {
  ok: boolean;
  total: number;
  offset: number;
  limit: number;
  result: T[];
  next_cursor?: string | null;
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
