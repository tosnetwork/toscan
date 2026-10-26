/** Read-only native RPC probe. Inputs and output contain public state only. */
import { readFile, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { JsonRpcClient } from "../src/api/jsonRpc.js";
import { PqExplorer } from "../src/api/pqExplorer.js";
import { TosRpc } from "../services/query/src/rpc.js";
import type { ValidatorSetConfig } from "../services/query/src/types.js";

const endpoint = process.env.TOS_RPC_UPSTREAM ?? "http://127.0.0.1:19447";
const api = new PqExplorer(new JsonRpcClient({ endpoint, transport: "rest", timeout: 30_000 }));
const rpc = new TosRpc({ baseUrl: endpoint, requestsPerSecond: 20 });
const block = await api.observation();
const global = await api.config(8, block);
const limits = await api.config(43, block);
const policy = await api.config(48, block);
const signatures = await api.signatures(block, process.env.TOSCAN_EXPORT_PROOF === "true");
if (!signatures) throw new Error("Expected a PQ finality carrier on this disposable fixture");
const members = await rpc.call<{ validator_set: ValidatorSetConfig }>("getConfigParam", { param: 34, seqno: block.seqno });
if (!members.validator_set.validators.length || members.validator_set.validators.some((member) => member.algorithm_id !== 1 || !member.validator_id || !member.key_id || member.public_key !== null || !member.pq_public_key)) throw new Error("Expected PQ validator membership");
// Generated native getConfigParams TL: constructor/mode, bare full block ID, bare vector [8].
const query = Buffer.alloc(96);
query.writeUInt32LE(589251042, 0); query.writeInt32LE(0x10000, 4);
query.writeInt32LE(block.workchain, 8); query.writeBigInt64LE(BigInt(block.shard), 12); query.writeInt32LE(block.seqno, 20);
Buffer.from(block.root_hash, "base64").copy(query, 24); Buffer.from(block.file_hash, "base64").copy(query, 56);
query.writeInt32LE(1, 88); query.writeInt32LE(8, 92);
const relay = await api.proof(query.toString("base64"));
const addresses: Record<string, string> = process.env.TOSCAN_PQ_ACCOUNTS ? JSON.parse(await readFile(process.env.TOSCAN_PQ_ACCOUNTS, "utf8")) : {};
for (const role of ["WALLET", "VAULT"] as const) {
  const address = process.env[`TOSCAN_QUANTUM_${role}`]; if (address) addresses[role.toLowerCase()] = address;
}
const accounts: Record<string, unknown> = {};
for (const [name, address] of Object.entries(addresses)) {
  if (name === "malformed_module") continue;
  accounts[name] = await api.account(address, block, process.env.TOSCAN_EXPORT_PROOF === "true");
}
let queryReady: unknown = null;
if (process.env.TOSCAN_QUERY_ORIGIN) {
  const ready = await fetch(`${process.env.TOSCAN_QUERY_ORIGIN}/readyz`, { signal: AbortSignal.timeout(10_000) });
  if (!ready.ok) throw new Error(`Query not ready (${ready.status})`);
  queryReady = await ready.json();
}
const evidence = { observedAt: new Date().toISOString(), block, configs: [global, limits, policy], signatures, relay, pqMembers: members.validator_set.validators.length, queryReady, accounts, scope: "Node-verified public observations; not independent browser verification, account admission or production acceptance." };
const output = process.argv[2]; if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ block: block.seqno, version: global.observation.vm_version, pqMembers: evidence.pqMembers, signatureEvidence: "node_verified", accounts: Object.keys(accounts), relayBytes: Buffer.from(relay.reply, "base64").length, output: output ?? null }));
