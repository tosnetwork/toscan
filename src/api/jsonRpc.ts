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
      const response = await this.fetcher(this.options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++this.requestId, method, params }),
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: RpcSuccess<T> | RpcFailure;
      try {
        payload = JSON.parse(text) as RpcSuccess<T> | RpcFailure;
      } catch (error) {
        throw new TransportError(`TOS RPC returned an invalid response (${response.status})`, error);
      }
      if ("error" in payload) {
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
