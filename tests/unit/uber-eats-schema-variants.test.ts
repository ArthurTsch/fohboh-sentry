import { describe, expect, it } from "vitest";

import { detectKnownSourceFormat, normalizeHeader } from "@/lib/uploads/definitions";
import { extractUploadMetrics } from "@/lib/uploads/intake";

describe("Uber Eats settlement schema variants", () => {
  it("recognizes the newer chargeback-based order-level export", () => {
    const headers = "Store Name,External Store ID,Store UUID,Order ID,Workflow ID,Dining Mode,Payment Mode,Order Channel,Order Status,Order Date,Order Accept Time,Order Completion time,Customer Uber-Membership Status,Currency Code,Sales (excl. tax),Tax on Sales,Sales (incl. tax),Chargeback Amount,Tax on Chargeback Amount,Chargeback Amount (incl. tax),Price adjustments (excl. tax),Tax on Price Adjustments,Offers on items (incl. tax),Tax On Offers on items,Delivery Offer Redemptions (incl. tax),Tax On Delivery Offer Redemptions,Offer Redemption Fee,Bag Fee,Marketing Adjustment,Total Sales after Adjustments (incl tax),Marketplace Fee,Marketplace fee %,Tax on Marketplace Fee,Delivery Network Fee,Tax on Delivery Network Fee,Order Processing Fee,Delivery Fee,Tax On Delivery Fee,Tips,Capital payments,Container Deposit Fee,Other payments description,Other payments,Marketplace Facilitator Tax Adjustment,Marketplace Facilitator Tax,Backup Withholding Tax,Garnishment,Total payout,Payout Date,Markup Amount,Markup Tax,Retailer Loyalty ID,Payout reference ID"
      .split(",")
      .map(normalizeHeader);

    expect(detectKnownSourceFormat("m02-settlement", headers)?.format.key).toBe(
      "ubereats-order-level-payout-v2",
    );
  });

  it("maps the newer chargeback amount into monthly rule inputs", () => {
    const headers = ["order_date", "order_id", "sales_(excl._tax)", "chargeback_amount"];
    const metrics = extractUploadMetrics("m02-settlement", headers, [
      ["7/2/26", "ORDER-1", "100", "12.50"],
    ]);

    expect(metrics.chargebackCount).toBe(1);
    expect(metrics.monthlyMetrics?.["2026-07"]?.chargebackCount).toBe(1);
  });
});
