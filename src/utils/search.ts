export type SearchTarget =
  | { name: "address"; params: { address: string } }
  | { name: "block"; params: { workchain: string; shard: string; seqno: string } }
  | { name: "blocks"; query: { seqno: string } }
  | { name: "search"; query: { q: string } };

const RAW_ADDRESS = /^-?\d+:[0-9a-fA-F]{64}$/;
const FRIENDLY_ADDRESS = /^[A-Za-z0-9_-]{46,52}$/;
const BLOCK_ID = /^(-?\d+):(-?\d+):(\d+)$/;

export function resolveSearch(input: string): SearchTarget {
  const query = input.trim();
  const block = query.match(BLOCK_ID);
  if (block?.[1] && block[2] && block[3]) {
    return { name: "block", params: { workchain: block[1], shard: block[2], seqno: block[3] } };
  }
  if (RAW_ADDRESS.test(query) || FRIENDLY_ADDRESS.test(query)) {
    return { name: "address", params: { address: query } };
  }
  if (/^\d+$/.test(query)) return { name: "blocks", query: { seqno: query } };
  return { name: "search", query: { q: query } };
}
