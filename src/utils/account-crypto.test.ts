import { describe, it, expect } from "vitest";
import { beginCell, Cell } from "@ton/core";
import { CellBuffer as Buffer } from "./buffer";
import { inspectAccountCryptography } from "./account-crypto";
import code from "./pq-code-fixtures.json";
const boc = (cell: ReturnType<typeof beginCell>) => cell.endCell().toBoc().toString("base64");
function chain(size: number): ReturnType<ReturnType<typeof beginCell>["endCell"]> {
  if (size > 127) return beginCell().storeBuffer(Buffer.alloc(127, 7)).storeRef(chain(size - 127)).endCell();
  return beginCell().storeBuffer(Buffer.alloc(size, 7)).endCell();
}
describe("public PQ account evidence", () => {
  it("recognizes independently compiled ML-DSA and Falcon code and exact public key chains", () => {
    const mldsa = inspectAccountCryptography(code["mldsa-module-func"], boc(beginCell().storeInt(-3, 32).storeRef(chain(1312))));
    expect(mldsa.status).toBe("known"); expect(mldsa.fields["Authorization algorithm"]).toBe("ML-DSA-44");
    expect(mldsa.fields["Public key"]).toHaveLength(2624);
    const falcon = inspectAccountCryptography(code["module-func"], boc(beginCell().storeInt(1, 32).storeUint(1, 16).storeRef(chain(897))));
    expect(falcon.fields["Authorization algorithm"]).toBe("Falcon-512 padded");
  });
  it("reads the highload bounded key container and exact uint64 replay state", () => {
    const stored = beginCell().storeUint(1312, 32).storeRef(chain(1312)).endCell();
    const data = boc(beginCell().storeRef(stored).storeUint(42, 32).storeBit(false).storeBit(false).storeUint(0xffffffffffffffffn, 64).storeUint(3600, 22));
    const result = inspectAccountCryptography(code["pq-highload"], data);
    expect(result.status).toBe("known");
    expect(result.fields["Replay cleanup time"]).toBe("18446744073709551615");
  });
  it("rejects wrong key lengths and refuses to classify unknown code by storage shape", () => {
    const short = boc(beginCell().storeInt(1, 32).storeRef(chain(1311)));
    expect(inspectAccountCryptography(code["mldsa-module-func"], short).status).toBe("invalid");
    const wrong = boc(beginCell().storeUint(99, 8));
    expect(inspectAccountCryptography(wrong, short).status).toBe("unknown");
    expect(inspectAccountCryptography(code["module-func"], boc(beginCell().storeInt(1, 32).storeUint(2, 16).storeRef(chain(897)))).status).toBe("invalid");
  });
});

describe("SDK-built complete Quantum candidate public state", () => {
  it("separates daily, rescue and fee authority without treating the inert V5 field as an Ed25519 key", async () => {
    const state = await import("./quantum-state-fixture.json");
    const wallet = inspectAccountCryptography(code["quantum-wallet"], state.wallet);
    expect(wallet.status).toBe("known");
    expect(wallet.fields).toMatchObject({ "Daily authorization": "ML-DSA-44", "Rescue authorization": "SLH-DSA-SHA2-128s", "Fee authorization": "Stateful HSS/LMS H20/W4", "Legacy signature authority": "Disabled; inert V5 field is zero", "Primary nonce": "0" });
    const source = Cell.fromBase64(state.wallet).beginParse();
    source.loadBit(); const seqno = source.loadUint(32); const walletId = source.loadUint(32); source.loadUintBig(256);
    const activeLegacyKey = boc(beginCell().storeBit(false).storeUint(seqno, 32).storeUint(walletId, 32).storeUint(1, 256).storeSlice(source));
    expect(inspectAccountCryptography(code["quantum-wallet"], activeLegacyKey).status).toBe("invalid");
    const vault = inspectAccountCryptography(code["quantum-vault"], state.vault);
    expect(vault.status).toBe("known"); expect(vault.fields["Next fee leaf"]).toBe("0");
  });
});
