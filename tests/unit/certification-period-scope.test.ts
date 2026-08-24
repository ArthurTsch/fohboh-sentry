import { describe, expect, it } from "vitest";

import {
  runDeterministicModuleEngine,
  scopeArtifactToCertificationMonth,
  type ModuleArtifactState,
} from "@/lib/mge/engine";

function artifact(key: string, metrics: ModuleArtifactState["metrics"]): ModuleArtifactState {
  return {
    fields: true,
    hash: true,
    key,
    label: key,
    metrics,
    schema: true,
    type: "CSV",
    uploaded: true,
  };
}

describe("certification-period evidence scope", () => {
  it("excludes M01 payout rows outside the certification month", () => {
    const scoped = scopeArtifactToCertificationMonth(
      artifact("m01-pos", {
        basisAmount: 300,
        payoutAmount: 300,
        payoutReferenceRows: [
          { amount: 100, externalRefId: "JUNE", settledDate: "06/30/2026" },
          { amount: 200, externalRefId: "JULY", settledDate: "07/01/2026" },
        ],
      }),
      "2026-06",
    );

    expect(scoped?.metrics).toMatchObject({
      basisAmount: 100,
      certificationPeriodExcludedRows: 1,
      certificationPeriodMismatch: false,
      payoutAmount: 100,
    });
    expect(scoped?.metrics?.payoutReferenceRows).toHaveLength(1);
  });

  it("marks an M01 file with only out-of-period rows as a period mismatch", () => {
    const scoped = scopeArtifactToCertificationMonth(
      artifact("m01-pos", {
        basisAmount: 200,
        payoutReferenceRows: [
          { amount: 200, externalRefId: "JULY", settledDate: "07/01/2026" },
        ],
      }),
      "2026-06",
    );

    expect(scoped?.metrics).toMatchObject({
      basisAmount: 0,
      certificationPeriodDetectedMonths: ["2026-07"],
      certificationPeriodMismatch: true,
      certificationPeriodExcludedRows: 1,
    });
  });

  it("selects only the requested M02 monthly settlement metrics", () => {
    const scoped = scopeArtifactToCertificationMonth(
      artifact("m02-settlement", {
        basisAmount: 300,
        monthlyMetrics: {
          "2026-06": { basisAmount: 100, feeAmount: 25, payoutAmount: 75, transactionCount: 1 },
          "2026-07": { basisAmount: 200, feeAmount: 50, payoutAmount: 150, transactionCount: 2 },
        },
      }),
      "2026-06",
    );

    expect(scoped?.metrics).toMatchObject({
      basisAmount: 100,
      certificationPeriodMismatch: false,
      feeAmount: 25,
      payoutAmount: 75,
      transactionCount: 1,
    });
  });

  it("keeps an M02 payout made in July when it belongs to June orders", () => {
    const scoped = scopeArtifactToCertificationMonth(
      artifact("m02-settlement", {
        basisAmount: 4_379.96,
        monthlyMetrics: {
          "2026-06": {
            basisAmount: 4_379.96,
            feeAmount: 1_015.01,
            payoutAmount: 3_656.82,
            transactionCount: 152,
          },
        },
        payoutAmount: 3_656.82,
        payoutReferenceRows: [
          {
            activityMonth: "2026-06",
            amount: 3_564.25,
            externalRefId: "JUNE-PAYOUTS",
            settledDate: "6/29/26",
          },
          {
            activityMonth: "2026-06",
            amount: 92.57,
            externalRefId: "JULY-PAYOUT",
            settledDate: "7/6/26",
          },
        ],
      }),
      "2026-06",
    );

    expect(scoped?.metrics).toMatchObject({
      basisAmount: 4_379.96,
      certificationPeriodExcludedRows: 0,
      payoutAmount: 3_656.82,
    });
    expect(scoped?.metrics?.payoutReferenceRows).toHaveLength(2);
  });

  it("excludes M02 rule inputs and payout rows outside the activity month", () => {
    const scoped = scopeArtifactToCertificationMonth(
      artifact("m02-settlement", {
        basisAmount: 300,
        duplicateOrderCount: 2,
        payoutAmount: 225,
        refundCount: 2,
        monthlyMetrics: {
          "2026-06": {
            basisAmount: 100,
            duplicateOrderCount: 0,
            payoutAmount: 75,
            refundCount: 0,
            transactionCount: 1,
          },
          "2026-07": {
            basisAmount: 200,
            duplicateOrderCount: 2,
            payoutAmount: 150,
            refundCount: 2,
            transactionCount: 2,
          },
        },
        payoutReferenceRows: [
          { activityMonth: "2026-06", amount: 75, externalRefId: "JUNE", settledDate: "7/1/26" },
          { activityMonth: "2026-07", amount: 150, externalRefId: "JULY", settledDate: "7/8/26" },
          { amount: 10, externalRefId: "UNDATED", settledDate: "6/30/26" },
        ],
      }),
      "2026-06",
    );

    expect(scoped?.metrics).toMatchObject({
      basisAmount: 100,
      duplicateOrderCount: 0,
      payoutAmount: 75,
      refundCount: 0,
    });
    expect(scoped?.metrics?.payoutReferenceRows?.map((row) => row.externalRefId)).toEqual(["JUNE"]);
  });

  it("recognizes two-digit years when scoping M01 payout dates", () => {
    const scoped = scopeArtifactToCertificationMonth(
      artifact("m01-pos", {
        payoutReferenceRows: [
          { amount: 100, externalRefId: "JUNE", settledDate: "6/30/26" },
          { amount: 200, externalRefId: "JULY", settledDate: "7/1/26" },
        ],
      }),
      "2026-06",
    );

    expect(scoped?.metrics?.payoutAmount).toBe(100);
    expect(scoped?.metrics?.payoutReferenceRows).toHaveLength(1);
  });

  it("blocks M02 period coverage when no settlement rows belong to the requested month", () => {
    const result = runDeterministicModuleEngine({
      artifacts: [
        artifact("m02-settlement", {
          monthlyMetrics: {
            "2026-07": { basisAmount: 200, feeAmount: 50, transactionCount: 2 },
          },
        }),
        artifact("m02-pos", {
          monthlyMetrics: {
            "2026-06": { basisAmount: 100, transactionCount: 1 },
          },
        }),
        artifact("m02-agreement", undefined),
        artifact("m02-bank", { depositAmount: 100 }),
        {
          ...artifact("m02-contract", undefined),
          contractValues: {
            commission_base: "Subtotal before tax",
            delivery_active: "true",
            rate_delivery: "25",
            rate_pickup: "7",
          },
          type: "Manual Entry",
        },
      ],
      cadence: "monthly_final",
      certificationMonth: "2026-06",
      evaluationDate: new Date("2026-06-30T12:00:00.000Z"),
      moduleId: "M02",
    });

    expect(result.trustGates.TG06.scorePct).toBe(0);
    expect(result.trustGates.TG06.detail).toContain("no dated rows");
    expect(result.mq6.data_freshness.detail).toContain("2026-07");
    expect(result.ready).toBe(false);
  });
});
