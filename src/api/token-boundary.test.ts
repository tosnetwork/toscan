import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./jsonRpc", async (original) => ({ ...await original<typeof import("./jsonRpc")>(), JsonRpcClient: class { call = call; } }));
import { getAccount, getToken } from "./explorer";
import { runtime } from "@/stores/runtime";

describe("browser node token boundary", () => {
  beforeEach(() => { runtime.useLive(); });
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes new metadata for the existing token view", async () => {
    call.mockResolvedValue({ "@type": "ext.tokens.tokenMasterData", mintable: true, admin_address: "0:admin", token_content: "content-boc", token_wallet_code: "wallet-boc", total_supply: "100", token_name: "Credit", token_decimals: "6" });
    await expect(getToken("0:master")).resolves.toMatchObject({ "@type": "ext.tokens.jettonMasterData", jetton_name: "Credit", jetton_decimals: "6" });
    expect(call).toHaveBeenCalledWith("getTokenData", { address: "0:master" });
  });

  it("reads new positions and rejects the old shape through the account fallback", async () => {
    let result: unknown = { tokens: [{ token_master: "0:master", token_wallet: "0:wallet", last_lt: "10" }] };
    call.mockImplementation(async (method: string) => {
      if (method === "getAccountTokens") {
        if (result instanceof Error) throw result;
        return result;
      }
      if (method === "getAddressInformation") return { balance: "0" };
      throw new Error("optional data unavailable");
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    await expect(getAccount("0:owner")).resolves.toMatchObject({ jettons: [{ jetton_master: "0:master", jetton_wallet: "0:wallet", last_lt: "10" }] });
    result = { jettons: [] };
    await expect(getAccount("0:owner")).rejects.toThrow("tokens is required");
    result = new Error("Token index unavailable");
    await expect(getAccount("0:owner")).resolves.toMatchObject({ jettons: [] });
  });
});
