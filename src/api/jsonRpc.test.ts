import { describe, expect, it, vi } from "vitest";
import { JsonRpcClient, RpcError, TransportError } from "./jsonRpc";

describe("JsonRpcClient", () => {
  it("sends a standards-compliant request and returns result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { last: { seqno: 42 } },
    }), { status: 200 }));
    const client = new JsonRpcClient({ endpoint: "/jsonRPC", fetch: fetcher });

    await expect(client.call("getMasterchainInfo")).resolves.toEqual({ last: { seqno: 42 } });
    const init = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({ jsonrpc: "2.0", method: "getMasterchainInfo", params: {} });
  });

  it("preserves deterministic RPC errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32602, message: "Invalid address" },
    }), { status: 200 }));
    const client = new JsonRpcClient({ endpoint: "/jsonRPC", fetch: fetcher });
    await expect(client.call("getAddressInformation", { address: "bad" })).rejects.toBeInstanceOf(RpcError);
  });

  it("classifies invalid upstream bodies as transport failures", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("not-json", { status: 502 }));
    const client = new JsonRpcClient({ endpoint: "/jsonRPC", fetch: fetcher });
    await expect(client.call("getMasterchainInfo")).rejects.toBeInstanceOf(TransportError);
  });

  it("uses a method-whitelisted REST gateway without exposing JSON-RPC write dispatch", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      jsonrpc: "2.0",
      id: null,
      result: { consensus_block: 99 },
    }), { status: 200 }));
    const client = new JsonRpcClient({ endpoint: "/tos-rpc", transport: "rest", fetch: fetcher });

    await expect(client.call("getConsensusBlock", { seqno: 1 })).resolves.toEqual({ consensus_block: 99 });
    expect(fetcher).toHaveBeenCalledWith("/tos-rpc/getConsensusBlock", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ seqno: 1 }),
    }));
  });

  it("normalizes the node REST error envelope", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: "Invalid address",
      code: -32602,
    }), { status: 422 }));
    const client = new JsonRpcClient({ endpoint: "/tos-rpc", transport: "rest", fetch: fetcher });
    await expect(client.call("getAddressInformation", { address: "bad" })).rejects.toMatchObject({
      name: "RpcError",
      code: -32602,
    });
  });
});

describe("bounded PQ RPC transport", () => {
  it.each(["rest", "json-rpc"] as const)("preserves structured %s errors for retry decisions", async (transport) => {
    const errorInfo = { schema_version: 1, reason: "RESOURCE_LIMIT", retryable: true };
    const payload = transport === "rest" ? { error: "Busy", code: -32001, error_info: errorInfo } : { error: { code: -32001, message: "Busy" }, error_info: errorInfo };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status: 429 }));
    await expect(new JsonRpcClient({ endpoint: "/rpc", transport, fetch: fetcher }).call("getConfigParam"))
      .rejects.toMatchObject({ code: -32001, errorInfo });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("refuses an oversized content-length before reading the body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { "content-length": "1024" } }));
    await expect(new JsonRpcClient({ endpoint: "/rpc", fetch: fetcher }).call("test", {}, { maxResponseBytes: 32 })).rejects.toThrow("size limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("counts streamed bytes even without a length header and cancels overflow", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(33)); }, cancel });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    await expect(new JsonRpcClient({ endpoint: "/rpc", fetch: fetcher }).call("test", {}, { maxResponseBytes: 32 })).rejects.toThrow("size limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
