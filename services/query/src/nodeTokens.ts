export class NodeTokenResponseError extends Error {}

// Keep the explorer's stored payloads and API kinds stable at the node boundary.
export interface ExplorerTokenPosition {
  jetton_master: string;
  jetton_wallet: string;
  last_lt: string;
}

export interface ExplorerTokenMaster {
  [key: string]: unknown;
  "@type": "ext.tokens.jettonMasterData";
  total_supply: string;
  mintable: boolean;
  admin_address: string;
  jetton_content: string;
  jetton_wallet_code: string;
  jetton_name?: string;
  jetton_symbol?: string;
  jetton_decimals?: string;
  jetton_image?: string;
  jetton_description?: string;
  jetton_metadata_uri?: string;
}

export interface ExplorerNftItem {
  [key: string]: unknown;
  "@type": "ext.tokens.nftItemData";
  init: boolean;
  index: number;
  collection_address: string;
  owner_address: string;
  individual_content: string;
}

export interface ExplorerNftCollection {
  [key: string]: unknown;
  "@type": "ext.tokens.nftCollectionData";
  next_item_index: number;
  collection_content: string;
  owner_address: string;
}

export type ExplorerTokenData = ExplorerTokenMaster | ExplorerNftItem | ExplorerNftCollection;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new NodeTokenResponseError("Invalid node token response");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value) throw new NodeTokenResponseError("Invalid node token field");
  return value;
}

export function decodeNodeTokenPositions(value: unknown): ExplorerTokenPosition[] {
  const data = object(value);
  if (!Array.isArray(data.tokens)) throw new NodeTokenResponseError("Invalid node token list: tokens is required");
  return data.tokens.map((item: unknown) => {
    const entry = object(item);
    return { jetton_master: text(entry.token_master), jetton_wallet: text(entry.token_wallet), last_lt: text(entry.last_lt) };
  });
}

const metadataFields = ["content", "wallet_code", "name", "symbol", "decimals", "image", "description", "metadata_uri"] as const;

export function decodeNodeTokenData(value: unknown): ExplorerTokenData {
  const data = object(value);
  if (data["@type"] === "ext.tokens.nftItemData" || data["@type"] === "ext.tokens.nftCollectionData") return data as ExplorerNftItem | ExplorerNftCollection;
  if (data["@type"] !== "ext.tokens.tokenMasterData") throw new NodeTokenResponseError("Invalid node token data discriminator");
  if (typeof data.mintable !== "boolean" || typeof data.admin_address !== "string") throw new NodeTokenResponseError("Invalid node token master fields");
  const normalized: ExplorerTokenMaster = {
    ...data, "@type": "ext.tokens.jettonMasterData", total_supply: text(data.total_supply),
    mintable: data.mintable, admin_address: data.admin_address,
    jetton_content: text(data.token_content), jetton_wallet_code: text(data.token_wallet_code),
  };
  for (const field of metadataFields) {
    const key = `token_${field}`;
    if (data[key] !== undefined) {
      if (typeof data[key] !== "string") throw new NodeTokenResponseError(`Invalid node token field: ${key}`);
      normalized[`jetton_${field}`] = data[key];
    }
    delete normalized[key];
  }
  return normalized;
}
