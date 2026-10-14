import { afterEach, describe, expect, it, vi } from "vitest";
import { TosRpc } from "./rpc.js";

const account = "ab".repeat(32);

function response(result: unknown): Response {
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("PostgreSQL projector RPC", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the account cursor and ignores shard zerostates", async () => {
    const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const method = new URL(String(input)).pathname.slice(1);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ method, body });
      if (method === "shards") {
        return response({
          shards: [{ workchain: 0, shard: "9223372036854775808", seqno: 0, root_hash: "zero", file_hash: "zero" }],
        });
      }
      if (method === "getBlockHeader") return response({ gen_utime: 1_700_000_001 });
      if (method === "getBlockTransactionsExt") {
        if (body.after_lt) {
          return response({
            incomplete: false,
            transactions: [{ account, lt: "11", hash: "tx-2", utime: 1_700_000_001, fee: "2", in_msg_hash: "msg-2",
              transaction_type: "ordinary", aborted: false, compute: { skipped: false, success: true, exit_code: 0 },
              action: { success: true }, in_msg: { hash: "msg-2", kind: "internal" }, out_msgs: [] }],
          });
        }
        return response({
          id: { workchain: -1, shard: "-9223372036854775808", seqno: 1, root_hash: "root", file_hash: "file" },
          incomplete: true,
          transactions: [{ account, lt: "10", hash: "tx-1", utime: 1_700_000_001, fee: "1", in_msg_hash: "msg-1" }],
        });
      }
      throw new Error(`unexpected method ${method}`);
    }));

    const rpc = new TosRpc({ baseUrl: "http://node" });
    const bundle = await rpc.masterchainBundle("-9223372036854775808", 1);

    expect(bundle.blocks).toHaveLength(1);
    expect(bundle.blocks[0]?.transactions).toHaveLength(2);
    expect(bundle.blocks[0]?.transactions[0]?.account).toBe(`-1:${account}`);
    expect(bundle.blocks[0]?.transactions[1]?.details).toMatchObject({
      transaction_type: "ordinary", aborted: false, compute: { success: true, exit_code: 0 },
      in_msg: { hash: "msg-2" },
    });
    const secondPage = calls.find((call) => call.method === "getBlockTransactionsExt" && call.body.after_lt);
    expect(secondPage?.body).toMatchObject({ after_lt: "10", after_account: account });
    expect(calls.filter((call) => call.method === "getBlockHeader")).toHaveLength(0);
  });

  it("reads node-verified asset positions and metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const method = new URL(String(input)).pathname.slice(1);
      if (method === "getAccountJettons") return response({ jettons: [{ jetton_master: "0:master", jetton_wallet: "0:wallet", last_lt: "10" }] });
      if (method === "getAccountNfts") return response({ nfts: [{ nft_item: "0:item", collection: null, last_lt: "11" }] });
      if (method === "getTokenData") return response({ "@type": "ext.tokens.jettonMasterData", total_supply: "100" });
      throw new Error(`unexpected method ${method}`);
    }));
    const rpc = new TosRpc({ baseUrl: "http://node" });
    await expect(rpc.accountJettons("0:owner")).resolves.toHaveLength(1);
    await expect(rpc.accountNfts("0:owner")).resolves.toHaveLength(1);
    await expect(rpc.tokenData("0:master")).resolves.toMatchObject({ "@type": "ext.tokens.jettonMasterData" });
  });
});

describe("RPC backpressure", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("spaces concurrent requests and retries HTTP 429 within a bounded budget", async () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const fetcher = vi.fn(async () => { times.push(Date.now()); return response({}); });
    vi.stubGlobal("fetch", fetcher);
    const rpc = new TosRpc({ baseUrl: "http://node", requestsPerSecond: 40 });
    const pending = Promise.all([rpc.call("a"), rpc.call("b"), rpc.call("c")]);
    await vi.runAllTimersAsync(); await pending;
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(25);
    expect(times[2]! - times[1]!).toBeGreaterThanOrEqual(25);
    fetcher.mockImplementation(async () => new Response("Too many requests", { status: 429 }));
    const failure = rpc.call("limited").catch((error: Error) => error.message);
    await vi.runAllTimersAsync(); expect(await failure).toContain("(429)");
    expect(fetcher).toHaveBeenCalledTimes(7);
    fetcher.mockImplementation(async () => new Response(JSON.stringify({ error: "node unavailable" }), { status: 503 }));
    const noRetry = rpc.call("unavailable").catch((error: Error) => error.message);
    await vi.runAllTimersAsync(); expect(await noRetry).toContain("(503)");
    expect(fetcher).toHaveBeenCalledTimes(8);
  });
});
