interface RpcSuccess<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface RpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

interface RestFailure {
  jsonrpc?: "2.0";
  id?: number | null;
  ok?: false;
  error: string;
  code: number;
}

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export class TransportError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "TransportError";
  }
}

export interface JsonRpcClientOptions {
  endpoint: string;
  transport?: "json-rpc" | "rest";
  timeout?: number;
  fetch?: typeof globalThis.fetch;
}

export class JsonRpcClient {
  private requestId = 0;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: JsonRpcClientOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeout ?? 12_000);

    try {
      const rest = this.options.transport === "rest";
      const response = await this.fetcher(rest
        ? `${this.options.endpoint.replace(/\/$/, "")}/${encodeURIComponent(method)}`
        : this.options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest ? params : { jsonrpc: "2.0", id: ++this.requestId, method, params }),
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: RpcSuccess<T> | RpcFailure | RestFailure;
      try {
        payload = JSON.parse(text) as RpcSuccess<T> | RpcFailure | RestFailure;
      } catch (error) {
        throw new TransportError(`TOS RPC returned an invalid response (${response.status})`, error);
      }
      if ("error" in payload) {
        if (typeof payload.error === "string") {
          throw new RpcError(payload.error, "code" in payload ? payload.code : -32603);
        }
        throw new RpcError(payload.error.message, payload.error.code, payload.error.data);
      }
      if (!response.ok) {
        throw new TransportError(`TOS RPC request failed (${response.status})`);
      }
      return payload.result;
    } catch (error) {
      if (error instanceof RpcError || error instanceof TransportError) throw error;
      const message = error instanceof DOMException && error.name === "AbortError"
        ? `TOS RPC timed out after ${this.options.timeout ?? 12_000}ms`
        : "TOS RPC is unavailable";
      throw new TransportError(message, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
