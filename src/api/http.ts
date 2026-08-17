import { TransportError } from "./jsonRpc";

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof globalThis.fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(path.replace(/^\//, ""), new URL(base, globalThis.location?.origin ?? "http://localhost"));
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
    try {
      const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as T & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
      return payload;
    } catch (error) {
      if (error instanceof TransportError) throw error;
      throw new TransportError(error instanceof Error ? error.message : "TOS service API is unavailable", error);
    }
  }
}
