import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { decodeNodeTokenData, decodeNodeTokenPositions } from "./nodeTokens.js";
import { Projector } from "./projector.js";
import { ProjectionDb } from "./db.js";
import { Metrics } from "./metrics.js";
import { TosRpc } from "./rpc.js";

const master = {
  "@type": "ext.tokens.tokenMasterData", total_supply: "100", mintable: true, admin_address: "0:admin",
  token_content: "content-boc", token_wallet_code: "wallet-boc", token_name: "Credit", token_symbol: "CR",
  token_decimals: "6", token_metadata_uri: "https://example.invalid/credit.json", token_image: "https://example.invalid/credit.png",
};
const positions = { tokens: [{ token_master: "0:master", token_wallet: "0:wallet", last_lt: "10" }] };

describe("node token boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes the new node shape into stable explorer positions and metadata", () => {
    expect(decodeNodeTokenPositions(positions)).toEqual([{ jetton_master: "0:master", jetton_wallet: "0:wallet", last_lt: "10" }]);
    expect(decodeNodeTokenPositions({ tokens: [] })).toEqual([]);
    const data = decodeNodeTokenData(master);
    expect(data).toMatchObject({ "@type": "ext.tokens.jettonMasterData", jetton_name: "Credit", jetton_symbol: "CR", jetton_decimals: "6", jetton_metadata_uri: master.token_metadata_uri, jetton_image: master.token_image, jetton_content: "content-boc", jetton_wallet_code: "wallet-boc" });
    expect(data).not.toHaveProperty("token_name");
  });

  it("refuses old or malformed node data instead of reporting empty holdings", () => {
    for (const data of [{ jettons: [] }, { tokens: [{ jetton_master: "0:master", jetton_wallet: "0:wallet", last_lt: "10" }] }, { tokens: null }]) {
      expect(() => decodeNodeTokenPositions(data)).toThrow();
    }
    expect(() => decodeNodeTokenData({ "@type": "ext.tokens.jettonMasterData" })).toThrow("discriminator");
    expect(() => decodeNodeTokenData({ ...master, token_decimals: 6 })).toThrow("token_decimals");
  });

  it("preserves the unchanged NFT data shapes", () => {
    const nft = { "@type": "ext.tokens.nftItemData", index: "1", owner_address: "0:owner" };
    expect(decodeNodeTokenData(nft)).toEqual(nft);
  });

  it("projects real adapter results into the unchanged asset kind and stored payload", async () => {
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const method = new URL(String(input)).pathname.slice(1);
      methods.push(method);
      const result = method === "getAccountTokens" ? positions : method === "getAccountNfts" ? { nfts: [] } : master;
      return new Response(JSON.stringify({ result }), { headers: { "content-type": "application/json" } });
    }));
    const replaceAssetSnapshot = vi.fn();
    const db = { pendingAssetAccounts: async () => ["0:owner"], replaceAssetSnapshot } as unknown as ProjectionDb;
    const rpc = new TosRpc({ baseUrl: "http://offline-node" });
    const projector = new Projector(db, rpc, new Metrics(), { sourceUrl: "http://offline-source", pollMs: 1000, batchSize: 16, contractSyncMs: 1000 });
    await (projector as unknown as { syncAssets(): Promise<void> }).syncAssets();
    expect(methods).toContain("getAccountTokens");
    expect(methods).not.toContain("getAccountJettons");
    expect(replaceAssetSnapshot).toHaveBeenCalledWith("0:owner", decodeNodeTokenPositions(positions), [], expect.arrayContaining([
      expect.objectContaining({ address: "0:master", kind: "jetton", data: expect.objectContaining({ jetton_name: "Credit", jetton_decimals: "6" }) }),
    ]));
  });

  it("does not overwrite stored holdings when a node returns the superseded list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const method = new URL(String(input)).pathname.slice(1);
      const result = method === "getAccountTokens" ? { jettons: [] } : method === "getAccountNfts" ? { nfts: [] } : master;
      return new Response(JSON.stringify({ result }));
    }));
    const replaceAssetSnapshot = vi.fn();
    const db = { pendingAssetAccounts: async () => ["0:owner"], replaceAssetSnapshot } as unknown as ProjectionDb;
    const projector = new Projector(db, new TosRpc({ baseUrl: "http://offline-node" }), new Metrics(), { sourceUrl: "http://offline-source", pollMs: 1000, batchSize: 16, contractSyncMs: 1000 });
    await expect((projector as unknown as { syncAssets(): Promise<void> }).syncAssets()).rejects.toThrow("tokens is required");
    expect(replaceAssetSnapshot).not.toHaveBeenCalled();
  });

  it("does not replace cached metadata with an empty payload on a superseded master response", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const method = new URL(String(input)).pathname.slice(1);
      const result = method === "getAccountTokens" ? positions : method === "getAccountNfts" ? { nfts: [] } : { ...master, "@type": "ext.tokens.jettonMasterData" };
      return new Response(JSON.stringify({ result }));
    }));
    const replaceAssetSnapshot = vi.fn();
    const db = { pendingAssetAccounts: async () => ["0:owner"], replaceAssetSnapshot } as unknown as ProjectionDb;
    const projector = new Projector(db, new TosRpc({ baseUrl: "http://offline-node" }), new Metrics(), { sourceUrl: "http://offline-source", pollMs: 1000, batchSize: 16, contractSyncMs: 1000 });
    await expect((projector as unknown as { syncAssets(): Promise<void> }).syncAssets()).rejects.toThrow("discriminator");
    expect(replaceAssetSnapshot).not.toHaveBeenCalled();
  });

  it("allows the replacement RPC through the production proxy", () => {
    const config = readFileSync("deploy/default.conf.template", "utf8");
    expect(config).toContain("|getAccountTokens|");
    expect(config).not.toContain("getAccountJettons");
  });
});
