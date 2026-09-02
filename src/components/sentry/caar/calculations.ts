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
  const reconciliationSample = findReconciliationSample(ruleCitations);
  const reconciliationNumber = (key: string) =>
    typeof reconciliationSample?.[key] === "number" ? reconciliationSample[key] as number : null;
  const reconciliationText = (key: string) =>
    typeof reconciliationSample?.[key] === "string" ? reconciliationSample[key] as string : null;
  const weeklyBankReconciliation = Array.isArray(reconciliationSample?.bank_weekly_reconciliation)
    ? reconciliationSample.bank_weekly_reconciliation.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        if (typeof row.payoutReference !== "string" || typeof row.payoutAmount !== "number") return [];
        return [{
          bankDeposit: typeof row.bankDeposit === "number" ? row.bankDeposit : null,
          bankPostedDate: typeof row.bankPostedDate === "string" ? row.bankPostedDate : null,
          certificationMonthAmount: typeof row.certificationMonthAmount === "number" ? row.certificationMonthAmount : row.payoutAmount,
          followingMonthAmount: typeof row.followingMonthAmount === "number" ? row.followingMonthAmount : 0,
          payoutAmount: row.payoutAmount,
          payoutReference: row.payoutReference,
          payoutSettledDate: typeof row.payoutSettledDate === "string" ? row.payoutSettledDate : null,
        }];
      })
    : [];
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
    dspOrderCount: reconciliationNumber("dsp_order_count"),
    orderCountDifference: reconciliationNumber("order_count_difference"),
    orderCountDifferencePct: reconciliationNumber("order_count_difference_percent"),
    orderCountScope: reconciliationText("order_count_scope"),
    pickupBasis: number("pickup_basis_amount"),
    pickupRate: number("pickup_rate_pct"),
    posBasis,
    posCertifiedOrderCount: reconciliationNumber("pos_certified_order_count"),
    reconciliationBasis,
    reconciliationDifference,
    reconciliationPct: reconciliationBasis > 0 ? (reconciliationDifference / reconciliationBasis) * 100 : 0,
    totalBasis: number("commission_base_amount"),
    tg04Score: reconciliationNumber("tg04_score"),
    weeklyBankReconciliation,
    ...deriveBankReconciliation(reconciliationNumber),
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
  const optionalNumber = (key: string) => typeof sample[key] === "number" ? sample[key] as number : null;
  const optionalText = (key: string) => typeof sample[key] === "string" ? sample[key] as string : null;
  const reconciliationSample = findReconciliationSample(ruleCitations);
  const reconciliationNumber = (key: string) =>
    typeof reconciliationSample?.[key] === "number" ? reconciliationSample[key] as number : null;
  const basis = number("basis_amount");
  const reconciliationDifference = number("reconciliation_difference");
  return {
    actualFees: number("actual_fee_amount"),
    basis,
    certifiedRecoveryDisplay,
    expectedFees: number("expected_fee_amount"),
    interchange: optionalNumber("expected_interchange_component"),
    extractedInterchange: optionalNumber("extracted_interchange_fee_amount"),
    networkFees: optionalNumber("extracted_network_fee_amount"),
    otherAdjustments: optionalNumber("extracted_other_adjustment_amount"),
    processorFees: optionalNumber("extracted_processor_fee_amount"),
    statementTotalFees: optionalNumber("extracted_statement_total_fee_amount"),
    feeComparisonScope: optionalText("fee_comparison_scope"),
    markup: number("expected_markup_component"),
    markupBps: number("contracted_markup_bps"),
    monthlyFee: number("expected_monthly_component"),
    posBasis: number("pos_basis_amount"),
    reconciliationDifference,
    reconciliationPct: basis > 0 ? (reconciliationDifference / basis) * 100 : 0,
    transactionFees: number("expected_txn_component"),
    transactionCount: number("transaction_count"),
    transactionFee: number("contracted_per_txn_fee"),
    ...deriveBankReconciliation(reconciliationNumber),
  };
}

function findReconciliationSample(ruleCitations: CaarRuleCitationSummary[]) {
  return ruleCitations
    .find((citation) => citation.ruleId === "R122")
    ?.sampleEvidence.find((row) => typeof row.pos_basis === "number");
}

function deriveBankReconciliation(number: (key: string) => number | null) {
  return {
    bankBasis: number("bank_basis"),
    bankDifference: number("bank_difference"),
    bankDifferencePct: number("bank_difference_percent"),
    bankMatchCount: number("bank_match_count"),
    bankScoreContribution: number("bank_score_contribution"),
    feeScoreContribution: number("fee_score_contribution"),
    payoutBasis: number("payout_basis"),
    posScoreContribution: number("pos_score_contribution"),
    reconciliationTotalScore: number("reconciliation_total_score"),
  };
}
