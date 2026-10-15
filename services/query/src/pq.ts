import type { BlockId } from "./types.js";

/** Wire validation is a display boundary. Cryptographic verification stays in the node. */
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid PQ response object");
  return value as Record<string, unknown>;
}
function requireValue(ok: unknown): asserts ok { if (!ok) throw new Error("Invalid PQ response evidence"); }
export function uint(value: unknown, bits = 32): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2 ** bits - 1;
}
function u64(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
}
function i32(value: unknown): boolean { return typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647; }
export function bytes(value: unknown, max: number, exact?: number): value is string {
  if (typeof value !== "string" || value.length > Math.ceil(max / 3) * 4 || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  try { const raw = atob(value); return raw.length <= max && (exact === undefined || raw.length === exact) && btoa(raw) === value; } catch { return false; }
}
function hash(value: unknown): boolean { return bytes(value, 32, 32); }
function address(value: unknown): boolean { return typeof value === "string" && /^(0|-1):[0-9a-f]{64}$/.test(value); }
export function blockId(value: unknown): BlockId {
  const v = object(value);
  requireValue(i32(v.workchain) && typeof v.shard === "string" && /^-?[0-9]{1,20}$/.test(v.shard) && uint(v.seqno) && v.seqno <= 2147483647 && hash(v.root_hash) && hash(v.file_hash));
  return { workchain: v.workchain as number, shard: v.shard as string, seqno: v.seqno as number, root_hash: v.root_hash as string, file_hash: v.file_hash as string };
}
export function sameBlock(actual: unknown, expected: BlockId): BlockId {
  const id = blockId(actual);
  requireValue(["workchain", "shard", "seqno", "root_hash", "file_hash"].every((key) => id[key as keyof BlockId] === expected[key as keyof BlockId]));
  return id;
}
export function masterBlock(value: unknown): BlockId {
  const id = blockId(value);
  requireValue(id.workchain === -1 && id.shard === "-9223372036854775808");
  return id;
}
export interface PqSignature { "@type": "blocks.signature.pq"; validator_id: string; algorithm_id: 1; signature: string }
export interface PqSignatures {
  "@type": "blocks.blockSignatures.simplexPq"; schema_version: 1; id: BlockId;
  cc_seqno: number; validator_set_hash: number; session_id: string; slot: number; candidate: string;
  signature_context: "TOS-CONSENSUS-SIMPLEX-v1"; signing_payload: string; signatures: PqSignature[];
  verification: { status: "node_verified"; scope: "anchored_finality"; trust_anchor: BlockId; validator_set_source: BlockId; expected_session_id: string; verified_weight: string; total_weight: string; quorum_threshold: string };
  proof?: { format: "liteServer.partialBlockProof.tl"; bytes: string; from: BlockId; to: BlockId };
}
export function pqSignatures(value: unknown, expected: BlockId, withProof = false): PqSignatures {
  const v = object(value), verification = object(v.verification);
  sameBlock(v.id, expected);
  requireValue(v["@type"] === "blocks.blockSignatures.simplexPq" && v.schema_version === 1 && uint(v.cc_seqno) && uint(v.validator_set_hash) && uint(v.slot) && hash(v.session_id));
  requireValue(v.signature_context === "TOS-CONSENSUS-SIMPLEX-v1" && bytes(v.candidate, 16384) && bytes(v.signing_payload, 32768));
  requireValue(verification.status === "node_verified" && verification.scope === "anchored_finality" && verification.expected_session_id === v.session_id && u64(verification.verified_weight) && u64(verification.total_weight) && u64(verification.quorum_threshold));
  requireValue(BigInt(verification.verified_weight) >= BigInt(verification.quorum_threshold) && BigInt(verification.verified_weight) <= BigInt(verification.total_weight) && BigInt(verification.total_weight) > 0n && BigInt(verification.quorum_threshold) > 0n);
  masterBlock(verification.trust_anchor); masterBlock(verification.validator_set_source);
  requireValue(Array.isArray(v.signatures) && v.signatures.length > 0 && v.signatures.length <= 400);
  const seen = new Set<string>();
  for (const record of v.signatures) {
    const s = object(record);
    requireValue(s["@type"] === "blocks.signature.pq" && hash(s.validator_id) && s.algorithm_id === 1 && bytes(s.signature, 2420, 2420) && !seen.has(s.validator_id as string));
    seen.add(s.validator_id as string);
  }
  if (v.proof !== undefined) {
    const proof = object(v.proof);
    requireValue(proof.format === "liteServer.partialBlockProof.tl" && bytes(proof.bytes, 8 * 1024 * 1024));
    sameBlock(proof.to, expected); const from = masterBlock(proof.from);
    requireValue(from.seqno === expected.seqno - 1);
  }
  requireValue(!withProof || v.proof !== undefined);
  return v as unknown as PqSignatures;
}
export const FAMILY_NAMES: Record<string, string> = {
  pq_highload_mldsa44_v1: "PQ Highload Wallet", mldsa44_auth_module_v1: "ML-DSA Authorization Module",
  falcon512_padded_auth_module_v1: "Falcon Authorization Module", quantum_module_v1: "Quantum Module",
  quantum_wallet_v4: "Quantum Wallet", quantum_fee_vault_v3: "Quantum Fee Vault",
};
export interface PublicAuthorization {
  schema_version: 1; recognition: "recognized" | "unknown_code" | "no_active_code"; code_hash: string | null;
  code_family: string | null; release_status: "review_candidate" | "not_asserted"; registry_revision: string;
  observed_masterchain_block: BlockId; observed_shard_block: BlockId; state_verified: true;
  state_schema: string | null; public_state: Record<string, unknown> | null;
  proof?: { format: "liteServer.accountState.tl"; bytes: string };
}
function keys(v: Record<string, unknown>, expected: string[]) { requireValue(Object.keys(v).length === expected.length && expected.every((key) => Object.hasOwn(v, key))); }
function moduleState(v: Record<string, unknown>) {
  keys(v, ["kind", "global_id", "network_tag", "primary", "rescue"]);
  requireValue(i32(v.global_id) && hash(v.network_tag));
  const primary = object(v.primary), rescue = object(v.rescue);
  keys(primary, ["algorithm_id", "public_key"]); keys(rescue, ["algorithm_id", "public_key", "policy"]);
  requireValue(primary.algorithm_id === 1 && bytes(primary.public_key, 1312, 1312) && rescue.algorithm_id === 3 && bytes(rescue.public_key, 32, 32) && ["ready", "required"].includes(String(rescue.policy)));
}
function publicState(v: Record<string, unknown>, family: string) {
  requireValue(v.kind === family);
  switch (family) {
    case "pq_highload_mldsa44_v1": keys(v, ["kind", "algorithm_id", "public_key", "consensus_key_id", "subwallet_id", "last_clean_time", "timeout_seconds"]); requireValue(v.algorithm_id === 1 && bytes(v.public_key, 1312, 1312) && hash(v.consensus_key_id) && uint(v.subwallet_id) && u64(v.last_clean_time) && uint(v.timeout_seconds, 22)); break;
    case "mldsa44_auth_module_v1": keys(v, ["kind", "algorithm_id", "global_id", "public_key"]); requireValue(v.algorithm_id === 1 && i32(v.global_id) && bytes(v.public_key, 1312, 1312)); break;
    case "falcon512_padded_auth_module_v1": keys(v, ["kind", "algorithm_id", "profile_version", "global_id", "public_key"]); requireValue(v.algorithm_id === 2 && v.profile_version === 1 && i32(v.global_id) && bytes(v.public_key, 897, 897)); break;
    case "quantum_module_v1": moduleState(v); break;
    case "quantum_wallet_v4": {
      keys(v, ["kind", "seqno", "wallet_id", "auth_mode", "retired_flags", "authority_epoch", "primary_nonce", "rescue_nonce", "legacy_signature_enabled", "module_state_init_hash", "module", "fee"]);
      requireValue(uint(v.seqno) && uint(v.wallet_id) && v.auth_mode === 2 && uint(v.retired_flags, 16) && u64(v.authority_epoch) && u64(v.primary_nonce) && u64(v.rescue_nonce) && v.legacy_signature_enabled === false && hash(v.module_state_init_hash));
      const m = object(v.module); requireValue(m.kind === "quantum_module_v1"); moduleState(m);
      const fee = object(v.fee); keys(fee, ["schema_version", "profile", "algorithm_id", "fee_tree_id", "epoch0", "epoch_seconds", "opening_horizon", "public_key"]);
      requireValue(fee.schema_version === 1 && fee.profile === "hss-lms-sha256-h20-lmots-sha256-w4" && fee.algorithm_id === 4 && hash(fee.fee_tree_id) && uint(fee.epoch0) && fee.epoch_seconds === 3600 && fee.opening_horizon === 4 && bytes(fee.public_key, 60, 60)); break;
    }
    case "quantum_fee_vault_v3": keys(v, ["kind", "next_leaf", "configuration_hash", "epoch0", "module_address", "pop_parties_hash", "fee_public_key", "intent_prefix_hash", "global_id", "network_tag", "wallet_address", "auth_mode"]); requireValue(uint(v.next_leaf) && v.next_leaf <= 1048576 && hash(v.configuration_hash) && uint(v.epoch0) && address(v.module_address) && hash(v.pop_parties_hash) && bytes(v.fee_public_key, 60, 60) && hash(v.intent_prefix_hash) && i32(v.global_id) && hash(v.network_tag) && address(v.wallet_address) && v.auth_mode === 2); break;
    default: throw new Error("Unsupported PQ account schema");
  }
}
export function publicAuthorization(value: unknown, expected: BlockId): PublicAuthorization {
  const v = object(value); sameBlock(v.observed_masterchain_block, expected); blockId(v.observed_shard_block);
  requireValue(v.schema_version === 1 && v.state_verified === true && typeof v.registry_revision === "string" && v.registry_revision.length > 0 && v.registry_revision.length <= 256 && ["recognized", "unknown_code", "no_active_code"].includes(String(v.recognition)));
  requireValue(["review_candidate", "not_asserted"].includes(String(v.release_status)) && (v.code_hash === null || hash(v.code_hash)));
  if (v.recognition === "recognized") {
    requireValue(typeof v.code_family === "string" && Object.hasOwn(FAMILY_NAMES, v.code_family) && v.state_schema === v.code_family && hash(v.code_hash));
    publicState(object(v.public_state), v.code_family);
  } else requireValue(v.code_family === null && v.state_schema === null && v.public_state === null);
  if (v.proof !== undefined) { const proof = object(v.proof); requireValue(proof.format === "liteServer.accountState.tl" && bytes(proof.bytes, 4 * 1024 * 1024)); }
  return v as unknown as PublicAuthorization;
}
export interface DecodedConfig {
  schema_version: 1; param: 8 | 43 | 47 | 48; presence: "present" | "absent";
  observation: { block_id: BlockId; global_id: number; chain_time: number; vm_version: number };
  value: Record<string, unknown> | null;
}
const V1 = ["max_msg_bits", "max_msg_cells", "max_library_cells", "max_ext_msg_size", "max_vm_data_depth", "max_ext_msg_depth"];
const V2 = [...V1, "max_acc_state_cells", "max_mc_acc_state_cells", "max_acc_public_libraries", "defer_out_queue_size_limit", "max_msg_extra_currencies", "max_acc_fixed_prefix_length", "acc_state_cells_for_storage_dict"];
const V3 = [...V2, "max_transaction_library_loads", "max_total_msg_bits", "max_total_msg_cells"];
export function decodedConfig(value: unknown, param: number, expected: BlockId): DecodedConfig {
  const v = object(value), observation = object(v.observation);
  sameBlock(observation.block_id, expected);
  requireValue(v.schema_version === 1 && v.param === param && [8, 43, 47, 48].includes(param) && ["present", "absent"].includes(String(v.presence)) && i32(observation.global_id) && uint(observation.chain_time) && uint(observation.vm_version));
  if (v.presence === "absent" && param !== 43) {
    requireValue((param === 47 || (param === 48 && observation.vm_version < 17)) && v.value === null);
  } else {
    const data = object(v.value);
    if (param === 8) requireValue(v.presence === "present" && data.kind === "global_version" && data.version === observation.vm_version && u64(data.capabilities));
    if (param === 47) {
      requireValue(data.kind === "validator_controller_policy_v1" && Array.isArray(data.controller_codes) && data.controller_codes.length <= 8 && data.controller_codes.every(hash));
      const codes = data.controller_codes as string[];
      const raw = codes.map((code) => atob(code)); requireValue(raw.every((code, i) => i === 0 || raw[i - 1]! < code));
    }
    if (param === 48) {
      requireValue(data.kind === "auth_policy_v1" && hash(data.network_tag) && u64(data.policy_sequence) && uint(data.retired_flags, 16) && !(data.retired_flags & ~2) && (data.primary_deadline === null || (uint(data.primary_deadline) && data.primary_deadline > 0)) && data.policy_spec_hash === "XkOArtyV+Mty3lX3UG3gJptHwDrR0e0OUYTDMlRCYsA=");
      const retired = Boolean(data.retired_flags & 2) || (typeof data.primary_deadline === "number" && observation.chain_time >= data.primary_deadline);
      requireValue(data.primary_status === (retired ? "retired" : "not_retired"));
    }
    if (param === 43) {
      requireValue(data.kind === "size_limits"); const effective = object(data.effective);
      requireValue(Object.keys(effective).length === V3.length && V3.every((key) => (key === "max_transaction_library_loads" && effective[key] === null) || uint(effective[key], key.includes("depth") ? 16 : key === "max_acc_fixed_prefix_length" ? 8 : 32)));
      const configured = v.presence === "absent" ? [] : data.wire_version === 1 ? V1 : data.wire_version === 2 ? V2 : data.wire_version === 3 ? V3 : null;
      requireValue(configured !== null && Array.isArray(data.defaulted_fields));
      if (v.presence === "absent") requireValue(data.wire_version === null && data.configured === null);
      else { const c = object(data.configured); requireValue(Object.keys(c).length === configured.length && configured.every((key) => c[key] === effective[key])); }
      const defaults = V3.filter((key) => !configured.includes(key));
      requireValue(data.defaulted_fields.length === defaults.length && new Set(data.defaulted_fields).size === defaults.length && defaults.every((key) => (data.defaulted_fields as unknown[]).includes(key)));
    }
  }
  return v as unknown as DecodedConfig;
}
