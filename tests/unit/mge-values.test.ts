import { describe, expect, it } from "vitest";
import {
  clamp,
  numberValue,
  parseDateValue,
  roundCurrency,
  textValue,
} from "@/lib/mge/values";

describe("deterministic engine value helpers", () => {
  it("preserves currency rounding and numeric normalization", () => {
    expect(roundCurrency(10.126)).toBe(10.13);
    expect(numberValue("$1,204.50")).toBe(1204.5);
    expect(numberValue(Number.NaN)).toBe(0);
  });

  it("preserves bounds, text normalization, and invalid-date behavior", () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(textValue("  Uber Eats ")).toBe("uber eats");
    expect(parseDateValue("not-a-date")).toBeNull();
  });
});
