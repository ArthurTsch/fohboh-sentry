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
  it("uses TG04 for R123, treats order-only duplicates as review, and keeps monetary findings non-blocking", () => {
    const result = runDeterministicModuleEngine({
      artifacts: [
        artifact("m02-settlement", "CSV", {
          metrics: {
            basisAmount: 4_379.96,
            deliveryBasisAmount: 3_934.46,
            duplicateOrderCount: 1,
            duplicateTransactionCount: 0,
            feeAmount: 1_015.01,
            orderCount: 152,
            payoutAmount: 3_656.82,
            pickupBasisAmount: 445.5,
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
      bank_basis: 4_783.38,
      bank_score_contribution: 0,
      fee_score_contribution: 25,
      payout_basis: 3_656.82,
      pos_score_contribution: 25,
      reconciliation_total_score: 50,
    });
    expect(citation("R125")?.firedCount).toBe(0);
    expect(result.ruleCitations.filter((row) => row.disposition === "blocking")).toEqual([]);
    expect(result.ready).toBe(true);
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
    expect(refund?.varianceCents).toBe(0);
    expect(refund?.disposition).toBe("informational");
    expect(result.ruleCitations.some((citation) => citation.disposition === "blocking")).toBe(false);
  });
});
