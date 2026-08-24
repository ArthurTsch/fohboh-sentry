import { describe, expect, it } from "vitest";
import {
  deriveM01Calculation,
  deriveM02Calculation,
  uniqueRuleCitations,
} from "@/components/sentry/caar/calculations";

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

  it("projects M01 persisted evidence without changing the certified recovery", () => {
    const result = deriveM01Calculation([{
      firedCount: 1,
      ruleId: "R002",
      ruleVersion: "mge-v1.0.0",
      sampleEvidenceCount: 1,
      sampleEvidence: [{ actual_fee_amount: 12.34, basis_amount: 500, expected_fee_amount: 10 }],
      varianceDisplay: "$2.34",
    }], "$2.34");
    expect(result).toMatchObject({ actualFees: 12.34, certifiedRecoveryDisplay: "$2.34", expectedFees: 10 });
  });

  it("keeps only the latest citation for each stable rule/version identity", () => {
    const citation = {
      firedCount: 1,
      ruleId: "R016",
      ruleVersion: "mge-v1.0.0",
      sampleEvidenceCount: 0,
      sampleEvidence: [],
      varianceDisplay: "$0.00",
    };
    expect(uniqueRuleCitations([citation, { ...citation, firedCount: 2 }])).toEqual([
      { ...citation, firedCount: 2 },
    ]);
  });
});
