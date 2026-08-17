import { describe, expect, it } from "vitest";
import type { ValidatorSetConfig } from "@/api/types";
import {
  filterAndSortValidators,
  formatRemaining,
  validatorRoundProgress,
  validatorRouteKey,
  validatorRows,
} from "./validators";

const set: ValidatorSetConfig = {
  utime_since: 100,
  utime_until: 200,
  total: 3,
  main: 2,
  total_weight: "100000000000000000000",
  validators: [
    { public_key: "charlie", adnl_address: "adnl-c", weight: "10000000000000000000", cumulative_weight: "10" },
    { public_key: "alpha", adnl_address: "adnl-a", weight: "80000000000000000000", cumulative_weight: "90" },
    { public_key: "bravo", adnl_address: "adnl-b", weight: "10000000000000000000", cumulative_weight: "100" },
  ],
};

describe("validator list helpers", () => {
  it("retains canonical rank and masterchain membership while sorting bigint weights", () => {
    const rows = filterAndSortValidators(validatorRows(set), "", "weight-desc");
    expect(rows.map((row) => row.public_key)).toEqual(["alpha", "charlie", "bravo"]);
    expect(rows.find((row) => row.public_key === "alpha")).toMatchObject({ rank: 2, masterchain: true });
    expect(rows.find((row) => row.public_key === "bravo")).toMatchObject({ rank: 3, masterchain: false });
  });

  it("filters by public key or ADNL identity and supports deterministic identity sorting", () => {
    expect(filterAndSortValidators(validatorRows(set), "ADNL-B", "weight-desc").map((row) => row.public_key)).toEqual(["bravo"]);
    expect(filterAndSortValidators(validatorRows(set), "", "identity-asc").map((row) => row.public_key)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("clamps round progress and presents bounded remaining time", () => {
    expect(validatorRoundProgress(100, 200, 50)).toBe(0);
    expect(validatorRoundProgress(100, 200, 150)).toBe(50);
    expect(validatorRoundProgress(100, 200, 250)).toBe(100);
    expect(formatRemaining(93_900)).toBe("1d 2h");
    expect(formatRemaining(5_460)).toBe("1h 31m");
  });

  it("makes standard Base64 validator identities safe for URL path segments", () => {
    expect(validatorRouteKey("slxHCXmjaQXlf7idYv/PTPDRDdjGcDJ7Tl/doiGHRbk=")).toBe(
      "slxHCXmjaQXlf7idYv_PTPDRDdjGcDJ7Tl_doiGHRbk",
    );
    expect(validatorRouteKey("preview-validator-1")).toBe("preview-validator-1");
  });
});
