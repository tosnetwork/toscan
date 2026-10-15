import "./buffer";
import { CellBuffer as Buffer } from "./buffer";
import { Cell, Dictionary } from "@ton/core";

export const AUTH_POLICY_SPEC_HASH = "5e4380aedc95f8cb72de55f7506de0269b47c03ad1d1ed0e5184c332544262c0";

/** Bounded ordinary single-root state/config cells; never execute contract code. */
export function ordinaryCell(encoded: string): Cell {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 350_000 || encoded.length % 4 !== 0) throw new Error("Invalid bounded cell encoding");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 12 || bytes.readUInt32BE(0) !== 0xb5ee9c72) throw new Error("Unsupported BOC header");
  const width = bytes[4]! & 7;
  if (width < 1 || width > 4 || bytes.length < 6 + width * 3) throw new Error("Invalid BOC counters");
  const count = bytes.readUIntBE(6, width);
  if (count < 1 || count > 2048 || bytes.readUIntBE(6 + width, width) !== 1) throw new Error("Invalid BOC root/cell count");
  const roots = Cell.fromBoc(bytes);
  if (roots.length !== 1) throw new Error("Expected one BOC root");
  const root = roots[0]!;
  const visited = new Set<Cell>();
  function visit(cell: Cell, depth: number): void {
    if (depth > 128 || cell.isExotic || cell.level() !== 0) throw new Error("Unsupported cell graph");
    if (visited.has(cell)) return;
    visited.add(cell);
    if (visited.size > 2048) throw new Error("Cell graph exceeds budget");
    for (const child of cell.refs) visit(child, depth + 1);
  }
  visit(root, 0);
  return root;
}

export function decodeGlobalVersion(encoded: string): { version: number; capabilities: string } {
  const s = ordinaryCell(encoded).beginParse();
  if (s.remainingBits !== 104 || s.remainingRefs !== 0 || s.loadUint(8) !== 0xc4) throw new Error("Invalid ConfigParam 8");
  return { version: s.loadUint(32), capabilities: s.loadUintBig(64).toString() };
}

export interface AuthPolicy {
  networkTag: string;
  sequence: string;
  retired: number;
  primaryDeadline: number | null;
  specHash: string;
}

export function decodeAuthPolicy(encoded: string): AuthPolicy {
  const s = ordinaryCell(encoded).beginParse();
  if (s.remainingBits !== 601 || s.loadUint(8) !== 0xa1) throw new Error("Invalid AUTH policy layout");
  const networkTag = s.loadBuffer(32).toString("hex");
  const sequence = s.loadUintBig(64).toString();
  const retired = s.loadUint(16);
  if (retired & ~2) throw new Error("Unknown AUTH retirement flags");
  const deadlines = s.loadDict(Dictionary.Keys.Uint(8), Dictionary.Values.Uint(32));
  const specHash = s.loadBuffer(32).toString("hex");
  s.endParse();
  if (specHash !== AUTH_POLICY_SPEC_HASH || deadlines.size > 1 || [...deadlines].some(([suite, deadline]) => suite !== 1 || deadline === 0)) throw new Error("Unsupported AUTH policy profile");
  return { networkTag, sequence, retired, primaryDeadline: deadlines.get(1) ?? null, specHash };
}

export function decodeControllerPolicy(encoded: string): string[] {
  const s = ordinaryCell(encoded).beginParse();
  const codes = s.loadDict(Dictionary.Keys.BigUint(256), {
    serialize() {},
    parse(value) { value.endParse(); return true; },
  });
  s.endParse();
  if (codes.size > 8) throw new Error("Controller code policy exceeds protocol limit");
  return [...codes.keys()].map((hash) => hash.toString(16).padStart(64, "0"));
}

export const PQ_VM_SUITES = [
  { id: 1, name: "ML-DSA-44", role: "Consensus and daily authorization", minimumVersion: 16 },
  { id: 2, name: "Falcon-512 padded", role: "Candidate authorization verifier", minimumVersion: 19 },
  { id: 3, name: "SLH-DSA-SHA2-128s", role: "Rescue authorization verifier", minimumVersion: 16 },
  { id: 4, name: "HSS/LMS H20/W4", role: "Stateful fee verification", minimumVersion: 16 },
] as const;
