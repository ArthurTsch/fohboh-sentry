import { describe, expect, it } from "vitest";

import { getM02MonthlyFinalEvidenceBlockers } from "@/lib/certification/monthly-scope";

describe("M02 monthly-final evidence readiness", () => {
  const datedJuneActivity = {
    metrics: { monthlyMetrics: { "2026-06": { basisAmount: 100, transactionCount: 1 } } },
  };
  const completeJunePackage = [
    { artifact_key: "m02-settlement", evidence_month: "2026-05", validation_summary: { ...datedJuneActivity, sourceHeaders: [], sourceRows: [] } },
    { artifact_key: "m02-settlement", evidence_month: "2026-06", validation_summary: { ...datedJuneActivity, sourceHeaders: [], sourceRows: [] } },
    { artifact_key: "m02-pos", evidence_month: "2026-05", validation_summary: { ...datedJuneActivity, sourceHeaders: [], sourceRows: [] } },
    { artifact_key: "m02-pos", evidence_month: "2026-06", validation_summary: { ...datedJuneActivity, sourceHeaders: [], sourceRows: [] } },
    { artifact_key: "m02-agreement", evidence_month: null },
    { artifact_key: "m02-bank", evidence_month: "2026-06" },
  ];

  it("accepts a complete package for the selected month", () => {
    expect(getM02MonthlyFinalEvidenceBlockers(completeJunePackage, "2026-06")).toEqual([]);
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

  it("ignores a previous export that contains no activity for the selected month", () => {
    const blockers = getM02MonthlyFinalEvidenceBlockers(
      completeJunePackage.map((upload) =>
        upload.artifact_key === "m02-settlement" && upload.evidence_month === "2026-05"
          ? { ...upload, validation_summary: { metrics: { monthlyMetrics: { "2026-07": {} } } } }
          : upload,
      ),
      "2026-06",
    );

    expect(blockers).toEqual([]);
  });

  it("requires merge lineage when a previous export contributes selected-month rows", () => {
    const blockers = getM02MonthlyFinalEvidenceBlockers(
      completeJunePackage.map((upload) =>
        upload.artifact_key === "m02-settlement" && upload.evidence_month === "2026-05"
          ? { ...upload, validation_summary: datedJuneActivity }
          : upload,
      ),
      "2026-06",
    );

    expect(blockers).toEqual([
      "DSP settlement export for 2026-05 must be re-uploaded so its overlapping 2026-06 rows can be deduplicated safely.",
    ]);
  });
});
