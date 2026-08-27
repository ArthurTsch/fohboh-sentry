import { describe, expect, it } from "vitest";

import { validateUploadArtifact } from "@/lib/uploads/intake";

describe("M01 sliding payout intake", () => {
  it("buckets payout rows by sales-period activity month, not settled month", async () => {
    const csv = [
      'Settled date,Name,Location,Type,Sales period start,Sales period end,"# Txns",Payments,Refunds,Fees,Withholdings,Chargebacks,External,Payout,External Ref. ID,Status',
      "07/01/2026,Test,,,06/29/2026 15:52:53,,99,2742.45,0,0,0,0,0,2742.45,JUNE-29,SENT",
      "07/02/2026,Test,,,06/30/2026 16:06:11,,101,2907.74,0,0,0,0,0,2907.74,JUNE-30,SENT",
      "07/03/2026,Test,,,07/01/2026 16:00:00,,10,300.00,0,0,0,0,0,300.00,JULY-01,SENT",
    ].join("\n");

    const result = await validateUploadArtifact({
      artifactKey: "m01-pos",
      buffer: Buffer.from(csv),
      contentType: "text/csv",
      fileName: "Toast_Payouts_2026-07.csv",
      vendorKey: "toast",
    });

    expect(result.metrics?.monthlyMetrics?.["2026-06"]).toMatchObject({
      basisAmount: 5_650.19,
      payoutAmount: 5_650.19,
      transactionCount: 200,
    });
    expect(result.metrics?.monthlyMetrics?.["2026-07"]).toMatchObject({
      basisAmount: 300,
      transactionCount: 10,
    });
    expect(result.metrics?.payoutReferenceRows?.map((row) => row.activityMonth)).toEqual([
      "2026-06",
      "2026-06",
      "2026-07",
    ]);
  });
});
