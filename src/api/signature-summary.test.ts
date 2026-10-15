import { describe, expect, it, vi } from "vitest";
const { get, call } = vi.hoisted(() => ({ get: vi.fn(), call: vi.fn() }));
vi.mock("./http", () => ({ HttpClient: class { get = get; } }));
vi.mock("./jsonRpc", async (original) => ({ ...await original<typeof import("./jsonRpc")>(), JsonRpcClient: class { call = call; } }));
import { getObservedSignatureCount } from "./explorer";
describe("lightweight signer polling", () => {
  it("uses the indexed count instead of repeatedly downloading native signatures", async () => {
    get.mockResolvedValue({ result: { signature_count: 3, observed_mc_seqno: 9, signatures_available: true } });
    expect(await getObservedSignatureCount()).toMatchObject({ signature_count: 3, observed_mc_seqno: 9 });
    expect(get).toHaveBeenCalledWith("/explorer/validators/signature-summary");
    expect(call).not.toHaveBeenCalled();
  });
  it("keeps unavailable evidence distinct from a zero-signature success", async () => {
    get.mockResolvedValue({ result: { signature_count: null, observed_mc_seqno: 9, signatures_available: false } });
    expect((await getObservedSignatureCount()).signature_count).toBeNull();
    get.mockResolvedValue({ result: { signature_count: 401, observed_mc_seqno: 9, signatures_available: true } });
    await expect(getObservedSignatureCount()).rejects.toThrow("Invalid indexed signature count");
  });
});
