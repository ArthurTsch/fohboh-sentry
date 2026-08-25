import { describe, expect, it } from "vitest";

import { runDeterministicModuleEngine, type ModuleArtifactState } from "../../src/lib/mge/engine";

function artifact(
  key: string,
  type: ModuleArtifactState["type"],
  extra: Partial<ModuleArtifactState> = {},
): ModuleArtifactState {
  return {
    fields: true,
    hash: true,
    key,
    label: key,
    schema: true,
    type,
    updatedAt: "2026-06-30T12:00:00.000Z",
    uploaded: true,
    ...extra,
  };
}

describe("M02 citation consistency", () => {
  it("does not fire R123 when the DSP-to-POS comparison is not evaluable", () => {
    const result = runDeterministicModuleEngine({
      artifacts: [
        artifact("m02-settlement", "CSV", { metrics: { basisAmount: 0, orderCount: 0 } }),
        artifact("m02-pos", "CSV", { metrics: { basisAmount: 2_406.55, orderCount: 82 } }),
        artifact("m02-agreement", "PDF"),
        artifact("m02-bank", "PDF", { metrics: { depositAmount: 2_406.55 } }),
        artifact("m02-contract", "Manual Entry", {
          contractValues: { commission_base: "Subtotal before tax", rate_delivery: "25", rate_pickup: "7" },
        }),
      ],
      cadence: "monthly_final",
      certificationMonth: "2026-06",
      evaluationDate: new Date("2026-06-30T12:00:00.000Z"),
      moduleId: "M02",
    });

    expect(result.trustGates.TG04.scorePct).toBe(0);
    expect(result.ruleCitations.find((citation) => citation.ruleId === "R122")?.sampleEvidence[0]).toMatchObject({
      dsp_order_count: 0,
      pos_certified_order_count: 82,
      reconciliation_evaluable: false,
    });
    expect(result.ruleCitations.some((citation) => citation.ruleId === "R123")).toBe(false);
  });

  it("passes TG04 when a delivery-only POS report matches unique DSP delivery orders", () => {
    const result = runDeterministicModuleEngine({
      artifacts: [
        artifact("m02-settlement", "CSV", {
          metrics: {
            basisAmount: 4_379.96,
            deliveryBasisAmount: 3_934.46,
            deliveryOrderCount: 141,
            duplicateOrderCount: 1,
            duplicateTransactionCount: 0,
            feeAmount: 1_015.01,
            orderCount: 152,
            payoutAmount: 3_656.82,
            pickupBasisAmount: 445.5,
            pickupOrderCount: 11,
            refundCount: 1,
            transactionCount: 152,
          },
        }),
        artifact("m02-pos", "CSV", {
          metrics: { basisAmount: 3_934.46, orderCount: 140, transactionCount: 29 },
        }),
        artifact("m02-agreement", "PDF"),
        artifact("m02-bank", "PDF", { metrics: { depositAmount: 4_783.38 } }),
        artifact("m02-contract", "Manual Entry", {
          contractValues: {
            commission_base: "Subtotal before tax",
            delivery_active: "true",
            rate_delivery: "25",
            rate_pickup: "7",
          },
        }),
      ],
      cadence: "monthly_final",
      certificationMonth: "2026-06",
      evaluationDate: new Date("2026-06-30T12:00:00.000Z"),
      moduleId: "M02",
    });

    const citation = (ruleId: string) => result.ruleCitations.find((row) => row.ruleId === ruleId);

    expect(result.dimensions["Cross-System Reconciliation"]).toBe(50);
    expect(result.trustGates.TG04.scorePct).toBe(100);
    expect(result.trustGates.TG05.scorePct).toBe(100);
    expect(citation("R010")?.disposition).toBe("informational");
    expect(citation("R019")?.disposition).toBe("monetary");
    expect(citation("R123")?.disposition).toBe("passed");
    expect(citation("R125")?.disposition).toBe("passed");
    expect(citation("R123")?.firedCount).toBe(0);
    expect(citation("R122")?.sampleEvidence[0]).toMatchObject({
      dsp_order_count: 140,
      order_count_difference: 0,
      order_count_scope: "delivery_unique_orders",
      pos_certified_order_count: 140,
    });
    expect(citation("R122")?.sampleEvidence[0]).toMatchObject({
      bank_basis: 4_783.38,
      bank_score_contribution: 0,
      fee_score_contribution: 25,
      payout_basis: 3_656.82,
      pos_score_contribution: 25,
      reconciliation_total_score: 50,
    });
    expect(citation("R125")?.firedCount).toBe(0);
    expect(result.ruleCitations.filter((row) => row.disposition === "blocking").map((row) => row.ruleId)).not.toContain("R123");
  });

  it("does not turn a detected recovery condition with zero attributed variance into a blocker", () => {
    const result = runDeterministicModuleEngine({
      artifacts: [
        artifact("m02-settlement", "CSV", {
          metrics: {
            basisAmount: 100,
            deliveryBasisAmount: 100,
            deliveryOrderCount: 1,
            feeAmount: 25,
            orderCount: 1,
            payoutAmount: 100,
            refundCount: 1,
            transactionCount: 1,
          },
        }),
        artifact("m02-pos", "CSV", { metrics: { basisAmount: 100, orderCount: 1, transactionCount: 1 } }),
        artifact("m02-agreement", "PDF"),
        artifact("m02-bank", "PDF", { metrics: { depositAmount: 100 } }),
        artifact("m02-contract", "Manual Entry", {
          contractValues: {
            commission_base: "Subtotal before tax",
            delivery_active: "true",
            rate_delivery: "25",
            rate_pickup: "7",
          },
        }),
      ],
      cadence: "monthly_final",
      certificationMonth: "2026-06",
      evaluationDate: new Date("2026-06-30T12:00:00.000Z"),
      moduleId: "M02",
    });

    const refund = result.ruleCitations.find((citation) => citation.ruleId === "R019");
    expect(result.recoveryValue).toBe(0);
    expect(result.trustGates.TG04.scorePct).toBe(100);
    expect(refund?.varianceCents).toBe(0);
    expect(refund?.disposition).toBe("informational");
    expect(result.ruleCitations.some((citation) => citation.disposition === "blocking")).toBe(false);
  });
});

describe("M01 Toast fee comparison", () => {
  it("compares governed processor pricing only with Toast Processing Fees", () => {
    const result = runDeterministicModuleEngine({
      artifacts: [
        artifact("m01-processor", "PDF", {
          metrics: {
            basisAmount: 128_175.34,
            feeAmount: 3_158.98,
            interchangeFeeAmount: 2_019.92,
            networkFeeAmount: 275.96,
            otherAdjustmentAmount: 7.72,
            payoutAmount: 3_139,
            processorFeeAmount: 855.38,
            statementTotalFeeAmount: 3_158.98,
            transactionCount: 4_419,
          },
        }),
        artifact("m01-pos", "CSV", { metrics: { basisAmount: 128_175.34 } }),
        artifact("m01-agreement", "PDF"),
        artifact("m01-bank", "PDF", { metrics: { depositAmount: 3_139 } }),
        artifact("m01-contract", "Manual Entry", {
          contractValues: { markup_bps: "55", monthly_fee: "0", txn_fee: "0.05" },
        }),
      ],
      cadence: "monthly_final",
      certificationMonth: "2026-06",
      evaluationDate: new Date("2026-06-30T12:00:00.000Z"),
      moduleId: "M01",
    });

    const sample = result.ruleCitations
      .find((citation) => citation.ruleId === "R002")
      ?.sampleEvidence[0];

    expect(result.recoveryValue).toBe(0);
    expect(sample).toMatchObject({
      actual_fee_amount: 855.38,
      expected_fee_amount: 925.91,
      expected_interchange_component: 0,
      extracted_interchange_fee_amount: 2_019.92,
      extracted_network_fee_amount: 275.96,
      extracted_other_adjustment_amount: 7.72,
      extracted_processor_fee_amount: 855.38,
      extracted_statement_total_fee_amount: 3_158.98,
      fee_comparison_scope: "processor_fee_only",
      unexplained_fee_delta: 0,
    });
  });
});
