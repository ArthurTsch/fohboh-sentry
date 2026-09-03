import { describe, expect, it } from "vitest";

import { isCertificationConflict } from "@/app/api/v1/certifications/run/route";

describe("certification API error mapping", () => {
  it.each([
    "M01 final certification for 2026-06 requires payout exports uploaded for 2026-06 and 2026-07.",
    "M02 final certification for 2026-06 requires a complete provider-specific monthly evidence package.",
  ])("maps an incomplete monthly-final package to a conflict: %s", (message) => {
    expect(isCertificationConflict(new Error(message))).toBe(true);
  });

  it("does not hide unexpected server failures as conflicts", () => {
    expect(isCertificationConflict(new Error("Database connection failed"))).toBe(false);
  });
});
