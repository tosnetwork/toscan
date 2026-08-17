import { describe, expect, it } from "vitest";
import { createCsv } from "./csv";

describe("CSV export", () => {
  it("preserves spreadsheet text and safely quotes commas, quotes and newlines", () => {
    expect(createCsv(["Name", "Value"], [["pool, one", 'say "hello"'], ["line\nbreak", null]]))
      .toBe('\uFEFFName,Value\r\n"pool, one","say ""hello"""\r\n"line\nbreak",\r\n');
  });
});
