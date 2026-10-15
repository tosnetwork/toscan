import "../utils/buffer";
import { Address } from "@ton/core";
import { JsonRpcClient } from "./jsonRpc";
import type { BlockId, MasterchainInfo } from "./types";
import { bytes, decodedConfig, masterBlock, object, pqSignatures, publicAuthorization, sameBlock } from "./pq";
import type { DecodedConfig, PqSignatures, PublicAuthorization } from "./pq";

export class UnsupportedPqRpcError extends Error {
  constructor() { super("This node does not expose the versioned PQ explorer interface"); this.name = "UnsupportedPqRpcError"; }
}
export class PqExplorer {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  constructor(private readonly rpc: JsonRpcClient) {}
  private async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    if (this.active >= 2) {
      if (this.waiting.length >= 8) throw new Error("PQ request capacity reached; try again after current reads finish");
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else this.active++;
    try { return await this.rpc.call<T>(method, params); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
  async observation(): Promise<BlockId> {
    return masterBlock((await this.rpc.call<MasterchainInfo>("getMasterchainInfo")).last);
  }
  async account(address: string, block?: BlockId, withProof = false): Promise<PublicAuthorization> {
    const rawAddress = Address.parse(address).toRawString();
    const observed = masterBlock(block ?? await this.observation());
    const result = await this.request<{ address?: unknown; pq_authorization?: unknown }>("getAccountCapability", {
      address: rawAddress, block_id: observed, include_pq: true, with_proof: withProof,
    });
    if (!result.pq_authorization) throw new UnsupportedPqRpcError();
    if (result.address !== rawAddress) throw new Error("Account evidence address mismatch");
    const auth = publicAuthorization(result.pq_authorization, observed);
    if (auth.observed_shard_block.workchain !== Address.parse(rawAddress).workChain) throw new Error("Account evidence workchain mismatch");
    if (withProof && !auth.proof) throw new Error("Missing requested account proof");
    return auth;
  }
  async config(param: 8 | 43 | 47 | 48, block: BlockId): Promise<DecodedConfig> {
    block = masterBlock(block);
    const result = await this.request<{ block_id?: unknown; decoded?: unknown }>("getConfigParam", {
      param, block_id: block, include_decoded: true, with_proof: false,
    });
    if (!result.decoded) throw new UnsupportedPqRpcError();
    sameBlock(result.block_id, block);
    return decodedConfig(result.decoded, param, block);
  }
  async signatures(block: BlockId, withProof = false): Promise<PqSignatures | null> {
    block = masterBlock(block);
    if (block.seqno === 0) return null;
    const result = await this.request<unknown>("getMasterchainBlockSignatures", { block_id: block, with_proof: withProof });
    const v = object(result);
    if (v["@type"] !== "blocks.blockSignatures.simplexPq") {
      if (!["blocks.blockSignatures", "blocks.blockSignatures.simplex"].includes(String(v["@type"]))) throw new UnsupportedPqRpcError();
      sameBlock(v.id, block);
      return null;
    }
    return pqSignatures(v, block, withProof);
  }
  /** Explicit one-query proof transport. No automatic proof traversal or background downloads. */
  async proof(query: string): Promise<{ reply: string }> {
    if (!bytes(query, 16 * 1024)) throw new Error("Proof query exceeds the native request limit");
    const result = object(await this.rpc.call("getProofQuery", { query }, { maxResponseBytes: 64 * 1024 * 1024 }));
    if (!bytes(result.reply, 64 * 1024 * 1024)) throw new Error("Invalid proof relay response");
    return { reply: result.reply };
  }
}