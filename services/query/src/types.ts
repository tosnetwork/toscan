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
