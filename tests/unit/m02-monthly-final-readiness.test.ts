import { describe, expect, it } from "vitest";

import { getM02MonthlyFinalEvidenceBlockers } from "@/lib/certification/monthly-scope";

describe("M02 monthly-final evidence readiness", () => {
  const datedJuneActivity = {
    metrics: { monthlyMetrics: { "2026-06": { basisAmount: 100, transactionCount: 1 } } },
  };
  const completeJunePackage = [
    { artifact_key: "m02-settlement", evidence_month: "2026-06", validation_summary: datedJuneActivity },
    { artifact_key: "m02-pos", evidence_month: "2026-06", validation_summary: datedJuneActivity },
    { artifact_key: "m02-agreement", evidence_month: null },
    { artifact_key: "m02-bank", evidence_month: "2026-06" },
  ];
  const completeUberJunePackage = [
    ...completeJunePackage,
    { artifact_key: "m02-settlement", evidence_month: "2026-07", validation_summary: { metrics: { monthlyMetrics: { "2026-07": { basisAmount: 100, transactionCount: 1 } } } } },
    { artifact_key: "m02-bank", evidence_month: "2026-07" },
  ];

  it("accepts a complete package for the selected month", () => {
    expect(getM02MonthlyFinalEvidenceBlockers(completeJunePackage, "2026-06")).toEqual([]);
  });

  it("requires the following settlement and bank statement for an Uber Eats final", () => {
    expect(getM02MonthlyFinalEvidenceBlockers(completeJunePackage, "2026-06", "ubereats")).toEqual([
      "DSP settlement bank-reconciliation tail export for 2026-07 is missing.",
      "bank statement bank-reconciliation tail export for 2026-07 is missing.",
    ]);
    expect(getM02MonthlyFinalEvidenceBlockers(completeUberJunePackage, "2026-06", "ubereats")).toEqual([]);
  });

  it("does not require the following month for another provider", () => {
    expect(getM02MonthlyFinalEvidenceBlockers(completeJunePackage, "2026-06", "doordash")).toEqual([]);
  });

  it("does not let another month's evidence satisfy the selected month", () => {
    const blockers = getM02MonthlyFinalEvidenceBlockers(
      completeJunePackage.map((upload) =>
        upload.evidence_month !== null
          ? { ...upload, evidence_month: "2026-07" }
          : upload,
      ),
      "2026-06",
    );

    expect(blockers).toEqual([
      "DSP settlement export for 2026-06 is missing.",
      "POS summary by channel export for 2026-06 is missing.",
      "bank statement export for 2026-06 is missing.",
    ]);
  });

  it("allows the signed agreement to remain non-monthly", () => {
    const blockers = getM02MonthlyFinalEvidenceBlockers(
      completeJunePackage.filter((upload) => upload.artifact_key !== "m02-agreement"),
      "2026-06",
    );

    expect(blockers).toEqual(["signed DSP agreement is missing."]);
  });

  it("rejects a selected-month file whose parsed rows belong to another month", () => {
    const blockers = getM02MonthlyFinalEvidenceBlockers(
      completeJunePackage.map((upload) =>
        upload.artifact_key === "m02-settlement" && upload.evidence_month === "2026-06"
          ? { ...upload, validation_summary: { metrics: { monthlyMetrics: { "2026-07": {} } } } }
          : upload,
      ),
      "2026-06",
    );

    expect(blockers).toEqual([
      "DSP settlement export for 2026-06 contains no dated activity rows for 2026-06.",
    ]);
  });
});
