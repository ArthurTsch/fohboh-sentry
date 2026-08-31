import { describe, expect, it } from "vitest";

import { mergeM02WindowValidations } from "@/lib/certification/service";

describe("M02 overlapping export-window merge", () => {
  it("deduplicates repeated orders before calculating the certification month", () => {
    const headers = ["order_date", "order_id", "subtotal", "commission", "total_payout", "payout_reference_id", "dining_mode"];
    const juneA = ["6/2/26", "A", "100", "20", "80", "PAY-A", "Delivery"];
    const juneB = ["6/3/26", "B", "200", "40", "160", "PAY-B", "Delivery"];
    const juneC = ["6/4/26", "C", "300", "60", "240", "PAY-C", "Pickup"];
    const julyD = ["7/1/26", "D", "400", "80", "320", "PAY-D", "Delivery"];

    const merged = mergeM02WindowValidations("m02-settlement", [
      { sourceHeaders: headers, sourceRows: [juneA, juneB] },
      { sourceHeaders: headers, sourceRows: [juneB, juneC, julyD] },
    ]);

    expect(merged?.duplicateRowsRemoved).toBe(1);
    expect(merged?.metrics.monthlyMetrics?.["2026-06"]).toMatchObject({
      basisAmount: 600,
      deliveryBasisAmount: 300,
      orderCount: 3,
      pickupBasisAmount: 300,
      transactionCount: 3,
    });
    expect(merged?.metrics.monthlyMetrics?.["2026-07"]?.orderCount).toBe(1);
  });

  it("normalizes reordered POS columns before deduplicating overlapping days", () => {
    const merged = mergeM02WindowValidations("m02-pos", [
      {
        sourceHeaders: ["channel", "business_day", "order_count", "gross_sales"],
        sourceRows: [["DoorDash", "6/2/26", "4", "100"]],
      },
      {
        sourceHeaders: ["business_day", "channel", "gross_sales", "order_count"],
        sourceRows: [
          ["6/2/26", "DoorDash", "100", "4"],
          ["6/3/26", "DoorDash", "200", "6"],
        ],
      },
    ]);

    expect(merged?.duplicateRowsRemoved).toBe(1);
    expect(merged?.metrics.monthlyMetrics?.["2026-06"]).toMatchObject({
      basisAmount: 300,
      orderCount: 10,
    });
  });
});
