import { describe, expect, it } from "vitest";

import { buildScoreDeductions } from "@/app/api/caars/route";

describe("CAAR score deduction evidence", () => {
  it("explains an M02 TG04 deduction with the persisted R122/R123 order counts", () => {
    const deductions = buildScoreDeductions([
      {
        rule_id: "R136",
        sample_evidence: {
          samples: [{
            trust_gate_breakdown: JSON.stringify([
              { gate: "TG04", score: 0, weight_percent: 12 },
            ]),
          }],
        },
      },
      {
        rule_id: "R122",
        sample_evidence: {
          samples: [{
            difference_amount: 0,
            difference_percent: 0,
            dsp_order_count: 152,
            order_count_difference: 12,
            order_count_difference_percent: 7.89,
            pos_basis: 3_934.46,
            pos_certified_order_count: 140,
            processor_basis: 3_934.46,
            tg04_score: 0,
          }],
        },
      },
      {
        rule_id: "R123",
        sample_evidence: {
          samples: [{ detail: "POS reconciliation remains below the release band.", tg04_score: 0 }],
        },
      },
    ], "M02");

    expect(deductions).toHaveLength(1);
    expect(deductions[0]).toMatchObject({
      gate: "TG04",
      pointsLost: 12,
      score: 0,
      supported: true,
    });
    expect(deductions[0].evidence[0]).toContain("DSP unique period order count 152");
    expect(deductions[0].evidence[0]).toContain("POS-certified DSP order count 140");
    expect(deductions[0].evidence[0]).toContain("difference 12 orders (7.89%)");
    expect(deductions[0].evidence[0]).toContain("monetary values do not control");
  });

  it("describes missing M02 comparison inputs as coverage rather than an R123 mismatch", () => {
    const deductions = buildScoreDeductions([
      {
        rule_id: "R136",
        sample_evidence: {
          samples: [{
            trust_gate_breakdown: JSON.stringify([{ gate: "TG04", score: 0, weight_percent: 12 }]),
          }],
        },
      },
      {
        rule_id: "R122",
        sample_evidence: {
          samples: [{
            dsp_order_count: 0,
            pos_certified_order_count: 82,
            reconciliation_evaluable: false,
          }],
        },
      },
    ], "M02");

    expect(deductions[0]).toMatchObject({ supported: true, ruleIds: ["R122"] });
    expect(deductions[0].evidence[0]).toContain("evidence-coverage deduction");
    expect(deductions[0].evidence[0]).toContain("not an R123 reconciliation mismatch");
  });
});
