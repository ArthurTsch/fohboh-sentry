import { describe, expect, it } from "vitest";

import type { CaarRecord } from "../../src/components/sentry/types";
import { deriveM02ProviderScores } from "../../src/components/sentry/views/WaterfallView";

function m02Caar(provider: string, score: number, completedAt: string): CaarRecord {
  return {
    accountId: "account-1",
    amount: "$0.00",
    dimensions: [],
    exhibits: 1,
    findings: [],
    id: `CAAR-${provider}-${completedAt}`,
    locationId: "LOC-1",
    locationName: "Test location",
    narrative: "",
    period: "June 2026",
    status: "Certified",
    traceability: {
      certCompletedAt: completedAt,
      certRunId: 1,
      courtAdmissible: true,
      evidence: [{
        artifactKey: "m02-settlement",
        fileName: `${provider}.csv`,
        label: "DSP Settlement",
        matchPct: 100,
        notes: [],
        pageCount: null,
        provenance: "direct_upload",
        rows: 1,
        schemaOk: true,
        sha256: "hash",
        status: "provided",
        trace: "upload#1",
        uploadedAt: completedAt,
        vendor: provider,
      }],
      fieldAudit: [],
      module: "M02",
      passedRuleCitations: [],
      reconciliationExceptions: [],
      ruleCitations: [],
      ruleSetVersion: "mge-v1.0.0",
      sealedAt: completedAt,
    },
    trustScore: score,
  };
}

describe("location waterfall M02 provider scores", () => {
  it("keeps the latest score for each delivery provider", () => {
    const scores = deriveM02ProviderScores([
      m02Caar("ubereats", 82, "2026-08-20T10:00:00.000Z"),
      m02Caar("doordash", 94, "2026-08-21T10:00:00.000Z"),
      m02Caar("uber-eats", 100, "2026-08-22T10:00:00.000Z"),
    ], "LOC-1");

    expect(scores).toMatchObject([
      { key: "doordash", name: "DoorDash", score: 94 },
      { key: "ubereats", name: "Uber Eats", score: 100 },
    ]);
  });

  it("does not mix scores from another location or module", () => {
    const otherLocation = { ...m02Caar("doordash", 10, "2026-08-23T10:00:00.000Z"), locationId: "LOC-2" };
    const m01 = m02Caar("toast", 20, "2026-08-23T10:00:00.000Z");
    if (m01.traceability) m01.traceability.module = "M01";

    expect(deriveM02ProviderScores([otherLocation, m01], "LOC-1")).toEqual([]);
  });
});
