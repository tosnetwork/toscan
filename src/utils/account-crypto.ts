import { Cell } from "@ton/core";
import { ordinaryCell } from "./protocol";
import registry from "./pq-code-registry.json";

export interface AccountCryptography {
  status: "known" | "unknown" | "invalid";
  name: string;
  codeHash: string | null;
  candidate: boolean;
  fields: Record<string, string>;
  error?: string;
}

function requireValue(ok: boolean): void { if (!ok) throw new Error("Unsupported or malformed public storage"); }
function keyChain(cell: Cell, expected: number): string {
  let remaining = expected;
  let hex = "";
  for (;;) {
    const s = cell.beginParse();
    const bytes = Math.min(127, remaining);
    requireValue(bytes > 0 && s.remainingBits === bytes * 8 && s.remainingRefs === (remaining > 127 ? 1 : 0));
    hex += s.loadBuffer(bytes).toString("hex");
    remaining -= bytes;
    if (!remaining) { s.endParse(); return hex; }
    cell = s.loadRef(); s.endParse();
  }
}
function quantumModule(data: Cell): Record<string, string> {
  const s = data.beginParse();
  requireValue(s.loadUint(8) === 1);
  const globalId = s.loadInt(32).toString();
  const networkTag = s.loadBuffer(32).toString("hex");
  requireValue(s.loadUint(8) === 1);
  const primaryKey = keyChain(s.loadRef(), 1312);
  const rescueKey = s.loadBuffer(32).toString("hex");
  const policy = s.loadUint(8); requireValue(policy === 1 || policy === 2); s.endParse();
  return { "Daily authorization": "ML-DSA-44", "Rescue authorization": "SLH-DSA-SHA2-128s", "Global ID": globalId, "Network tag": networkTag, "Rescue policy": policy === 1 ? "Ready" : "Required", "Daily public key": primaryKey, "Rescue public key": rescueKey };
}

/** Code-hash identification and public storage decoding; no signature or release approval claim. */
export function inspectAccountCryptography(code: string, data: string): AccountCryptography {
  const result: AccountCryptography = { status: "unknown", name: "Unrecognized contract", codeHash: null, candidate: false, fields: {} };
  if (!code) return result;
  try {
    result.codeHash = ordinaryCell(code).hash().toString("hex");
    const match = registry.contracts.find((item) => item.hash === result.codeHash);
    if (!match) return result;
    result.name = match.name; result.candidate = match.candidate;
    const cell = ordinaryCell(data);
    const s = cell.beginParse();
    if (match.kind === "mldsa-module" || match.kind === "falcon-module") {
      result.fields["Global ID"] = s.loadInt(32).toString();
      if (match.kind === "falcon-module") requireValue(s.loadUint(16) === 1);
      result.fields["Authorization algorithm"] = match.kind === "mldsa-module" ? "ML-DSA-44" : "Falcon-512 padded";
      result.fields["Public key"] = keyChain(s.loadRef(), match.kind === "mldsa-module" ? 1312 : 897); s.endParse();
    } else if (match.kind === "pq-highload") {
      const stored = s.loadRef().beginParse();
      requireValue(stored.loadUint(32) === 1312);
      result.fields["Authorization algorithm"] = "ML-DSA-44";
      result.fields["Public key"] = keyChain(stored.loadRef(), 1312); stored.endParse();
      result.fields["Subwallet ID"] = s.loadUint(32).toString();
      s.loadMaybeRef(); s.loadMaybeRef();
      result.fields["Replay cleanup time"] = s.loadUintBig(64).toString();
      result.fields["Timeout seconds"] = s.loadUint(22).toString(); s.endParse();
    } else if (match.kind === "quantum-module") result.fields = quantumModule(cell);
    else if (match.kind === "quantum-wallet") {
      requireValue(s.loadUint(1) === 0);
      result.fields["Sequence number"] = s.loadUint(32).toString();
      result.fields["Wallet ID"] = s.loadUint(32).toString();
      requireValue(s.loadUintBig(256) === 0n && !s.loadBit());
      const auth = s.loadRef().beginParse(); s.endParse();
      requireValue(auth.loadUint(8) === 4 && auth.loadUint(2) === 2);
      result.fields["Retirement flags"] = auth.loadUint(16).toString();
      for (const name of ["Authority epoch", "Primary nonce", "Rescue nonce"]) result.fields[name] = auth.loadUintBig(64).toString();
      const witness = auth.loadRef(); const module = witness.beginParse();
      requireValue(module.remainingBits === 5 && module.loadUint(5) === 6);
      const moduleCode = module.loadRef();
      requireValue(moduleCode.hash().toString("hex") === registry.contracts.find((item) => item.kind === "quantum-module")?.hash);
      Object.assign(result.fields, quantumModule(module.loadRef())); module.endParse();
      result.fields["Module StateInit identity"] = witness.hash().toString("hex");
      const fee = auth.loadRef().beginParse(); auth.endParse();
      requireValue(fee.loadUint(8) === 1 && fee.loadUint(8) === 1);
      result.fields["Public fee tree ID"] = fee.loadBuffer(32).toString("hex");
      result.fields["Fee epoch start"] = fee.loadUint(32).toString();
      requireValue(fee.loadUint(32) === 3600 && fee.loadUint(16) === 4);
      const key = fee.loadRef().beginParse(); fee.endParse();
      requireValue(key.remainingBits === 480 && key.loadUint(32) === 1 && key.loadUint(32) === 8 && key.loadUint(32) === 3);
      key.loadBuffer(48); key.endParse();
      result.fields["Fee authorization"] = "Stateful HSS/LMS H20/W4";
      result.fields["Legacy signature authority"] = "Disabled; inert V5 field is zero";
    } else {
      requireValue(s.loadUint(8) === 3);
      const nextLeaf = s.loadUint(32); requireValue(nextLeaf <= 1048576);
      result.fields["Next fee leaf"] = nextLeaf.toString();
      result.fields["Fee configuration hash"] = s.loadBuffer(32).toString("hex");
      result.fields["Fee epoch start"] = s.loadUint(32).toString();
      const address = s.loadAddress(); requireValue(address.workChain === 0);
      result.fields["Module address"] = address.toRawString();
      result.fields["POP parties commitment"] = s.loadBuffer(32).toString("hex");
      const key = s.loadRef().beginParse();
      requireValue(key.remainingBits === 480 && key.loadUint(32) === 1 && key.loadUint(32) === 8 && key.loadUint(32) === 3);
      key.loadBuffer(48); key.endParse();
      result.fields["Fee authorization"] = "Stateful HSS/LMS H20/W4";
      result.fields["Intent prefix hash"] = s.loadRef().hash().toString("hex"); s.endParse();
    }
    result.status = "known";
  } catch (error) {
    result.status = "invalid"; result.fields = {};
    result.error = error instanceof Error ? error.message : "Invalid public cells";
  }
  return result;
}
