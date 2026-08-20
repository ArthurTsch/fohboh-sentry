import { describe, expect, it } from "vitest";
import {
  formatCurrencyFromCents,
  formatOverviewDecimal,
  truncateDecimal,
} from "@/lib/admin/overview-format";

describe("Super Admin overview formatting", () => {
  it("truncates summary decimals instead of rounding them upward", () => {
    expect(truncateDecimal(67.229, 2)).toBe(67.22);
    expect(formatOverviewDecimal(99.999, 2)).toBe("99.99");
  });

  it("renders persisted cents exactly without compact rounding", () => {
    expect(formatCurrencyFromCents(437996)).toBe("$4,379.96");
    expect(formatCurrencyFromCents(BigInt(17))).toBe("$0.17");
  });
});
