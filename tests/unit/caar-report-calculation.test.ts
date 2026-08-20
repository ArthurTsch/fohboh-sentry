import { describe, expect, it } from "vitest";
import { deriveM02Calculation } from "@/components/sentry/overlays/CaarReportModal";

describe("CAAR calculation display", () => {
  it("uses the exact persisted recovery instead of recomputing rounded totals", () => {
    const result = deriveM02Calculation([
      {
        firedCount: 1,
        ruleId: "R016",
        ruleVersion: "mge-v1.0.0",
        sampleEvidenceCount: 1,
        sampleEvidence: [{
          actual_commission: 100.2,
          commission_base_amount: 400,
          delivery_basis_amount: 400,
          delivery_rate_pct: 25,
          expected_commission: 100,
          expected_delivery_commission: 100,
          expected_pickup_commission: 0,
          pickup_basis_amount: 0,
          pickup_rate_pct: 7,
        }],
        varianceDisplay: "$0.17",
      },
    ], "$0.17");

    expect(result?.certifiedRecoveryDisplay).toBe("$0.17");
    expect(result).not.toHaveProperty("commissionVariance");
  });
});
