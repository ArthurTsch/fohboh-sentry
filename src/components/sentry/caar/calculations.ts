import type { CaarRuleCitationSummary } from "../types";

export type M02Calculation = ReturnType<typeof deriveM02Calculation>;
export type M01Calculation = ReturnType<typeof deriveM01Calculation>;

export function uniqueRuleCitations(citations: CaarRuleCitationSummary[]) {
  const unique = new Map<string, CaarRuleCitationSummary>();
  for (const citation of citations) unique.set(`${citation.ruleId}:${citation.ruleVersion}`, citation);
  return [...unique.values()];
}

export function deriveM02Calculation(
  ruleCitations: CaarRuleCitationSummary[],
  certifiedRecoveryDisplay: string,
) {
  const sample = ruleCitations
    .find((citation) => citation.ruleId === "R016")
    ?.sampleEvidence.find((row) => typeof row.commission_base_amount === "number");
  if (!sample) return null;
  const number = (key: string) => typeof sample[key] === "number" ? sample[key] as number : 0;
  const reconciliationBasis = number("reconciliation_statement_basis");
  const posBasis = number("pos_basis_amount");
  const reconciliationDifference = number("reconciliation_difference");
  return {
    actualCommission: number("actual_commission") || number("observed_commission"),
    certifiedRecoveryDisplay,
    deliveryBasis: number("delivery_basis_amount"),
    deliveryRate: number("delivery_rate_pct"),
    expectedCommission: number("expected_commission"),
    expectedDeliveryCommission: number("expected_delivery_commission"),
    expectedPickupCommission: number("expected_pickup_commission"),
    pickupBasis: number("pickup_basis_amount"),
    pickupRate: number("pickup_rate_pct"),
    posBasis,
    reconciliationBasis,
    reconciliationDifference,
    reconciliationPct: reconciliationBasis > 0 ? (reconciliationDifference / reconciliationBasis) * 100 : 0,
    totalBasis: number("commission_base_amount"),
  };
}

export function deriveM01Calculation(
  ruleCitations: CaarRuleCitationSummary[],
  certifiedRecoveryDisplay: string,
) {
  const sample = ruleCitations
    .find((citation) => citation.ruleId === "R002" && citation.sampleEvidence.some((row) => typeof row.expected_fee_amount === "number"))
    ?.sampleEvidence.find((row) => typeof row.expected_fee_amount === "number");
  if (!sample) return null;
  const number = (key: string) => typeof sample[key] === "number" ? sample[key] as number : 0;
  const basis = number("basis_amount");
  const reconciliationDifference = number("reconciliation_difference");
  return {
    actualFees: number("actual_fee_amount"),
    basis,
    certifiedRecoveryDisplay,
    expectedFees: number("expected_fee_amount"),
    interchange: number("expected_interchange_component"),
    markup: number("expected_markup_component"),
    markupBps: number("contracted_markup_bps"),
    monthlyFee: number("expected_monthly_component"),
    posBasis: number("pos_basis_amount"),
    reconciliationDifference,
    reconciliationPct: basis > 0 ? (reconciliationDifference / basis) * 100 : 0,
    transactionFees: number("expected_txn_component"),
    transactionCount: number("transaction_count"),
    transactionFee: number("contracted_per_txn_fee"),
  };
}
