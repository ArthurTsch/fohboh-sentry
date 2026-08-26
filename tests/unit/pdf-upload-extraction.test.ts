import { describe, expect, it } from "vitest";

import { extractPdfMetrics } from "@/lib/uploads/pdf";

describe("processor PDF metric extraction", () => {
  it("rejects bank layouts that are not explicitly supported", () => {
    const result = extractPdfMetrics("m01-bank", "Deposits and additions 1,234.56", null, "other-bank");

    expect(result.metrics).toBeUndefined();
    expect(result.warnings).toContain(
      "This bank PDF format is not supported. The current parser accepts Prosperity Bank statements only.",
    );
  });

  it("uses the Toast Summary block for total and interchange fees", () => {
    const result = extractPdfMetrics("m01-processor", `
Summary
Previous Credit Card Balance 0.00
Interchange Fees -2,019.92
Network Fees -275.96
Toast Processing Fees -855.38
Other Adjustments -7.72
Payments 0.00
Credit Card Balance -3,158.98
Total 4419 $128,175.34 $12.98 $3,139.00
`);

    expect(result.metrics).toMatchObject({
      basisAmount: 128175.34,
      feeAmount: 3158.98,
      interchangeFeeAmount: 2019.92,
      networkFeeAmount: 275.96,
      otherAdjustmentAmount: 7.72,
      processorFeeAmount: 855.38,
      statementTotalFeeAmount: 3158.98,
      transactionCount: 4419,
    });
  });

  it("reads a summary amount placed on the following extracted-text line", () => {
    const result = extractPdfMetrics("m01-processor", `
Interchange Fees
-2,019.92
Credit Card Balance
-3,158.98
Total 4419 $128,175.34 $12.98 $3,139.00
`);

    expect(result.metrics?.interchangeFeeAmount).toBe(2019.92);
    expect(result.metrics?.feeAmount).toBe(3158.98);
  });

  it("does not silently turn a missing interchange line into zero", () => {
    const result = extractPdfMetrics("m01-processor", `
Credit Card Balance -3,158.98
Total 4419 $128,175.34 $12.98 $3,139.00
`);

    expect(result.metrics?.interchangeFeeAmount).toBeUndefined();
    expect(result.warnings).toContain(
      "Interchange fee total was not detected automatically from this processor PDF.",
    );
    expect(result.warnings).toContain(
      "Processor-owned fee total was not detected separately from pass-through fees in this processor PDF.",
    );
  });

  it("preserves an explicitly reported zero interchange fee", () => {
    const result = extractPdfMetrics("m01-processor", `
Interchange Fees 0.00
Credit Card Balance -1,000.00
Total 100 $10,000.00 $100.00 $9,000.00
`);

    expect(result.metrics?.interchangeFeeAmount).toBe(0);
    expect(result.warnings).not.toContain(
      "Interchange fee total was not detected automatically from this processor PDF.",
    );
  });
});
