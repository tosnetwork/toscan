/** Read-only parity probe. Does not start nodes, reset databases or inspect signer files. */
import { writeFile } from "node:fs/promises";
import { TosRpc } from "../services/query/src/rpc.js";
import { decodeGlobalVersion, decodeAuthPolicy, decodeControllerPolicy } from "../src/utils/protocol.js";
import type { BlockId, ValidatorSetConfig } from "../services/query/src/types.js";
import { inspectAccountCryptography } from "../src/utils/account-crypto.js";

const rpc = new TosRpc({ baseUrl: process.env.TOS_RPC_UPSTREAM ?? "http://127.0.0.1:19447", requestsPerSecond: 20 });
const info = await rpc.masterchainInfo();
async function config(id: number): Promise<string | null> {
  try {
    const response = await rpc.call<{ block_id: BlockId; config: { bytes: string } }>("getConfigParam", { param: id, seqno: info.last.seqno, with_proof: true });
    if (JSON.stringify(response.block_id) !== JSON.stringify(info.last)) {
      for (const key of ["workchain", "shard", "seqno", "root_hash", "file_hash"] as const) {
        if (response.block_id[key] !== info.last[key]) throw new Error("Mixed-block config evidence");
      }
    }
    return response.config.bytes;
  } catch (error) {
    if (id !== 8 && error instanceof Error && error.message === `getConfigParam failed (500): config param ${id} not found`) return null;
    throw error;
  }
}
const version = decodeGlobalVersion((await config(8))!);
const policy = await config(48); const controllers = await config(47);
if (version.version >= 17 && !policy) throw new Error("Missing mandatory AUTH policy");
const members = await rpc.call<{ validator_set: ValidatorSetConfig }>("getConfigParam", { param: 34, seqno: info.last.seqno });
if (!members.validator_set.validators.length || members.validator_set.validators.some((member) => member.algorithm_id !== 1 || !member.validator_id || !member.key_id || member.public_key !== null || !member.pq_public_key)) throw new Error("Expected PQ validator membership");
let signatureEvidence = "available";
try { await rpc.call("getMasterchainBlockSignatures", { seqno: info.last.seqno }); }
catch (error) {
  if (!(error instanceof Error) || error.message !== "getMasterchainBlockSignatures failed (500): post-quantum block signatures are not supported by JSON-RPC yet") throw error;
  signatureEvidence = "unavailable: node RPC has no PQ signature carrier";
}
const queryOrigin = process.env.TOSCAN_QUERY_ORIGIN ?? "http://127.0.0.1:19454";
const ready = await fetch(`${queryOrigin}/readyz`); if (!ready.ok) throw new Error(`Query not ready (${ready.status})`);
const accounts: Record<string, unknown> = {};
for (const name of ["WALLET", "VAULT"] as const) {
  const address = process.env[`TOSCAN_QUANTUM_${name}`]; if (!address) continue;
  const state = await rpc.call<{ code: string; data: string }>("getAddressInformation", { address });
  const evidence = inspectAccountCryptography(state.code, state.data);
  if (evidence.status !== "known") throw new Error(`Unrecognized or malformed ${name} fixture`);
  accounts[name.toLowerCase()] = { address, codeHash: evidence.codeHash, fields: evidence.fields };
}
const evidence = { observedAt: new Date().toISOString(), block: info.last, genesis: info.init, ...version, policy: policy ? decodeAuthPolicy(policy) : null, controllerCodes: controllers ? decodeControllerPolicy(controllers) : null, pqMembers: members.validator_set.validators.length, signatureEvidence, query: await ready.json(), accounts };
const output = process.argv[2]; if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ block: info.last.seqno, version: version.version, pqMembers: evidence.pqMembers, signatureEvidence, output: output ?? null }));
