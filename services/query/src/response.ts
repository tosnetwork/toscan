export class ResponseLimitError extends Error {}

export async function boundedText(response: Response, limit: number): Promise<string> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 64 * 1024 * 1024) throw new ResponseLimitError("Invalid RPC response limit");
  const declared = Number(response.headers.get("content-length"));
  if (declared > limit) { await response.body?.cancel(); throw new ResponseLimitError("TOS RPC response exceeds its size limit"); }
  if (!response.body) return "";
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ResponseLimitError("TOS RPC response exceeds its size limit"); }
      chunks.push(part.value);
    }
    const all = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true }).decode(all);
  } finally { reader.releaseLock(); }
}
