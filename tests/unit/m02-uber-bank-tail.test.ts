import { describe, expect, it } from "vitest";

import { mergeUberBankReconciliationTail } from "@/lib/certification/service";

describe("Uber Eats following-month bank reconciliation tail", () => {
  it("reconstructs a shared payout without adding July commercial activity to June", () => {
    const merged = mergeUberBankReconciliationTail(
      {
        metrics: {
          basisAmount: 4379.96,
          feeAmount: 1015.01,
          monthlyMetrics: {
            "2026-06": { basisAmount: 4379.96, feeAmount: 1015.01, payoutAmount: 3656.82, transactionCount: 152 },
          },
          payoutAmount: 3656.82,
          payoutReferenceRows: [
            { activityMonth: "2026-06", amount: 1120.27, externalRefId: "HTGKFHO51WJYOMH" },
            { activityMonth: "2026-06", amount: 804.5, externalRefId: "CZZ9YWQJ88GWF0R" },
            { activityMonth: "2026-06", amount: 850.26, externalRefId: "N6RX3PO0HMTYCVJ" },
            { activityMonth: "2026-06", amount: 789.22, externalRefId: "8MQY1FPWIMGZD0I" },
            { activityMonth: "2026-06", amount: 92.57, externalRefId: "5F9MB3NA7V0EWNS" },
          ],
        },
      },
      {
        metrics: {
          basisAmount: 4650.05,
          feeAmount: 1200,
          payoutReferenceRows: [
            { activityMonth: "2026-07", amount: 949.69, externalRefId: "5F9MB3NA7V0EWNS" },
            { activityMonth: "2026-07", amount: 835.07, externalRefId: "B6WL0KLI882GNY3" },
          ],
        },
      },
      "2026-06",
    );

    expect(merged.basisAmount).toBe(4379.96);
    expect(merged.feeAmount).toBe(1015.01);
    expect(merged.payoutAmount).toBe(4606.51);
    expect(merged.payoutReferenceRows).toContainEqual(
      expect.objectContaining({ activityMonth: "2026-06", amount: 1042.26, externalRefId: "5F9MB3NA7V0EWNS" }),
    );
    expect(merged.payoutReferenceRows).not.toContainEqual(
      expect.objectContaining({ externalRefId: "B6WL0KLI882GNY3" }),
    );
  });
});
