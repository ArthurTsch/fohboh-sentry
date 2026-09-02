import { describe, expect, it } from "vitest";

import { deriveReconciliationExceptions, normalizeCitationSampleValue } from "@/app/api/caars/route";

describe("CAAR citation sample normalization", () => {
  it("preserves nested weekly bank-reconciliation rows", () => {
    expect(normalizeCitationSampleValue([
      {
        bankDeposit: 1042.26,
        certificationMonthAmount: 92.57,
        followingMonthAmount: 949.69,
        payoutReference: "5F9MB3NA7V0EWNS",
      },
    ])).toEqual([
      {
        bankDeposit: 1042.26,
        certificationMonthAmount: 92.57,
        followingMonthAmount: 949.69,
        payoutReference: "5F9MB3NA7V0EWNS",
      },
    ]);
  });

  it("ignores extra M02 bank deposits while still requiring every settlement payout", () => {
    const upload = (artifactKey: string, metrics: Record<string, unknown>) => ({
      artifact_key: artifactKey,
      evidence_month: "2026-06",
      file_name: `${artifactKey}.csv`,
      id: artifactKey === "m02-settlement" ? 1 : 2,
      location_id: 1,
      module: "M02",
      page_count: null,
      row_count: null,
      sha256: "hash",
      uploaded_at: null,
      validation_summary: { metrics },
      vendor: "ubereats",
    });
    const result = deriveReconciliationExceptions({
      certificationPeriod: "June 2026",
      moduleId: "M02",
      uploads: [
        upload("m02-settlement", {
          payoutReferenceRows: [
            { activityMonth: "2026-06", amount: 100, externalRefId: "MATCHED" },
          ],
        }),
        upload("m02-bank", {
          depositReferenceRows: [
            { amount: 100, externalRefId: "MATCHED" },
            { amount: 835.07, externalRefId: "UNRELATED" },
          ],
        }),
      ],
    });

    expect(result).toEqual({ exceptions: [], notes: [], warnings: [] });

    const missingPayout = deriveReconciliationExceptions({
      certificationPeriod: "June 2026",
      moduleId: "M02",
      uploads: [
        upload("m02-settlement", {
          payoutReferenceRows: [{ activityMonth: "2026-06", amount: 200, externalRefId: "MISSING" }],
        }),
        upload("m02-bank", { depositReferenceRows: [{ amount: 835.07, externalRefId: "UNRELATED" }] }),
      ],
    });
    expect(missingPayout.exceptions).toHaveLength(1);
    expect(missingPayout.notes).toEqual([]);
  });
});
