import { describe, expect, it } from "vitest";
import { compact, formatTos, ratioPercent, statusTone } from "./format";

describe("format helpers", () => {
  it("formats base units without losing bigint precision", () => {
    expect(formatTos("2847350000000")).toBe("2,847.35");
    expect(ratioPercent("90071992547409930", "180143985094819860")).toBe(50);
  });

  it("keeps short identities intact and compacts long ones", () => {
    expect(compact("abc")).toBe("abc");
    expect(compact("0:1234567890abcdef", 4, 3)).toBe("0:12…def");
  });

  it("maps execution states to consistent semantic tones", () => {
    expect(statusTone("settled")).toBe("positive");
    expect(statusTone("result_submitted")).toBe("warning");
    expect(statusTone("disputed")).toBe("danger");
  });
});
