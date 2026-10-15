import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import fixture from "@/api/fixtures/pq-native.json";
const { signatures, account, downloadJson } = vi.hoisted(() => ({ signatures: vi.fn(), account: vi.fn(), downloadJson: vi.fn() }));
vi.mock("@/api/explorer", () => ({ pqExplorer: { signatures, account } }));
vi.mock("@/utils/download", () => ({ downloadJson }));
import BlockFinality from "./BlockFinality.vue";
import AccountCryptography from "./AccountCryptography.vue";
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe("PQ evidence presentation", () => {
  it("loads metadata once, fetches proofs on demand and reuses an identical observation", async () => {
    signatures.mockResolvedValue(fixture.signature);
    const wrapper = mount(BlockFinality, { props: { block: fixture.signature.id } }); await flushPromises();
    expect(wrapper.text()).toContain("Node verified · anchored finality");
    expect(wrapper.text()).toContain(fixture.signature.signatures[0]!.validator_id);
    expect(signatures).toHaveBeenCalledTimes(1);
    expect(signatures).toHaveBeenLastCalledWith(fixture.signature.id);
    const button = wrapper.findAll("button").find((b) => b.text() === "Download finality proof")!;
    await button.trigger("click"); await flushPromises();
    expect(signatures).toHaveBeenLastCalledWith(fixture.signature.id, true);
    expect(downloadJson).toHaveBeenCalledTimes(1);
    await button.trigger("click"); await flushPromises();
    expect(signatures).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
  it("exposes native Quantum roles and never falls back to local decoding on failure", async () => {
    const auth = fixture.accounts.find((a) => a.code_family === "quantum_wallet_v4")!;
    account.mockResolvedValue(auth);
    const wrapper = mount(AccountCryptography, { props: { address: "0:" + "00".repeat(32) } }); await flushPromises();
    expect(wrapper.text()).toContain("Quantum Wallet · Code hash matched");
    expect(wrapper.text()).toContain("ML-DSA-44");
    expect(wrapper.text()).toContain("SLH-DSA-SHA2-128s");
    expect(wrapper.text()).toContain("Disabled; inert V5 field is zero");
    account.mockRejectedValue(new Error("Invalid authenticated account proof"));
    await wrapper.setProps({ address: "0:" + "11".repeat(32) }); await flushPromises();
    expect(wrapper.text()).toContain("Invalid authenticated account proof");
    expect(wrapper.text()).not.toContain("Code hash matched");
    wrapper.unmount();
  });
  it("does not automatically retry PQ failures", async () => {
    vi.useFakeTimers(); signatures.mockRejectedValue(new Error("Busy"));
    const wrapper = mount(BlockFinality, { props: { block: fixture.signature.id } }); await flushPromises();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(signatures).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain("Node verified");
    wrapper.unmount();
  });
  it("discards proof exports after navigation", async () => {
    let resolve!: (value: unknown) => void;
    signatures.mockResolvedValueOnce(fixture.signature).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const wrapper = mount(BlockFinality, { props: { block: fixture.signature.id } }); await flushPromises();
    await wrapper.findAll("button").find((b) => b.text() === "Download finality proof")!.trigger("click");
    wrapper.unmount(); resolve(fixture.signature); await flushPromises();
    expect(downloadJson).not.toHaveBeenCalled();
  });
});
