import { describe, expect, it } from "vitest";

import { extractUploadMetrics } from "@/lib/uploads/intake";
import { normalizeHeader } from "@/lib/uploads/definitions";

describe("DoorDash commissionable basis", () => {
  it("subtracts only merchant-funded discounts and preserves order-level bases", () => {
    const headers = [
      "timestamp local date",
      "transaction type",
      "final order status",
      "subtotal",
      "commission",
      "customer discounts from marketing | (funded by you)",
      "customer discounts from marketing | (funded by doordash)",
      "customer discounts from marketing | (funded by a third-party)",
    ].map(normalizeHeader);
    const metrics = extractUploadMetrics("m02-settlement", headers, [
      ["2026-06-01", "Order", "Delivered", "12.49", "-0.67", "-8.00", "0", "0"],
      ["2026-06-02", "Order", "Picked Up", "20.00", "-1.20", "0", "-5.00", "-2.00"],
    ]);

    expect(metrics.basisAmount).toBe(32.49);
    expect(metrics.deliveryBasisAmount).toBe(12.49);
    expect(metrics.deliveryCommissionableBasisRows).toEqual([4.49]);
    expect(metrics.pickupBasisAmount).toBe(20);
    expect(metrics.pickupCommissionableBasisRows).toEqual([20]);
    expect(metrics.monthlyMetrics?.["2026-06"]).toMatchObject({
      basisAmount: 32.49,
      deliveryCommissionableBasisRows: [4.49],
      pickupCommissionableBasisRows: [20],
    });
  });
});
