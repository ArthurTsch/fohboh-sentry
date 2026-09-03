import {
  centsToDollars,
  clamp,
  dollarsToCents,
  formatCurrency,
  numberValue,
  parseDateValue,
  roundCurrency,
  roundInteger,
  textValue,
} from "./values";

type ModuleId = "M01" | "M02" | "M03";
type Cadence = "monthly_final" | "monthly_preliminary";

type Metrics = {
  adjustmentAmount?: number;
  amexOptBlueVarianceAmount?: number;
  basisAmount?: number;
  chargebackCount?: number;
  commissionRateAppliedAvg?: number;
  depositAmount?: number;
  depositReferenceRows?: ReferenceRow[];
  deliveryFeeAmount?: number;
  deliveryBasisAmount?: number;
  deliveryCommissionAmount?: number;
  deliveryOrderCount?: number;
  duplicateOrderCount?: number;
  duplicateTransactionCount?: number;
  duplicateTransactionAmount?: number;
  errorChargeAmount?: number;
  earlyTerminationFeeAmount?: number;
  feeAmount?: number;
  interchangeFeeAmount?: number;
  interchangeMismatchAmount?: number;
  networkFeeAmount?: number;
  otherAdjustmentAmount?: number;
  processorFeeAmount?: number;
  statementTotalFeeAmount?: number;
  marketingFeeAmount?: number;
  monthlyMetrics?: Record<string, MonthlyMetrics>;
  mcCreditAmount?: number;
  mcCreditFeeAmount?: number;
  mcDebitAmount?: number;
  mcDebitFeeAmount?: number;
  memberOrderCount?: number;
  otherFeeAmount?: number;
  orderCount?: number;
  pickupOrderCount?: number;
  pickupBasisAmount?: number;
  pickupCommissionAmount?: number;
  promoOrderCount?: number;
  payoutAmount?: number;
  payoutReferenceRows?: ReferenceRow[];
  refundCount?: number;
  annualFeeAmount?: number;
  avsDowngradeAmount?: number;
  chargebackFeeAmount?: number;
  cvvDowngradeAmount?: number;
  dccFeeAmount?: number;
  debitSurchargeAmount?: number;
  equipmentRentalFeeAmount?: number;
  internationalFeeExcessAmount?: number;
  lateSettlementDowngradeAmount?: number;
  missedVolumeDiscountAmount?: number;
  monthlyMinimumFeeAmount?: number;
  partialAuthDuplicateAmount?: number;
  pciNonComplianceFeeAmount?: number;
  processorReversalShortfallAmount?: number;
  rateIncreaseVarianceAmount?: number;
  refundProcessingFeeAmount?: number;
  restrictedSurchargeAmount?: number;
  retrievalFeeAmount?: number;
  statementFeeAmount?: number;
  serviceFeeAmount?: number;
  surchargeFeeAmount?: number;
  settlementLagDaysAvg?: number;
  taxRemittedAmount?: number;
  tipAmount?: number;
  transactionCount?: number;
  certificationPeriodDetectedMonths?: string[];
  certificationPeriodExcludedRows?: number;
  certificationPeriodMismatch?: boolean;
  uncontractedFeeAmount?: number;
  voidCount?: number;
  visaCreditAmount?: number;
  visaCreditFeeAmount?: number;
  visaDebitAmount?: number;
  visaDebitFeeAmount?: number;
};

type MonthlyMetrics = {
  adjustmentAmount?: number;
  basisAmount?: number;
  chargebackCount?: number;
  deliveryBasisAmount?: number;
  deliveryCommissionAmount?: number;
  deliveryFeeAmount?: number;
  deliveryOrderCount?: number;
  feeAmount?: number;
  duplicateOrderCount?: number;
  duplicateTransactionCount?: number;
  errorChargeAmount?: number;
  marketingFeeAmount?: number;
  memberOrderCount?: number;
  orderCount?: number;
  otherFeeAmount?: number;
  payoutAmount?: number;
  pickupBasisAmount?: number;
  pickupCommissionAmount?: number;
  pickupOrderCount?: number;
  promoOrderCount?: number;
  refundCount?: number;
  transactionCount?: number;
  voidCount?: number;
};

type ReferenceRow = {
  activityMonth?: string;
  amount: number;
  candidateAmounts?: number[];
  certificationMonthAmount?: number;
  externalRefId: string;
  followingMonthAmount?: number;
  postedDate?: string;
  rowNumber?: number;
  settledDate?: string;
  type?: string;
};

export type Mq6DimensionName =
  | "Data Completeness"
  | "Data Freshness"
  | "Source Authenticity"
  | "Cross-System Reconciliation"
  | "Rule Integrity"
  | "Auditability";

export type Mq6Score = {
  badge: "PASS" | "PARTIAL" | "FAIL";
  detail: string;
  scorePct: number;
};

export type TrustGateName =
  | "TG01"
  | "TG02"
  | "TG03"
  | "TG04"
  | "TG05"
  | "TG06"
  | "TG07"
  | "TG08"
  | "TG09"
  | "TG10"
  | "TG11";

export type TrustGateScore = {
  badge: "PASS" | "PARTIAL" | "FAIL";
  canonicalRuleIds: string[];
  detail: string;
  scorePct: number;
};

export type CertificationZone =
  | "UNVERIFIED"
  | "PROVISIONAL"
  | "CONDITIONAL"
  | "VALIDATED"
  | "CERTIFIED";

export type SystemHealthFlag = "R186" | "R188" | "R191" | "R192";

export type SystemHealthResult = {
  detail: string;
  flags: SystemHealthFlag[];
  healthy: boolean;
  masterSystemHealthy: boolean;
  penaltyPoints: number;
};

export type RuleCitation = {
  disposition: "blocking" | "informational" | "monetary" | "passed";
  firedCount: number;
  ruleId: string;
  ruleVersion: string;
  sampleEvidence: Record<string, unknown>[];
  varianceCents: number;
};

export type FindingClass =
  | "BREACH_OVERCHARGE"
  | "BREACH_UNDERCHARGE"
  | "NO_FINDING"
  | "INCONCLUSIVE";

export type ModuleArtifactState = {
  contractValues?: Record<string, string> | null;
  detectedFormatKey?: string;
  detectedFormatName?: string;
  fields: boolean;
  hash: boolean;
  key: string;
  label: string;
  metrics?: Metrics;
  schema: boolean;
  type: "CSV" | "PDF" | "Manual Entry";
  updatedAt?: string;
  uploaded: boolean;
};

export type ModuleEngineInput = {
  artifacts: ModuleArtifactState[];
  cadence: Cadence;
  certificationMonth?: string;
  evaluationDate: Date;
  moduleId: ModuleId;
  systemHealthFlags?: SystemHealthFlag[];
};

export type ModuleEngineResult = {
  artifactCoverage: number;
  certificationZone: CertificationZone;
  dimensions: Record<Mq6DimensionName, number>;
  findingClass: FindingClass;
  findings: string[];
  mq6: Record<string, Mq6Score>;
  ready: boolean;
  recoveryValue: number;
  reviewedFeeVolume: number;
  ruleCitations: RuleCitation[];
  score: number;
  systemHealth: SystemHealthResult;
  trustGates: Record<TrustGateName, TrustGateScore>;
};

type RuleContext = {
  agreement: ModuleArtifactState | null;
  artifacts: ModuleArtifactState[];
  bank: ModuleArtifactState | null;
  cadence: Cadence;
  contract: Record<string, string> | null;
  evaluationDate: Date;
  moduleId: ModuleId;
  pos: ModuleArtifactState | null;
  statement: ModuleArtifactState | null;
};

function usesSettlementTimingBasis(context: RuleContext) {
  return context.moduleId === "M01" &&
    Boolean(context.pos?.detectedFormatKey?.includes("payout"));
}

type DeterministicRule = {
  evaluate: (context: RuleContext, residualVariance: number) => RuleCitation | null;
  id: string;
  module: ModuleId;
  version: string;
};

const TG_WEIGHTS: Record<TrustGateName, number> = {
  TG01: 8,
  TG02: 6,
  TG03: 5,
  TG04: 12,
  TG05: 7,
  TG06: 8,
  TG07: 25,
  TG08: 9,
  TG09: 8,
  TG10: 6,
  TG11: 6,
};

const RULE_VERSION = "mge-v1.0.0";

const M01_RULES: DeterministicRule[] = [
  {
    id: "MFR-INT-12",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) =>
      evaluateCardDowngradeRule({
        actualAmountKey: "visaDebitAmount",
        actualFeeKey: "visaDebitFeeAmount",
        cardBrand: "visa_debit",
        context,
        residualVariance,
        ruleId: "MFR-INT-12",
      }),
  },
  {
    id: "MFR-INT-14",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) =>
      evaluateCardDowngradeRule({
        actualAmountKey: "mcDebitAmount",
        actualFeeKey: "mcDebitFeeAmount",
        cardBrand: "mastercard_debit",
        context,
        residualVariance,
        ruleId: "MFR-INT-14",
      }),
  },
  {
    id: "MFR-INT-22",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const pricingModel = String(contract.pricing_model ?? contract.contract_type ?? "").toLowerCase();
      const surchargePool = numberValue(statement.otherFeeAmount) + numberValue(statement.serviceFeeAmount);
      if (pricingModel.includes("tier") || surchargePool <= 1) return null;
      const variance = Math.min(roundCurrency(surchargePool * 0.35), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-INT-22", 1, variance, {
        pricing_model: pricingModel || "unspecified",
        surcharge_pool: surchargePool,
      });
    },
  },
  {
    id: "MFR-INT-23",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const feeMetrics = resolveM01FeeCalculationMetrics(context);
      const expectedTotal = computeExpectedM01Fees(feeMetrics, contract);
      const actualFees = resolveM01ComparableFee(statement);
      const markupVariance = Math.max(0, actualFees - expectedTotal);
      if (markupVariance <= 1) return null;
      const debitAmount = numberValue(statement.visaDebitAmount) + numberValue(statement.mcDebitAmount);
      if (debitAmount <= 0) return null;
      const variance = Math.min(roundCurrency(markupVariance * 0.4), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-INT-23", 1, variance, {
        debit_volume: debitAmount,
        expected_total: expectedTotal,
        observed_total: actualFees,
      });
    },
  },
  {
    id: "MFR-BIL-15",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract) return null;
      const actualFees = resolveM01ComparableFee(statement);
      const feeMetrics = resolveM01FeeCalculationMetrics(context);
      const expectedTotal = computeExpectedM01Fees(feeMetrics, contract);
      const unexplained = roundCurrency(actualFees - expectedTotal);
      if (unexplained <= 1 || residualVariance <= 1) return null;
      const variance = Math.min(unexplained, residualVariance);
      return {
        disposition: "monetary",
        firedCount: 1,
        ruleId: "MFR-BIL-15",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [buildM01FeeGapSample({ ...statement, ...feeMetrics }, contract, actualFees, expectedTotal, variance)],
        varianceCents: dollarsToCents(variance),
      };
    },
  },
  {
    id: "MFR-MRK-03",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract) return null;
      const basisAmount = numberValue(statement.basisAmount);
      const markupBps = numberValue(contract.markup_bps);
      const actualFees = resolveM01ComparableFee(statement);
      const txnFee = numberValue(contract.txn_fee);
      const monthlyFee = numberValue(contract.monthly_fee);
      const interchangeFees = resolveM01ComparableInterchange(statement);
      const transactionCount = Math.max(0, roundCurrency(numberValue(statement.transactionCount)));
      if (basisAmount <= 0 || markupBps <= 0 || actualFees <= 0 || residualVariance <= 1) return null;
      const observedRateBps =
        ((actualFees - interchangeFees - transactionCount * txnFee - monthlyFee) / Math.max(basisAmount, 1)) * 10000;
      const excessRateBps = observedRateBps - markupBps;
      if (excessRateBps <= 5) return null;
      const variance = Math.min(roundCurrency((basisAmount * excessRateBps) / 10000), residualVariance);
      if (variance <= 1) return null;
      return {
        disposition: "monetary",
        firedCount: 1,
        ruleId: "MFR-MRK-03",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          actual_rate_bps: roundCurrency(observedRateBps),
          basis_amount: basisAmount,
          contracted_markup_bps: markupBps,
          excess_rate_bps: roundCurrency(excessRateBps),
          observed_interchange_fees: interchangeFees,
        }],
        varianceCents: dollarsToCents(variance),
      };
    },
  },
  {
    id: "MFR-MRK-05",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract) return null;
      const actualFees = resolveM01ComparableFee(statement);
      const transactionCount = Math.max(0, roundCurrency(numberValue(statement.transactionCount)));
      const txnFee = numberValue(contract.txn_fee);
      if (actualFees <= 0 || transactionCount <= 0 || residualVariance <= 1) return null;
      const observedPerTxn = actualFees / Math.max(transactionCount, 1);
      const excessPerTxn = observedPerTxn - txnFee;
      if (txnFee <= 0 || excessPerTxn <= 0.02) return null;
      const variance = Math.min(roundCurrency(excessPerTxn * transactionCount), residualVariance);
      if (variance <= 1) return null;
      return {
        disposition: "monetary",
        firedCount: 1,
        ruleId: "MFR-MRK-05",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          contracted_per_txn_fee: txnFee,
          excess_per_txn_fee: roundCurrency(excessPerTxn),
          observed_per_txn_fee: roundCurrency(observedPerTxn),
          transaction_count: transactionCount,
        }],
        varianceCents: dollarsToCents(variance),
      };
    },
  },
  {
    id: "MFR-VOL-08",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) =>
      evaluateVolumeTierRule(context, residualVariance, "MFR-VOL-08", 0.12, 0.25),
  },
  {
    id: "MFR-VOL-09",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) =>
      evaluateVolumeTierRule(context, residualVariance, "MFR-VOL-09", 0.18, 0.4),
  },
  {
    id: "MFR-BIL-16",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const monthlyFee = numberValue(contract.monthly_fee);
      const extras = Math.max(0, numberValue(statement.otherFeeAmount) + numberValue(statement.serviceFeeAmount) - monthlyFee);
      if (extras <= 1) return null;
      const variance = Math.min(roundCurrency(extras * 0.25), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-BIL-16", 1, variance, {
        contracted_monthly_fee: monthlyFee,
        extra_billing_pool: roundCurrency(numberValue(statement.otherFeeAmount) + numberValue(statement.serviceFeeAmount)),
      });
    },
  },
  {
    id: "MFR-BIL-17",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const monthlyFee = numberValue(contract.monthly_fee);
      const actualFees = resolveM01ComparableFee(statement);
      if (monthlyFee <= 0 || actualFees <= monthlyFee) return null;
      const variance = Math.min(roundCurrency(Math.max(0, actualFees - monthlyFee) * 0.08), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-BIL-17", 1, variance, {
        contracted_monthly_minimum: monthlyFee,
        observed_total_fees: actualFees,
      });
    },
  },
  {
    id: "MFR-CBK-04",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const chargebackCount = numberValue(statement.chargebackCount);
      const chargebackFee = numberValue(contract.chargeback_fee);
      const refundCount = numberValue(statement.refundCount);
      if (chargebackCount <= 0 || chargebackFee <= 0 || refundCount <= 0) return null;
      const lateChargebacks = Math.min(chargebackCount, Math.max(1, Math.floor(refundCount / 2)));
      const variance = Math.min(roundCurrency(lateChargebacks * chargebackFee), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-CBK-04", lateChargebacks, variance, {
        chargeback_count: chargebackCount,
        chargeback_fee: chargebackFee,
        refund_count: refundCount,
      });
    },
  },
  {
    id: "MFR-CBK-05",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const chargebackCount = numberValue(statement.chargebackCount);
      const transactionCount = numberValue(statement.transactionCount);
      const chargebackFee = numberValue(contract.chargeback_fee);
      if (chargebackCount <= transactionCount || chargebackFee <= 0) return null;
      const orphaned = Math.max(1, Math.round(chargebackCount - transactionCount));
      const variance = Math.min(roundCurrency(orphaned * chargebackFee), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-CBK-05", orphaned, variance, {
        chargeback_count: chargebackCount,
        transaction_count: transactionCount,
      });
    },
  },
  {
    id: "MFR-RES-02",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const basisAmount = numberValue(statement.basisAmount);
      const feeAmount = numberValue(statement.feeAmount);
      const depositAmount = numberValue(statement.depositAmount || statement.payoutAmount);
      if (basisAmount <= 0 || depositAmount <= 0) return null;
      const impliedReserve = basisAmount - feeAmount - depositAmount;
      if (impliedReserve <= basisAmount * 0.02) return null;
      const variance = Math.min(roundCurrency(impliedReserve), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-RES-02", 1, variance, {
        implied_reserve_amount: impliedReserve,
        gross_amount: basisAmount,
        net_deposit_amount: depositAmount,
      });
    },
  },
  {
    id: "MFR-AVS-01",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const serviceFeePool = numberValue(statement.serviceFeeAmount);
      const transactionCount = numberValue(statement.transactionCount);
      if (serviceFeePool <= 1 || transactionCount <= 0) return null;
      const avsVariance = Math.min(roundCurrency(serviceFeePool * 0.15), residualVariance);
      if (avsVariance <= 1) return null;
      return buildCitation("MFR-AVS-01", Math.max(1, Math.round(transactionCount * 0.05)), avsVariance, {
        service_fee_pool: serviceFeePool,
        transaction_count: transactionCount,
      });
    },
  },
  {
    id: "MFR-VOID-03",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const voidCount = numberValue(statement.voidCount);
      const transactionCount = Math.max(1, numberValue(statement.transactionCount));
      const feeAmount = resolveM01ComparableFee(statement);
      if (voidCount <= 0 || feeAmount <= 0) return null;
      const avgFee = feeAmount / transactionCount;
      const variance = Math.min(roundCurrency(avgFee * voidCount), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-VOID-03", Math.round(voidCount), variance, {
        average_fee: roundCurrency(avgFee),
        void_count: voidCount,
      });
    },
  },
  {
    id: "MFR-RFD-01",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const refundCount = numberValue(statement.refundCount);
      const feeAmount = resolveM01ComparableFee(statement);
      const transactionCount = Math.max(1, numberValue(statement.transactionCount));
      if (refundCount <= 0 || feeAmount <= 0) return null;
      const avgFee = feeAmount / transactionCount;
      const variance = Math.min(roundCurrency(avgFee * refundCount * 0.6), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-RFD-01", Math.round(refundCount), variance, {
        average_fee: roundCurrency(avgFee),
        refund_count: refundCount,
      });
    },
  },
  {
    id: "MFR-FEE-21",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const extraFees = numberValue(statement.otherFeeAmount) + numberValue(statement.serviceFeeAmount);
      if (extraFees <= 1) return null;
      const variance = Math.min(roundCurrency(extraFees * 0.1), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("MFR-FEE-21", 1, variance, {
        extra_fee_pool: roundCurrency(extraFees),
      });
    },
  },
  {
    id: "R060",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const duplicateTransactionCount = numberValue(statement.duplicateTransactionCount);
      const duplicateTransactionAmount = numberValue(statement.duplicateTransactionAmount);
      if (duplicateTransactionCount <= 0 || duplicateTransactionAmount <= 0) return null;
      const variance = Math.min(roundCurrency(duplicateTransactionAmount), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R060", Math.round(duplicateTransactionCount), variance, {
        duplicate_transaction_amount: duplicateTransactionAmount,
        duplicate_transaction_count: duplicateTransactionCount,
      });
    },
  },
  {
    id: "R064",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const rateTable = getM01RateTable(contract);
      const expectedVisaCredit = computeCardBrandFee(
        numberValue(statement.visaCreditAmount),
        rateTable.visa_credit.ratePct,
        rateTable.visa_credit.fixedCents,
      );
      const expectedMcCredit = computeCardBrandFee(
        numberValue(statement.mcCreditAmount),
        rateTable.mastercard_credit.ratePct,
        rateTable.mastercard_credit.fixedCents,
      );
      const observedVisaCredit = numberValue(statement.visaCreditFeeAmount);
      const observedMcCredit = numberValue(statement.mcCreditFeeAmount);
      const visaRateGoverned = numberValue(contract.visa_credit_rate_pct) > 0;
      const mcRateGoverned = numberValue(contract.mastercard_credit_rate_pct) > 0;
      if ((observedVisaCredit > 0 && !visaRateGoverned) || (observedMcCredit > 0 && !mcRateGoverned)) {
        return null;
      }
      const totalExcess = Math.max(0, observedVisaCredit - expectedVisaCredit) + Math.max(0, observedMcCredit - expectedMcCredit);
      if (totalExcess <= 1) return null;
      const variance = Math.min(roundCurrency(totalExcess), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R064", 1, variance, {
        expected_mc_credit_fee: expectedMcCredit,
        expected_visa_credit_fee: expectedVisaCredit,
        observed_mc_credit_fee: observedMcCredit,
        observed_visa_credit_fee: observedVisaCredit,
      });
    },
  },
  {
    id: "R086",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const reversalShortfall = numberValue(statement.processorReversalShortfallAmount);
      if (reversalShortfall <= 1) return null;
      const variance = Math.min(roundCurrency(reversalShortfall), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R086", 1, variance, {
        processor_reversal_shortfall_amount: reversalShortfall,
        note: "A processor reversal was identified and its amount is below the originally certified variance.",
      });
    },
  },
  {
    id: "R063",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const lagDays = numberValue(context.statement?.metrics?.settlementLagDaysAvg);
      const downgradeAmount = numberValue(context.statement?.metrics?.lateSettlementDowngradeAmount);
      if (lagDays <= 2 || downgradeAmount <= 0 || residualVariance <= 1) return null;
      const variance = Math.min(roundCurrency(downgradeAmount), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R063", 1, variance, {
        average_settlement_lag_days: lagDays,
        late_settlement_downgrade_amount: downgradeAmount,
      });
    },
  },
  {
    id: "R068",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const monthlyFee = numberValue(contract.monthly_fee);
      const minimumFeeCharged = numberValue(statement.monthlyMinimumFeeAmount);
      if (monthlyFee <= 0 || minimumFeeCharged <= 0) return null;
      const variance = Math.min(roundCurrency(minimumFeeCharged), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R068", 1, variance, {
        contracted_monthly_minimum: monthlyFee,
        observed_monthly_minimum_fee: minimumFeeCharged,
      });
    },
  },
  {
    id: "R070",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) =>
      evaluateVolumeTierRule(context, residualVariance, "R070", 0.1, 0.3),
  },
  {
    id: "R072",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const refundCount = numberValue(statement?.refundCount);
      const refundFeeAmount = numberValue(statement?.refundProcessingFeeAmount);
      if (!statement || refundCount <= 0 || refundFeeAmount <= 0 || residualVariance <= 1) return null;
      const variance = Math.min(roundCurrency(refundFeeAmount), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R072", Math.round(refundCount), variance, {
        refund_processing_fee_amount: refundFeeAmount,
        refund_count: refundCount,
      });
    },
  },
  {
    id: "R073",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const chargebackCount = numberValue(context.statement?.metrics?.chargebackCount);
      const chargebackFeeCap = numberValue(context.contract?.chargeback_fee);
      const observedChargebackFees = numberValue(context.statement?.metrics?.chargebackFeeAmount);
      if (chargebackCount <= 0 || chargebackFeeCap <= 0 || observedChargebackFees <= 0 || residualVariance <= 1) return null;
      const variance = Math.min(
        roundCurrency(Math.max(0, observedChargebackFees - chargebackCount * chargebackFeeCap)),
        residualVariance,
      );
      if (variance <= 1) return null;
      return buildCitation("R073", Math.round(chargebackCount), variance, {
        chargeback_count: chargebackCount,
        contracted_chargeback_fee_cap: chargebackFeeCap,
        observed_chargeback_fees: observedChargebackFees,
      });
    },
  },
  {
    id: "R075",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const pciFeeAmount = numberValue(statement.pciNonComplianceFeeAmount);
      if (!truthyContractFlag(contract, "pci_compliant") || pciFeeAmount <= 0) return null;
      const variance = Math.min(roundCurrency(pciFeeAmount), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R075", 1, variance, {
        pci_compliant: true,
        pci_non_compliance_fee_amount: pciFeeAmount,
      });
    },
  },
  {
    id: "R078",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const basisAmount = numberValue(statement.basisAmount);
      const markupBps = numberValue(contract.markup_bps);
      const feeAmount = resolveM01ComparableFee(statement);
      const txnFee = numberValue(contract.txn_fee);
      const monthlyFee = numberValue(contract.monthly_fee);
      const interchangeFees = resolveM01ComparableInterchange(statement);
      const transactionCount = Math.max(0, roundCurrency(numberValue(statement.transactionCount)));
      if (basisAmount <= 0 || markupBps <= 0 || feeAmount <= 0) return null;
      const observedRateBps =
        ((feeAmount - interchangeFees - transactionCount * txnFee - monthlyFee) / Math.max(basisAmount, 1)) * 10000;
      const excessRateBps = observedRateBps - markupBps;
      if (excessRateBps <= 0) return null;
      const variance = Math.min(roundCurrency((basisAmount * excessRateBps) / 10000), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R078", 1, variance, {
        contracted_markup_bps: markupBps,
        excess_rate_bps: roundCurrency(excessRateBps),
        observed_interchange_fees: interchangeFees,
        observed_rate_bps: roundCurrency(observedRateBps),
      });
    },
  },
  {
    id: "R083",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const statementFeeAmount = numberValue(statement.statementFeeAmount);
      const contractedStatementFee = numberValue(contract.statement_fee_amount);
      const electronicStatements = truthyContractFlag(contract, "electronic_statements_enabled");
      const excess = electronicStatements
        ? statementFeeAmount
        : Math.max(0, statementFeeAmount - contractedStatementFee);
      if (excess <= 1) return null;
      const variance = Math.min(roundCurrency(excess), residualVariance);
      return buildCitation("R083", 1, variance, {
        contracted_statement_fee: contractedStatementFee,
        electronic_statements_enabled: electronicStatements,
        observed_statement_fee: statementFeeAmount,
      });
    },
  },
  {
    id: "R085",
    module: "M01",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const basisAmount = numberValue(statement.basisAmount);
      const rateIncreaseVariance = numberValue(statement.rateIncreaseVarianceAmount);
      if (basisAmount <= 0 || rateIncreaseVariance <= 0 || !truthyContractFlag(contract, "rate_increase_notice_missing")) return null;
      const variance = Math.min(roundCurrency(rateIncreaseVariance), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R085", 1, variance, {
        basis_amount: basisAmount,
        rate_increase_notice_missing: true,
        rate_increase_variance_amount: rateIncreaseVariance,
      });
    },
  },
];

const M02_RULES: DeterministicRule[] = [
  {
    id: "DSP-COM-04",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract) return null;
      const actualCommission = computeActualM02Commission(statement);
      const expectedRate = computeExpectedM02Rate(contract, statement);
      const basisAmount = resolveM02ContractBase(statement, context.pos?.metrics, contract);
      if (actualCommission <= 0 || expectedRate <= 0 || basisAmount <= 0 || residualVariance <= 1) return null;
      const observedRate = (actualCommission / Math.max(basisAmount, 1)) * 100;
      const variance = Math.min(
        roundCurrency(Math.max(0, actualCommission - basisAmount * (expectedRate / 100))),
        residualVariance,
      );
      if (observedRate <= expectedRate + 0.5 || variance <= 1) return null;
      return {
        disposition: "monetary",
        firedCount: 1,
        ruleId: "DSP-COM-04",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          actual_commission: actualCommission,
          commission_base_amount: basisAmount,
          contracted_rate_pct: expectedRate,
          observed_rate_pct: roundCurrency(observedRate),
        }],
        varianceCents: dollarsToCents(variance),
      };
    },
  },
  {
    id: "DSP-COM-05",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const pos = context.pos?.metrics;
      const contract = context.contract;
      if (!statement || !pos || !contract) return null;
      const expectedRate = computeExpectedM02Rate(contract, statement);
      const statementBasis = resolveComparableM02StatementBasis(statement, pos);
      const posBasis = numberValue(pos.basisAmount);
      const actualCommission = computeActualM02Commission(statement);
      if (
        expectedRate <= 0 ||
        statementBasis <= 0 ||
        posBasis <= 0 ||
        actualCommission <= 0 ||
        residualVariance <= 1
      ) {
        return null;
      }
      const wrongBaseDelta = statementBasis - posBasis;
      if (wrongBaseDelta <= Math.max(statementBasis, posBasis) * 0.05) return null;
      const variance = Math.min(
        roundCurrency(Math.max(0, wrongBaseDelta * (expectedRate / 100))),
        residualVariance,
      );
      if (variance <= 1) return null;
      return {
        disposition: "monetary",
        firedCount: 1,
        ruleId: "DSP-COM-05",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          commission_base_field: contract.commission_base ?? "unknown",
          expected_commission_base: posBasis,
          observed_commission_base: statementBasis,
          rate_pct: expectedRate,
        }],
        varianceCents: dollarsToCents(variance),
      };
    },
  },
  {
    id: "DSP-COM-06",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const taxRemitted = numberValue(statement.taxRemittedAmount);
      const actualCommission = computeActualM02Commission(statement);
      const expectedRate = computeExpectedM02Rate(contract, statement);
      const taxRemit = String(contract.tax_remit ?? "").toLowerCase();
      if (taxRemitted <= 0 || actualCommission <= 0 || expectedRate <= 0 || taxRemit === "no") return null;
      const taxableVariance = roundCurrency(taxRemitted * (expectedRate / 100));
      const variance = Math.min(taxableVariance, residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-COM-06", 1, variance, {
        contracted_rate_pct: expectedRate,
        tax_remit_mode: taxRemit || "unknown",
        tax_remitted_amount: taxRemitted,
      });
    },
  },
  {
    id: "DSP-COM-07",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const tipAmount = numberValue(statement.tipAmount);
      const actualCommission = computeActualM02Commission(statement);
      const expectedRate = computeExpectedM02Rate(contract, statement);
      if (tipAmount <= 0 || actualCommission <= 0 || expectedRate <= 0) return null;
      const tipVariance = roundCurrency(tipAmount * (expectedRate / 100));
      const variance = Math.min(tipVariance, residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-COM-07", 1, variance, {
        contracted_rate_pct: expectedRate,
        tip_amount: tipAmount,
      });
    },
  },
  {
    id: "DSP-PRM-02",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const marketingFee = numberValue(statement.marketingFeeAmount);
      const promoOrders = Math.max(1, numberValue(statement.promoOrderCount));
      const marketingFeePct = numberValue(contract.marketing_fee_pct);
      if (marketingFee <= 0 || marketingFeePct <= 0) return null;
      const variance = Math.min(roundCurrency(marketingFee), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-PRM-02", Math.round(promoOrders), variance, {
        marketing_fee_amount: marketingFee,
        marketing_fee_pct: marketingFeePct,
        promo_order_count: promoOrders,
      });
    },
  },
  {
    id: "DSP-PRM-03",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const promoAdjustments = numberValue(statement.adjustmentAmount);
      const promoOrders = numberValue(statement.promoOrderCount);
      if (promoOrders <= 0 || promoAdjustments <= 0) return null;
      const variance = Math.min(roundCurrency(promoAdjustments), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-PRM-03", Math.round(promoOrders), variance, {
        promo_adjustments: promoAdjustments,
        promo_order_count: promoOrders,
      });
    },
  },
  {
    id: "DSP-RFD-07",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const refundCount = numberValue(statement.refundCount);
      const adjustmentAmount = numberValue(statement.adjustmentAmount);
      const payoutFreq = String(contract.payout_freq ?? "").toLowerCase();
      if (refundCount <= 0 || adjustmentAmount <= 0) return null;
      const multiplier = payoutFreq.includes("monthly") ? 0.75 : payoutFreq.includes("weekly") ? 0.5 : 0.4;
      const variance = Math.min(roundCurrency(adjustmentAmount * multiplier), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-RFD-07", Math.round(refundCount), variance, {
        adjustment_amount: adjustmentAmount,
        payout_frequency: payoutFreq || "unknown",
        refund_count: refundCount,
      });
    },
  },
  {
    id: "DSP-RFD-08",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const refundCount = numberValue(statement.refundCount);
      const basisAmount = resolveM02ContractBase(statement, context.pos?.metrics, contract);
      const statementBasis = numberValue(statement.basisAmount);
      const expectedRate = computeExpectedM02Rate(contract, statement);
      if (refundCount <= 0 || basisAmount <= 0 || statementBasis <= basisAmount || expectedRate <= 0) return null;
      const wrongBase = statementBasis - basisAmount;
      const variance = Math.min(roundCurrency(wrongBase * (expectedRate / 100) * 0.5), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-RFD-08", Math.round(refundCount), variance, {
        contracted_base: basisAmount,
        refund_count: refundCount,
        statement_basis: statementBasis,
      });
    },
  },
  {
    id: "DSP-DUP-01",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const pos = context.pos?.metrics;
      if (!statement || !pos || residualVariance <= 1) return null;
      const { statementOrderCount: statementOrders, posOrderCount: posOrders } =
        resolveComparableM02OrderCounts(statement, pos);
      if (statementOrders <= 0 || posOrders <= 0 || statementOrders <= posOrders) return null;
      const duplicateCount = statementOrders - posOrders;
      if (duplicateCount < 2) return null;
      const avgFeePerOrder = computeActualM02Commission(statement) / Math.max(statementOrders, 1);
      const variance = Math.min(roundCurrency(avgFeePerOrder * duplicateCount), residualVariance);
      if (variance <= 1) return null;
      return {
        disposition: "monetary",
        firedCount: duplicateCount,
        ruleId: "DSP-DUP-01",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          duplicate_order_count: duplicateCount,
          pos_order_count: posOrders,
          statement_order_count: statementOrders,
        }],
        varianceCents: dollarsToCents(variance),
      };
    },
  },
  {
    id: "DSP-VAR-11",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract) return null;
      const actualCommission = computeActualM02Commission(statement);
      const basisAmount = numberValue(statement.basisAmount);
      const expectedRate = computeExpectedM02Rate(contract, statement);
      if (actualCommission <= 0 || basisAmount <= 0 || expectedRate <= 0 || residualVariance <= 1) return null;
      const observedRate = (actualCommission / Math.max(basisAmount, 1)) * 100;
      const varianceBand = Math.abs(observedRate - expectedRate);
      if (varianceBand <= 1) return null;
      const variance = Math.min(
        roundCurrency(Math.max(0, actualCommission - basisAmount * (expectedRate / 100))),
        residualVariance,
      );
      if (variance <= 1) return null;
      return {
        disposition: "monetary",
        firedCount: 1,
        ruleId: "DSP-VAR-11",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          actual_commission: actualCommission,
          basis_amount: basisAmount,
          contracted_rate_pct: expectedRate,
          effective_rate_variance_pct: roundCurrency(varianceBand),
        }],
        varianceCents: dollarsToCents(variance),
      };
    },
  },
  {
    id: "DSP-DEL-04",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const pickupOrders = numberValue(statement.pickupOrderCount);
      const orderCount = Math.max(1, numberValue(statement.orderCount));
      const deliveryFeeAmount = numberValue(statement.deliveryFeeAmount);
      if (pickupOrders <= 0 || deliveryFeeAmount <= 0) return null;
      const variance = Math.min(roundCurrency(deliveryFeeAmount * (pickupOrders / orderCount)), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-DEL-04", Math.round(pickupOrders), variance, {
        delivery_fee_amount: deliveryFeeAmount,
        order_count: orderCount,
        pickup_order_count: pickupOrders,
      });
    },
  },
  {
    id: "DSP-DASH-02",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const memberOrders = numberValue(statement.memberOrderCount);
      const orderCount = Math.max(1, numberValue(statement.orderCount));
      const rateDelivery = numberValue(contract.rate_delivery);
      const rateMember = numberValue(contract.rate_member);
      const basisAmount = numberValue(statement.basisAmount);
      if (memberOrders <= 0 || rateDelivery <= 0 || rateMember <= 0 || rateDelivery <= rateMember || basisAmount <= 0) {
        return null;
      }
      const memberBasis = basisAmount * (memberOrders / orderCount);
      const variance = Math.min(roundCurrency(memberBasis * ((rateDelivery - rateMember) / 100)), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("DSP-DASH-02", Math.round(memberOrders), variance, {
        delivery_rate_pct: rateDelivery,
        member_order_count: memberOrders,
        member_rate_pct: rateMember,
      });
    },
  },
  {
    id: "R023",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const duplicateOrderCount = numberValue(statement.duplicateOrderCount);
      const actualCommission = computeActualM02Commission(statement);
      const orderCount = Math.max(1, numberValue(statement.orderCount) || numberValue(statement.transactionCount));
      if (duplicateOrderCount <= 0 || actualCommission <= 0) return null;
      const averageCommission = actualCommission / orderCount;
      const variance = Math.min(roundCurrency(averageCommission * duplicateOrderCount), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R023", Math.round(duplicateOrderCount), variance, {
        average_commission: roundCurrency(averageCommission),
        duplicate_order_count: duplicateOrderCount,
        order_count: orderCount,
      });
    },
  },
  {
    id: "R024",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const pos = context.pos?.metrics;
      if (!statement || !pos || residualVariance <= 1) return null;
      const { statementOrderCount: statementOrders, posOrderCount: posOrders } =
        resolveComparableM02OrderCounts(statement, pos);
      const orderDelta = Math.max(0, Math.abs(statementOrders - posOrders));
      const actualCommission = computeActualM02Commission(statement);
      if (statementOrders <= 0 || posOrders <= 0 || orderDelta < 3 || actualCommission <= 0) return null;
      const averageCommission = actualCommission / Math.max(statementOrders, 1);
      const variance = Math.min(roundCurrency(averageCommission * orderDelta), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R024", Math.round(orderDelta), variance, {
        order_count_delta: orderDelta,
        pos_order_count: posOrders,
        statement_order_count: statementOrders,
      });
    },
  },
  {
    id: "R034",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      if (!statement || residualVariance <= 1) return null;
      const errorChargeAmount = numberValue(statement.errorChargeAmount);
      const basisAmount = numberValue(statement.basisAmount);
      if (errorChargeAmount <= 1) return null;
      const errorRatePct = basisAmount > 0 ? (errorChargeAmount / basisAmount) * 100 : 0;
      const variance = Math.min(roundCurrency(errorChargeAmount), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R034", 1, variance, {
        basis_amount: basisAmount,
        error_charge_amount: errorChargeAmount,
        error_rate_pct: roundCurrency(errorRatePct),
      });
    },
  },
  {
    id: "R038",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const marketingFeeAmount = numberValue(statement.marketingFeeAmount);
      const promoOrderCount = numberValue(statement.promoOrderCount);
      const basisAmount = numberValue(statement.basisAmount);
      const marketingFeePct = numberValue(contract.marketing_fee_pct);
      if (marketingFeeAmount <= 1) return null;
      const expectedMarketingFee = marketingFeePct > 0 && basisAmount > 0
        ? roundCurrency(basisAmount * (marketingFeePct / 100))
        : 0;
      const unsupportedFee = promoOrderCount <= 0 ? marketingFeeAmount : 0;
      const excessFee = Math.max(0, marketingFeeAmount - expectedMarketingFee);
      const variance = Math.min(roundCurrency(Math.max(unsupportedFee, excessFee)), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R038", Math.max(1, Math.round(promoOrderCount)), variance, {
        expected_marketing_fee: expectedMarketingFee,
        marketing_fee_amount: marketingFeeAmount,
        promo_order_count: promoOrderCount,
      });
    },
  },
  {
    id: "R025",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const lagDays = numberValue(context.statement?.metrics?.settlementLagDaysAvg);
      const payoutAmount = numberValue(context.statement?.metrics?.payoutAmount);
      if (lagDays <= 3 || payoutAmount <= 0 || residualVariance <= 1) return null;
      const variance = Math.min(roundCurrency(payoutAmount * Math.min((lagDays - 3) * 0.002, 0.04)), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R025", 1, variance, {
        average_settlement_lag_days: lagDays,
        payout_amount: payoutAmount,
      });
    },
  },
  {
    id: "R035",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const actualCommission = computeActualM02Commission(statement);
      const basisAmount = resolveM02ContractBase(statement, context.pos?.metrics, contract);
      const expectedRate = computeExpectedM02Rate(contract, statement);
      if (actualCommission <= 0 || basisAmount <= 0 || expectedRate <= 0) return null;
      const observedRate = (actualCommission / basisAmount) * 100;
      const maxAllowedRate = expectedRate + 1.5;
      if (observedRate <= maxAllowedRate) return null;
      const variance = Math.min(
        roundCurrency(basisAmount * ((observedRate - maxAllowedRate) / 100)),
        residualVariance,
      );
      if (variance <= 1) return null;
      return buildCitation("R035", 1, variance, {
        contracted_rate_pct: expectedRate,
        max_allowed_rate_pct: maxAllowedRate,
        observed_rate_pct: roundCurrency(observedRate),
      });
    },
  },
  {
    id: "R036",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statementBasis = resolveComparableM02StatementBasis(
        context.statement?.metrics,
        context.pos?.metrics,
      );
      const posBasis = numberValue(context.pos?.metrics?.basisAmount);
      const actualCommission = computeActualM02Commission(context.statement?.metrics ?? {});
      if (statementBasis <= 0 || posBasis <= 0 || actualCommission <= 0 || residualVariance <= 1) return null;
      const deltaPct = relativeDelta(statementBasis, posBasis);
      if (deltaPct <= 0.1) return null;
      const variance = Math.min(roundCurrency(actualCommission * Math.min(deltaPct, 0.5)), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R036", 1, variance, {
        cross_platform_delta_pct: roundCurrency(deltaPct * 100),
        pos_basis_amount: posBasis,
        settlement_basis_amount: statementBasis,
      });
    },
  },
  {
    id: "R041",
    module: "M02",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const statement = context.statement?.metrics;
      const contract = context.contract;
      if (!statement || !contract || residualVariance <= 1) return null;
      const memberOrders = numberValue(statement.memberOrderCount);
      const orderCount = Math.max(1, numberValue(statement.orderCount));
      const rateDelivery = numberValue(contract.rate_delivery);
      const rateMember = numberValue(contract.rate_member);
      const basisAmount = numberValue(statement.basisAmount);
      if (memberOrders <= 0 || rateDelivery <= 0 || rateMember <= 0 || rateDelivery <= rateMember || basisAmount <= 0) {
        return null;
      }
      const memberBasis = basisAmount * (memberOrders / orderCount);
      const variance = Math.min(roundCurrency(memberBasis * ((rateDelivery - rateMember) / 100)), residualVariance);
      if (variance <= 1) return null;
      return buildCitation("R041", Math.round(memberOrders), variance, {
        delivery_rate_pct: rateDelivery,
        member_rate_pct: rateMember,
        subscription_order_count: memberOrders,
      });
    },
  },
];

const M03_RULES: DeterministicRule[] = [
  {
    id: "R099",
    module: "M03",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const pos = context.pos?.metrics;
      const contract = context.contract;
      if (!pos || !contract || residualVariance <= 1) return null;
      const certifiedGrossSales = resolveM03CertifiedGrossSales(pos, contract);
      const royaltyRate = numberValue(contract.royalty_rate_pct);
      const reportedRoyalty = numberValue(context.statement?.metrics?.feeAmount);
      if (certifiedGrossSales <= 0 || royaltyRate <= 0 || reportedRoyalty <= 0) return null;
      const requiredRoyalty = computeExpectedM03Royalty(certifiedGrossSales, contract);
      const variance = Math.min(
        roundCurrency(Math.max(0, requiredRoyalty - reportedRoyalty)),
        residualVariance,
      );
      if (variance <= 1) return null;
      return buildCitation("R099", 1, variance, {
        certified_gross_sales: certifiedGrossSales,
        reported_remittance: reportedRoyalty,
        required_royalty: requiredRoyalty,
        royalty_rate_pct: royaltyRate,
      });
    },
  },
  {
    id: "R101",
    module: "M03",
    version: RULE_VERSION,
    evaluate: (context, residualVariance) => {
      const pos = context.pos?.metrics;
      const contract = context.contract;
      if (!pos || !contract || residualVariance <= 1) return null;
      const certifiedGrossSales = resolveM03CertifiedGrossSales(pos, contract);
      const marketingRate = numberValue(contract.marketing_fund_rate_pct);
      const reportedMarketing = numberValue(
        context.statement?.metrics?.marketingFeeAmount || context.statement?.metrics?.otherFeeAmount,
      );
      if (certifiedGrossSales <= 0 || marketingRate <= 0 || reportedMarketing <= 0) return null;
      const requiredMarketing = computeExpectedM03MarketingFund(certifiedGrossSales, contract);
      const variance = Math.min(
        roundCurrency(Math.max(0, requiredMarketing - reportedMarketing)),
        residualVariance,
      );
      if (variance <= 1) return null;
      return buildCitation("R101", 1, variance, {
        certified_gross_sales: certifiedGrossSales,
        marketing_fund_rate_pct: marketingRate,
        reported_marketing_remittance: reportedMarketing,
        required_marketing_fund: requiredMarketing,
      });
    },
  },
];

export function getRuleSetVersion(cadence: Cadence) {
  return cadence === "monthly_preliminary" ? "mge-v1.0.0-monthly-prelim" : RULE_VERSION;
}

export function ruleAppliesToModule(ruleId: string, moduleId: "M01" | "M02" | "M03") {
  const canonicalMatch = /^R(\d{3})$/.exec(ruleId);
  if (canonicalMatch) {
    const ruleNumber = Number(canonicalMatch[1]);
    if (ruleNumber >= 16 && ruleNumber <= 55) return moduleId === "M02";
    if (ruleNumber >= 56 && ruleNumber <= 95) return moduleId === "M01";
    if (ruleNumber >= 96 && ruleNumber <= 115) return moduleId === "M03";
    if (ruleNumber >= 166 && ruleNumber <= 175) return false;
    return true;
  }

  if (ruleId.startsWith("DSP-")) return moduleId === "M02";
  if (ruleId.startsWith("MFR-")) return moduleId === "M01";
  if (ruleId.startsWith("ROY-") || ruleId.startsWith("M03-")) return moduleId === "M03";
  return true;
}

export function runDeterministicModuleEngine(input: ModuleEngineInput): ModuleEngineResult {
  const statementToken =
    input.moduleId === "M01"
      ? "processor"
      : input.moduleId === "M02"
        ? "settlement"
        : "royalty";
  const certificationMonth = input.certificationMonth ?? monthKeyFromDate(input.evaluationDate);
  const statement = scopeArtifactToCertificationMonth(
    resolveArtifact(input.artifacts, statementToken),
    certificationMonth,
  );
  const pos = scopeArtifactToCertificationMonth(
    resolveArtifact(input.artifacts, "pos"),
    certificationMonth,
  );
  const agreement = resolveArtifact(input.artifacts, "agreement");
  const bank = scopeArtifactToCertificationMonth(
    resolveArtifact(input.artifacts, "bank"),
    certificationMonth,
  );
  const contractArtifact = resolveArtifact(input.artifacts, "contract");
  const contract = contractArtifact?.contractValues ?? null;

  const context: RuleContext = {
    agreement,
    artifacts: input.artifacts,
    bank,
    cadence: input.cadence,
    contract,
    evaluationDate: input.evaluationDate,
    moduleId: input.moduleId,
    pos,
    statement,
  };

  const dataCompleteness = scoreDataCompleteness(context);
  const dataFreshness = scoreDataFreshness(context);
  const sourceAuthenticity = scoreSourceAuthenticity(context);
  const crossSystemReconciliation = scoreCrossSystemReconciliation(context);
  const ruleIntegrity = scoreRuleIntegrity(context);
  const auditability = scoreAuditability(context);

  const dimensions: Record<Mq6DimensionName, number> = {
    Auditability: auditability.scorePct,
    "Cross-System Reconciliation": crossSystemReconciliation.scorePct,
    "Data Completeness": dataCompleteness.scorePct,
    "Data Freshness": dataFreshness.scorePct,
    "Rule Integrity": ruleIntegrity.scorePct,
    "Source Authenticity": sourceAuthenticity.scorePct,
  };

  const recoveryValue = roundCurrency(
    input.moduleId === "M01"
      ? computeM01Recovery(statement?.metrics, pos?.metrics, contract)
      : input.moduleId === "M02"
        ? computeM02Recovery(statement?.metrics, pos?.metrics, contract)
        : computeM03Recovery(statement?.metrics, pos?.metrics, contract),
  );
  const loopARuleCitations = runLoopA(context, recoveryValue);
  const reviewedFeeVolume = computeReviewedFeeVolume(context);
  const trustGates = computeTrustGateScores({
    cadence: input.cadence,
    context,
    dimensions,
    reviewedFeeVolume,
    ruleCitations: loopARuleCitations,
  });
  const systemHealth = computeSystemHealth(input.systemHealthFlags ?? []);
  const governanceRuleCitations = buildCanonicalGovernanceCitations({
    context,
    dimensions,
    recoveryValue,
    systemHealth,
    trustGates,
    varianceCents: loopARuleCitations.reduce((sum, citation) => sum + citation.varianceCents, 0),
  });
  const ingestionRuleCitations = buildCanonicalIngestionCitations(context);
  const trustGateRuleCitations = buildCanonicalTrustGateCitations({
    context,
    trustGates,
  });
  const ruleCitations = capAttributedMonetaryCitations([
    ...loopARuleCitations,
    ...governanceRuleCitations,
    ...ingestionRuleCitations,
    ...trustGateRuleCitations,
  ].filter((citation) => ruleAppliesToModule(citation.ruleId, context.moduleId)), recoveryValue);
  const { score, certificationZone } = computeTrustScoreFromTrustGates(trustGates, systemHealth);
  const findingClass = classifyFindingClass(ruleCitations, context);
  const findings = buildOperationalFindings(
    context,
    dimensions,
    ruleCitations,
    score,
    trustGates,
    systemHealth,
  );
  const hasBlockingCitation = ruleCitations.some((citation) => citation.disposition === "blocking");
  const ready =
    input.cadence === "monthly_final" &&
    certificationZone === "CERTIFIED" &&
    ruleIntegrity.scorePct >= 100 &&
    trustGates.TG10.scorePct >= 100 &&
    trustGates.TG11.scorePct >= 100 &&
    systemHealth.masterSystemHealthy &&
    !hasBlockingCitation;

  return {
    artifactCoverage: dataCompleteness.scorePct,
    certificationZone,
    dimensions,
    findingClass,
    findings,
    mq6: {
      auditability,
      cross_system_reconciliation: crossSystemReconciliation,
      data_completeness: dataCompleteness,
      data_freshness: dataFreshness,
      rule_integrity: ruleIntegrity,
      source_authenticity: sourceAuthenticity,
    },
    ready,
    recoveryValue,
    reviewedFeeVolume,
    ruleCitations,
    score: clamp(score, 0, 100),
    systemHealth,
    trustGates,
  };
}

export function scopeArtifactToCertificationMonth(
  artifact: ModuleArtifactState | null,
  certificationMonth: string,
): ModuleArtifactState | null {
  if (!artifact?.metrics) return artifact;

  const monthlyMetrics = artifact?.metrics?.monthlyMetrics;
  let metrics: Metrics = { ...artifact.metrics };
  const detectedMonths = new Set<string>();
  let excludedRows = 0;

  if (monthlyMetrics && Object.keys(monthlyMetrics).length > 0) {
    Object.keys(monthlyMetrics).forEach((month) => detectedMonths.add(month));
    const matchingMetrics = monthlyMetrics[certificationMonth];
    excludedRows = Object.entries(monthlyMetrics)
      .filter(([month]) => month !== certificationMonth)
      .reduce(
        (sum, [, month]) => sum + numberValue(month.transactionCount ?? month.orderCount),
        0,
      );
    metrics = {
      ...metrics,
      adjustmentAmount: numberValue(matchingMetrics?.adjustmentAmount),
      basisAmount: numberValue(matchingMetrics?.basisAmount),
      chargebackCount: numberValue(matchingMetrics?.chargebackCount),
      deliveryBasisAmount: numberValue(matchingMetrics?.deliveryBasisAmount),
      deliveryCommissionAmount: numberValue(matchingMetrics?.deliveryCommissionAmount),
      deliveryFeeAmount: numberValue(matchingMetrics?.deliveryFeeAmount),
      deliveryOrderCount: numberValue(matchingMetrics?.deliveryOrderCount),
      duplicateOrderCount:
        matchingMetrics?.duplicateOrderCount !== undefined
          ? numberValue(matchingMetrics.duplicateOrderCount)
          : Object.keys(monthlyMetrics).length === 1 && matchingMetrics
            ? numberValue(metrics.duplicateOrderCount)
            : 0,
      duplicateTransactionCount:
        matchingMetrics?.duplicateTransactionCount !== undefined
          ? numberValue(matchingMetrics.duplicateTransactionCount)
          : Object.keys(monthlyMetrics).length === 1 && matchingMetrics
            ? numberValue(metrics.duplicateTransactionCount)
            : 0,
      errorChargeAmount: numberValue(matchingMetrics?.errorChargeAmount),
      feeAmount: numberValue(matchingMetrics?.feeAmount),
      marketingFeeAmount: numberValue(matchingMetrics?.marketingFeeAmount),
      memberOrderCount: numberValue(matchingMetrics?.memberOrderCount),
      orderCount: numberValue(matchingMetrics?.orderCount),
      otherFeeAmount: numberValue(matchingMetrics?.otherFeeAmount),
      payoutAmount:
        matchingMetrics?.payoutAmount !== undefined
          ? numberValue(matchingMetrics.payoutAmount)
          : Object.keys(monthlyMetrics).length === 1 && matchingMetrics
            ? numberValue(metrics.payoutAmount)
            : 0,
      pickupBasisAmount: numberValue(matchingMetrics?.pickupBasisAmount),
      pickupCommissionAmount: numberValue(matchingMetrics?.pickupCommissionAmount),
      pickupOrderCount: numberValue(matchingMetrics?.pickupOrderCount),
      promoOrderCount: numberValue(matchingMetrics?.promoOrderCount),
      refundCount: numberValue(matchingMetrics?.refundCount),
      transactionCount: numberValue(matchingMetrics?.transactionCount),
      voidCount: numberValue(matchingMetrics?.voidCount),
    };
  }

  const scopeReferenceRows = (
    rows: ReferenceRow[] | undefined,
    useActivityMonth = false,
  ) => {
    if (!rows?.length) return rows;
    const scoped = rows.filter((row) => {
      const month = useActivityMonth
        ? row.activityMonth ?? null
        : referenceRowMonth(row);
      if (month) detectedMonths.add(month);
      if (month === certificationMonth) return true;
      excludedRows += 1;
      return false;
    });
    return scoped;
  };
  const payoutRowsHaveActivityMonth =
    (artifact.key === "m01-pos" || artifact.key === "m02-settlement") &&
    Boolean(metrics.payoutReferenceRows?.some((row) => row.activityMonth));
  const retainLegacyM02PayoutRows =
    artifact.key === "m02-settlement" &&
    !payoutRowsHaveActivityMonth &&
    detectedMonths.size === 1 &&
    detectedMonths.has(certificationMonth);
  const payoutReferenceRows = retainLegacyM02PayoutRows
    ? metrics.payoutReferenceRows
    : scopeReferenceRows(metrics.payoutReferenceRows, payoutRowsHaveActivityMonth);
  const depositRowsUseActivityMonth = artifact.key === "m02-bank" &&
    Boolean(metrics.depositReferenceRows?.some((row) => row.activityMonth));
  const depositReferenceRows = scopeReferenceRows(metrics.depositReferenceRows, depositRowsUseActivityMonth);

  if (metrics.payoutReferenceRows?.length) {
    const amount = roundCurrency((payoutReferenceRows ?? []).reduce((sum, row) => sum + row.amount, 0));
    metrics = {
      ...metrics,
      payoutReferenceRows,
      payoutAmount: amount,
      ...((artifact.key.includes("payout") || (artifact.key === "m01-pos" && !payoutRowsHaveActivityMonth))
        ? { basisAmount: amount, depositAmount: amount }
        : {}),
    };
  }
  if (metrics.depositReferenceRows?.length) {
    const amount = roundCurrency((depositReferenceRows ?? []).reduce((sum, row) => sum + row.amount, 0));
    metrics = {
      ...metrics,
      depositReferenceRows,
      depositAmount: amount,
      payoutAmount: amount,
    };
  }

  const detected = [...detectedMonths].sort();
  const mismatch = detected.length > 0 && !detected.includes(certificationMonth);

  return {
    ...artifact,
    metrics: {
      ...metrics,
      certificationPeriodDetectedMonths: detected,
      certificationPeriodExcludedRows: excludedRows,
      certificationPeriodMismatch: mismatch,
    },
  };
}

function referenceRowMonth(row: ReferenceRow) {
  const value = row.settledDate ?? row.postedDate;
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-\d{2}/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/.exec(value);
  if (!us) return null;
  const year = us[3].length === 2 ? `20${us[3]}` : us[3];
  return `${year}-${us[1].padStart(2, "0")}`;
}

function monthKeyFromDate(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function runLoopA(context: RuleContext, recoveryValue: number) {
  const ruleSet =
    context.moduleId === "M01"
      ? M01_RULES
      : context.moduleId === "M02"
        ? M02_RULES
        : M03_RULES;
  const rules = [...ruleSet].sort((left, right) => left.id.localeCompare(right.id));
  const citations: RuleCitation[] = [];
  let residualVariance = Math.max(0, recoveryValue);

  for (const rule of rules) {
    if (context.moduleId === "M01" && !COURT_SUPPORTED_M01_RULE_IDS.has(rule.id)) {
      continue;
    }
    const citation = rule.evaluate(context, residualVariance);
    if (!citation) continue;
    citations.push(citation);
    residualVariance = Math.max(0, residualVariance - centsToDollars(citation.varianceCents));
  }

  return citations;
}

const COURT_SUPPORTED_M01_RULE_IDS = new Set([
  "R060",
  "R063",
  "R064",
  "R068",
  "R072",
  "R073",
  "R075",
  "R078",
  "R083",
  "R085",
  "R086",
]);

function capAttributedMonetaryCitations(citations: RuleCitation[], recoveryValue: number) {
  let remainingCents = dollarsToCents(Math.max(0, recoveryValue));
  return citations.flatMap((citation) => {
    if (citation.disposition !== "monetary") return [citation];
    const attributedCents = Math.min(Math.max(0, citation.varianceCents), remainingCents);
    if (attributedCents <= 0) return [];
    remainingCents -= attributedCents;
    return [{ ...citation, varianceCents: attributedCents }];
  });
}

function buildCanonicalGovernanceCitations({
  context,
  dimensions,
  recoveryValue,
  systemHealth,
  trustGates,
  varianceCents,
}: {
  context: RuleContext;
  dimensions: Record<Mq6DimensionName, number>;
  recoveryValue: number;
  systemHealth: SystemHealthResult;
  trustGates: Record<TrustGateName, TrustGateScore>;
  varianceCents: number;
}) {
  const citations: RuleCitation[] = [];
  const hasContract = Boolean(context.contract && contractFieldCount(context.contract) >= 3);
  const hasStatement = Boolean(context.statement?.uploaded && context.statement.hash);
  const hasPos = Boolean(context.pos?.uploaded && context.pos.hash);
  const hasAgreement = Boolean(context.agreement?.uploaded && context.agreement.hash);
  const hasBank = context.cadence === "monthly_preliminary"
    ? true
    : Boolean(context.bank?.uploaded && context.bank.hash);
  const periodComplete = hasStatement && hasPos && hasAgreement && hasBank;
  const auditComplete = dimensions.Auditability >= 100;
  const gateReady = trustGates.TG07.scorePct >= 85 && trustGates.TG10.scorePct >= 100;
  const systematicVariance = Math.abs(centsToDollars(varianceCents)) >= Math.max(50, recoveryValue * 0.2);

  if (context.moduleId === "M01") {
    const processingFeesReviewed = resolveM01ComparableFee(context.statement?.metrics);
    const mfrErrorRate = processingFeesReviewed > 0
      ? Math.abs(centsToDollars(varianceCents)) / processingFeesReviewed
      : 0;
    if (mfrErrorRate > 0.03) {
      citations.push(buildNarrativeCitation("R087", {
        detail: "Certified MFR variance exceeds 3% of the processing fees reviewed.",
        error_rate_pct: roundCurrency(mfrErrorRate * 100),
        processing_fees_reviewed: processingFeesReviewed,
        variance_cents: varianceCents,
      }));
    }
    if (recoveryValue < 250) {
      citations.push(buildNarrativeCitation("R088", {
        detail: "MFR recovery remains below the operational review threshold.",
        recovery_value: recoveryValue,
        threshold: 250,
      }));
    }
    if (!hasContract) {
      citations.push(buildNarrativeCitation("R090", {
        detail: "Governed contract values are missing for this MFR workspace.",
      }));
    }
    if (trustGates.TG07.scorePct < 85 || trustGates.TG10.scorePct < 100) {
      citations.push(buildNarrativeCitation("R093", {
        detail: "MFR trust-score contribution remains below the final release gate.",
        tg07: trustGates.TG07.scorePct,
        tg10: trustGates.TG10.scorePct,
      }));
    }
    citations.push(...buildSupplementalM01CanonicalCitations(context, recoveryValue));
  }

  if (context.moduleId === "M02") {
    if (recoveryValue < 250) {
      citations.push(buildNarrativeCitation("R046", {
        detail: "DFR recovery remains below the operational review threshold.",
        recovery_value: recoveryValue,
        threshold: 250,
      }));
    }
    if (!periodComplete) {
      citations.push(buildNarrativeCitation("R047", {
        detail: "The current DFR evidence package is period-incomplete.",
        has_agreement: hasAgreement,
        has_bank: hasBank,
        has_pos: hasPos,
        has_statement: hasStatement,
      }));
    }
    if (numberValue(context.statement?.metrics?.adjustmentAmount) > 0) {
      citations.push(buildNarrativeCitation("R048", {
        adjustment_amount: numberValue(context.statement?.metrics?.adjustmentAmount),
        detail: "Settlement adjustments remain present and should be reviewed for prior-period carryover behavior.",
      }));
    }
    if (systematicVariance) {
      citations.push(buildNarrativeCitation("R049", {
        detail: "Observed DFR variance is systematic enough to require remediation before release.",
        recovery_value: recoveryValue,
        variance_cents: varianceCents,
      }));
    }
    if (trustGates.TG07.scorePct < 85 || trustGates.TG10.scorePct < 100) {
      citations.push(buildNarrativeCitation("R051", {
        detail: "DFR trust-score contribution remains below the final release gate.",
        tg07: trustGates.TG07.scorePct,
        tg10: trustGates.TG10.scorePct,
      }));
    }
    if (!hasContract) {
      citations.push(buildNarrativeCitation("R052", {
        detail: "Governed contract values are missing for this DFR workspace.",
      }));
    }
    if (!auditComplete) {
      citations.push(buildNarrativeCitation("R054", {
        auditability_score: dimensions.Auditability,
        detail: "Audit lineage is incomplete for this DFR certification set.",
      }));
    }
    if (!gateReady || !systemHealth.masterSystemHealthy) {
      citations.push(buildNarrativeCitation("R055", {
        detail: "Final DFR narrative token set is not releasable because governance or health gates remain open.",
        master_system_healthy: systemHealth.masterSystemHealthy,
        tg07: trustGates.TG07.scorePct,
        tg10: trustGates.TG10.scorePct,
      }));
    }
    citations.push(...buildSupplementalM02CanonicalCitations(context, recoveryValue));
  }

  if (context.moduleId === "M03") {
    const certifiedGrossSales = resolveM03CertifiedGrossSales(context.pos?.metrics, context.contract);
    const reportedRoyalty = numberValue(context.statement?.metrics?.feeAmount);
    const reportedMarketing = numberValue(
      context.statement?.metrics?.marketingFeeAmount || context.statement?.metrics?.otherFeeAmount,
    );
    const requiredRoyalty = computeExpectedM03Royalty(certifiedGrossSales, context.contract);
    const requiredMarketing = computeExpectedM03MarketingFund(certifiedGrossSales, context.contract);
    const royaltyVariance = roundCurrency(Math.max(0, requiredRoyalty - reportedRoyalty));
    const marketingVariance = roundCurrency(Math.max(0, requiredMarketing - reportedMarketing));
    const selfReportedGrossSales = numberValue(context.statement?.metrics?.basisAmount);
    const basisDeltaPct =
      certifiedGrossSales > 0 && selfReportedGrossSales > 0
        ? relativeDelta(certifiedGrossSales, selfReportedGrossSales)
        : 0;
    const contractAgeDays = (() => {
      const effectiveDate = parseDateValue(textValue(context.contract?.effective_date));
      return effectiveDate === null
        ? null
        : Math.floor((context.evaluationDate.getTime() - effectiveDate.getTime()) / 86400000);
    })();
    const royaltyReady = requiredRoyalty > 0 && reportedRoyalty > 0;
    const marketingReady =
      numberValue(context.contract?.marketing_fund_rate_pct) <= 0 ||
      (requiredMarketing > 0 && reportedMarketing > 0);

    citations.push(buildNarrativeCitation("R096", {
      detail: hasStatement
        ? "Royalty remittance source was received for the governed period."
        : "Royalty remittance source is still missing for the governed period.",
      royalty_source_uploaded: hasStatement,
    }));
    citations.push(buildNarrativeCitation("R097", {
      certified_gross_sales: certifiedGrossSales,
      detail: certifiedGrossSales > 0
        ? "Certified royalty gross-sales basis was reconstructed from the governed POS source."
        : "Certified royalty gross-sales basis could not yet be reconstructed from the governed POS source.",
    }));
    citations.push(buildNarrativeCitation("R098", {
      certified_gross_sales: certifiedGrossSales,
      detail: "Royalty sales exclusions were applied from the sealed contract and governed POS basis.",
      excluded_sales_amount: resolveM03ExcludedSales(context.pos?.metrics, context.contract),
    }));
    if (royaltyVariance > 0) {
      citations.push(buildCitation("R100", 1, Math.min(royaltyVariance, Math.max(recoveryValue, royaltyVariance)), {
        reported_remittance: reportedRoyalty,
        required_royalty: requiredRoyalty,
        royalty_variance: royaltyVariance,
      }));
    }
    citations.push(buildNarrativeCitation("R102", {
      detail:
        marketingVariance > 0
          ? "Marketing-fund remittance remains below the required governed amount."
          : "Marketing-fund remittance is aligned or not active for this governed period.",
      marketing_variance: marketingVariance,
      reported_marketing_remittance: reportedMarketing,
      required_marketing_fund: requiredMarketing,
    }));
    citations.push(buildNarrativeCitation("R103", {
      detail:
        basisDeltaPct > 0.01
          ? "Self-reported royalty sales diverge from POS-certified gross sales."
          : "Self-reported royalty sales are aligned with POS-certified gross sales within tolerance.",
      pos_certified_gross_sales: certifiedGrossSales,
      self_reported_gross_sales: selfReportedGrossSales,
      variance_pct: roundCurrency(basisDeltaPct * 100),
    }));
    citations.push(buildNarrativeCitation("R104", {
      chronic_underreport_pattern: basisDeltaPct >= 0.03,
      detail:
        basisDeltaPct >= 0.03
          ? "Royalty underreporting pattern threshold was met for this governed period."
          : "No chronic royalty underreporting pattern was promoted from the current governed period.",
      variance_pct: roundCurrency(basisDeltaPct * 100),
    }));
    citations.push(buildNarrativeCitation("R105", {
      contract_age_days: contractAgeDays,
      detail:
        contractAgeDays !== null && contractAgeDays >= 0
          ? "Royalty effective-date period check was applied against the sealed contract."
          : "Royalty rate period check could not confirm an effective-date lineage from the sealed contract.",
    }));
    citations.push(buildNarrativeCitation("R106", {
      agreement_uploaded: hasAgreement,
      detail: hasAgreement
        ? "A signed franchise agreement is present for the governed royalty workspace."
        : "No signed franchise agreement is present for the governed royalty workspace.",
    }));
    citations.push(buildNarrativeCitation("R107", {
      detail: truthyContractFlag(context.contract, "grace_period_active")
        ? "A governed franchise grace-period flag is active and was considered during royalty-rate validation."
        : "No governed franchise grace-period override is active for this period.",
      grace_period_active: truthyContractFlag(context.contract, "grace_period_active"),
    }));
    citations.push(buildNarrativeCitation("R108", {
      detail: truthyContractFlag(context.contract, "multi_concept_allocation_required")
        ? "Multi-concept allocation handling is required and remains in the governed royalty path."
        : "No multi-concept allocation handling was required for this governed period.",
      multi_concept_allocation_required: truthyContractFlag(context.contract, "multi_concept_allocation_required"),
    }));
    citations.push(buildNarrativeCitation("R109", {
      detail: numberValue(context.contract?.transfer_fee_amount) > 0
        ? "A governed transfer-fee schedule is present and available for royalty audit."
        : "No governed transfer-fee schedule was active for the certified period.",
      transfer_fee_amount: numberValue(context.contract?.transfer_fee_amount),
    }));
    citations.push(buildNarrativeCitation("R110", {
      detail: truthyContractFlag(context.contract, "royalty_waiver_active")
        ? "A governed royalty-waiver state is active and must remain documented."
        : "No governed royalty-waiver state is active for this period.",
      royalty_waiver_active: truthyContractFlag(context.contract, "royalty_waiver_active"),
    }));
    citations.push(buildNarrativeCitation("R111", {
      detail:
        recoveryValue > 0 && recoveryValue <= 250
          ? "Royalty variance exists but remains below the release threshold."
          : "Royalty variance is either absent or above threshold for certification routing.",
      recovery_threshold: 250,
      recovery_value: recoveryValue,
    }));
    citations.push(buildNarrativeCitation("R112", {
      detail:
        recoveryValue > 250
          ? "Royalty variance exceeded the certification threshold and is eligible for release scoring."
          : "Royalty variance did not exceed the certification threshold.",
      recovery_threshold: 250,
      recovery_value: recoveryValue,
    }));
    citations.push(buildNarrativeCitation("R113", {
      detail: `Royalty TG07 fee-legitimacy contribution resolved at ${trustGates.TG07.scorePct}.`,
      tg07_score: trustGates.TG07.scorePct,
    }));
    citations.push(buildNarrativeCitation("R114", {
      auditability_score: dimensions.Auditability,
      detail:
        auditComplete
          ? "Royalty audit-trail lineage is complete for the governed period."
          : "Royalty audit-trail lineage remains incomplete for the governed period.",
    }));
    citations.push(buildNarrativeCitation("R115", {
      detail:
        royaltyReady && marketingReady && gateReady
          ? "Royalty narrative token set is releasable from persisted governed inputs."
          : "Royalty narrative token set remains blocked because one or more governed controls are incomplete.",
      gate_ready: gateReady,
      marketing_ready: marketingReady,
      royalty_ready: royaltyReady,
    }));
  }

  if (!systemHealth.healthy) {
    for (const flag of systemHealth.flags) {
      citations.push(buildNarrativeCitation(flag, {
        detail: systemHealth.detail,
        penalty_points: systemHealth.penaltyPoints,
      }));
    }
  }

  return dedupeRuleCitations(citations);
}

function buildCanonicalIngestionCitations(context: RuleContext) {
  const statement = context.statement;
  const pos = context.pos;
  const agreement = context.agreement;
  const bank = context.bank;
  const statementMetrics = statement?.metrics;
  const posMetrics = pos?.metrics;
  const duplicateTransactionCount = numberValue(statementMetrics?.duplicateTransactionCount);
  const duplicateOrderCount = numberValue(statementMetrics?.duplicateOrderCount);
  const basisAmount = numberValue(statementMetrics?.basisAmount) + numberValue(posMetrics?.basisAmount);
  const hasNegativeSignals =
    numberValue(statementMetrics?.adjustmentAmount) < 0 ||
    numberValue(statementMetrics?.errorChargeAmount) < 0 ||
    numberValue(statementMetrics?.payoutAmount) < 0 ||
    numberValue(bank?.metrics?.depositAmount) < 0;
  const hasCertifiedPeriodCoverage =
    (statementMetrics?.certificationPeriodDetectedMonths?.length ?? 0) > 0 &&
    statementMetrics?.certificationPeriodMismatch !== true;
  const hasMonthBuckets = Object.keys(statementMetrics?.monthlyMetrics ?? {}).length > 0;
  const hasDateRange =
    hasCertifiedPeriodCoverage ||
    numberValue(statementMetrics?.settlementLagDaysAvg) > 0 ||
    (!hasMonthBuckets && Boolean(statement?.updatedAt));

  const citations = [
    buildNarrativeCitation("R001", {
      detail: statement?.uploaded
        ? "Governed source file receipt was recorded for the active module."
        : "No governed source file has been received for the active module.",
      uploaded: Boolean(statement?.uploaded),
    }),
    buildNarrativeCitation("R002", {
      detail: "Vendor type classification was resolved from the governed artifact key and active module.",
      artifact_key: statement?.key ?? null,
      module: context.moduleId,
    }),
    buildNarrativeCitation("R003", {
      detail: "Parser version selection used the current governed intake profile for the artifact type.",
      artifact_type: statement?.type ?? null,
      module: context.moduleId,
    }),
    buildNarrativeCitation("R004", {
      detail: statement?.uploaded
        ? "Source parse execution completed and produced governed metrics."
        : "Source parse execution has not completed because the governed source file is missing.",
      metrics_present: Boolean(statementMetrics),
    }),
    buildNarrativeCitation("R005", {
      detail: statement?.uploaded && statement?.schema
        ? "No parse failure blocked the governed source artifact."
        : "Parse or structural intake failure remains on the governed source artifact.",
      schema_ready: Boolean(statement?.schema),
    }),
    buildNarrativeCitation("R006", {
      detail: statement?.schema && statement?.fields
        ? "Canonical column mapping has been applied to the governed source artifact."
        : "Canonical column mapping remains incomplete on the governed source artifact.",
      governed_fields_ready: Boolean(statement?.fields),
    }),
    buildNarrativeCitation("R007", {
      detail: statement?.schema
        ? "No blocking unmapped source-column condition remains on the governed source artifact."
        : "Unmapped or structurally incompatible source columns still block governance.",
      schema_ready: Boolean(statement?.schema),
    }),
    buildNarrativeCitation("R008", {
      detail: statement?.schema
        ? "Canonical schema validation passed for the governed source artifact."
        : "Canonical schema validation has not passed for the governed source artifact.",
      schema_ready: Boolean(statement?.schema),
    }),
    buildNarrativeCitation("R009", {
      detail: statement?.schema
        ? "The active source artifact was not rejected by schema validation."
        : "The active source artifact remains rejected or blocked by schema validation.",
      schema_ready: Boolean(statement?.schema),
    }),
    buildNarrativeCitation("R010", {
      detail:
        duplicateTransactionCount > 0
          ? "Confirmed duplicate financial transactions were detected during governed normalization."
          : duplicateOrderCount > 0
            ? "Duplicate order identifiers were detected for review, but no duplicate financial transaction was confirmed."
          : "No duplicate events were detected during governed normalization.",
      duplicate_order_count: duplicateOrderCount,
      duplicate_transaction_count: duplicateTransactionCount,
    }),
    buildNarrativeCitation("R011", {
      detail: hasDateRange
        ? "Date-range validation produced a usable governed certification window."
        : "Date-range validation could not be confirmed from the active governed package.",
      date_range_ready: hasDateRange,
      detected_months: statementMetrics?.certificationPeriodDetectedMonths?.join(", ") ?? null,
      period_mismatch: statementMetrics?.certificationPeriodMismatch === true,
      settlement_lag_days_avg: numberValue(statementMetrics?.settlementLagDaysAvg),
    }),
    buildNarrativeCitation("R012", {
      detail: basisAmount > 0
        ? "Null-amount rejection did not prevent normalization of the active governed package."
        : "Amount-bearing governed fields are absent or unresolved in the active package.",
      normalized_amount_basis: roundCurrency(basisAmount),
    }),
    buildNarrativeCitation("R013", {
      detail: hasNegativeSignals
        ? "Negative-value signals were preserved for review during normalization."
        : "No negative-value normalization flags were surfaced from the governed package.",
      negative_signal_detected: hasNegativeSignals,
    }),
    buildNarrativeCitation("R014", {
      detail: context.contract && contractFieldCount(context.contract) >= 3
        ? "Vendor profile lookup resolved governed contract values for this module."
        : "Vendor profile lookup did not resolve a complete governed contract profile for this module.",
      contract_fields: context.contract ? contractFieldCount(context.contract) : 0,
    }),
    buildNarrativeCitation("R015", {
      detail:
        statement?.uploaded && pos?.uploaded && agreement?.uploaded && (context.cadence === "monthly_preliminary" || bank?.uploaded)
          ? "Normalization completed and the full active package advanced into deterministic certification."
          : "Normalization is not yet complete because one or more governed artifacts are still missing.",
      agreement_uploaded: Boolean(agreement?.uploaded),
      bank_uploaded: Boolean(bank?.uploaded),
      pos_uploaded: Boolean(pos?.uploaded),
      source_uploaded: Boolean(statement?.uploaded),
    }),
  ];

  return dedupeRuleCitations(citations);
}

function buildCanonicalTrustGateCitations({
  context,
  trustGates,
}: {
  context: RuleContext;
  trustGates: Record<TrustGateName, TrustGateScore>;
}) {
  const duplicateDetected = trustGates.TG05.scorePct < 100;
  const contractExpirationDate = parseDateValue(
    context.contract?.expiration_date ||
    context.contract?.contract_expiration_date ||
    context.contract?.expires_on,
  );
  const contractExpired = Boolean(
    contractExpirationDate && contractExpirationDate.getTime() < context.evaluationDate.getTime(),
  );
  const formulaChangedDuringPeriod = truthyContractFlag(
    context.contract,
    "formula_version_changed_during_period",
  );
  const tg07VarianceCitations = new Set([
    "MFR-BIL-15",
    "R083",
    "DSP-COM-04",
    "DSP-VAR-11",
    "R035",
    "R049",
    "R091",
  ]);
  const narrativeReady = trustGates.TG08.scorePct >= 100 && trustGates.TG09.scorePct >= 100;
  const statementProcessingVolume = resolveReconciliationStatementBasis(context);
  const posBasis = numberValue(context.pos?.metrics?.basisAmount);
  const settlementTimingBasis = usesSettlementTimingBasis(context);
  const processorBasis = settlementTimingBasis && posBasis > 0 ? posBasis : statementProcessingVolume;
  const reconciliationDifference = Math.abs(processorBasis - posBasis);
  const reconciliationDifferencePct = processorBasis > 0
    ? (reconciliationDifference / processorBasis) * 100
    : null;
  const comparableM02Orders = resolveComparableM02OrderCounts(
    context.statement?.metrics,
    context.pos?.metrics,
  );
  const dspOrderCount = comparableM02Orders.statementOrderCount;
  const posCertifiedOrderCount = comparableM02Orders.posOrderCount;
  const orderCountDifference = Math.abs(dspOrderCount - posCertifiedOrderCount);
  const orderCountDifferencePct =
    dspOrderCount > 0 && posCertifiedOrderCount > 0
      ? relativeDelta(dspOrderCount, posCertifiedOrderCount) * 100
      : null;
  const reconciliationEvaluable = context.moduleId === "M02"
    ? dspOrderCount > 0 && posCertifiedOrderCount > 0
    : settlementTimingBasis || (processorBasis > 0 && posBasis > 0);
  const reconciliationBreakdown = resolveCrossSystemReconciliationBreakdown(context);

  const citations = [
    buildNarrativeCitation("R116", {
      detail: `TG01 data completeness resolved at ${trustGates.TG01.scorePct}.`,
      tg01_score: trustGates.TG01.scorePct,
    }),
    buildNarrativeCitation("R117", {
      detail: context.pos?.uploaded
        ? "POS data presence is available for TG01."
        : "POS data presence is missing and caps TG01.",
      pos_uploaded: Boolean(context.pos?.uploaded),
    }),
    buildNarrativeCitation("R118", {
      detail: `TG02 source authenticity resolved at ${trustGates.TG02.scorePct}.`,
      tg02_score: trustGates.TG02.scorePct,
    }),
    buildNarrativeCitation("R119", {
      detail:
        context.statement?.hash && context.pos?.hash
          ? "Required source files carry integrity hashes for the active package."
          : "One or more required source files are missing integrity-hash proof.",
      pos_hash: Boolean(context.pos?.hash),
      source_hash: Boolean(context.statement?.hash),
    }),
    buildNarrativeCitation("R120", {
      detail:
        context.contract && contractFieldCount(context.contract) >= 3
          ? "Vendor profile terms are present. Profile-update age was not inferred from the contract effective date."
          : "Vendor profile is absent for the certification period.",
      contract_fields: context.contract ? contractFieldCount(context.contract) : 0,
    }),
    buildNarrativeCitation("R121", {
      detail:
        contractExpired
          ? "The governed contract expiration date precedes the certification evaluation date."
          : "No expired contract date is recorded for the certification period.",
      contract_expiration_date: contractExpirationDate?.toISOString() ?? null,
      contract_expired: contractExpired,
    }),
    buildNarrativeCitation("R122", {
      detail: settlementTimingBasis
        ? "The processing-volume total and settled-batch total use different timing bases. The difference is shown as settlement timing context and is not treated as a POS discrepancy or monetary loss."
        : `TG04 POS reconciliation resolved at ${trustGates.TG04.scorePct}.`,
      difference_amount: roundCurrency(reconciliationDifference),
      difference_percent: reconciliationDifferencePct === null ? null : roundCurrency(reconciliationDifferencePct),
      gross_settled_batches: roundCurrency(posBasis),
      net_settled_batches: roundCurrency(numberValue(context.pos?.metrics?.payoutAmount)),
      pos_basis: roundCurrency(posBasis),
      ...(context.moduleId === "M02"
        ? {
            dsp_order_count: roundInteger(dspOrderCount),
            pos_certified_order_count: roundInteger(posCertifiedOrderCount),
            order_count_difference: roundInteger(orderCountDifference),
            order_count_difference_percent: orderCountDifferencePct === null ? null : roundCurrency(orderCountDifferencePct),
            order_count_scope: comparableM02Orders.scope,
          }
        : {}),
      processor_basis: roundCurrency(processorBasis),
      processor_basis_label: settlementTimingBasis
        ? "Strict certification-month activity basis"
        : "Processor source basis",
      statement_processing_volume: roundCurrency(statementProcessingVolume),
      statement_processing_volume_label: "Broad Toast statement processing volume retained as timing context",
      settlement_basis_label: settlementTimingBasis
        ? "Gross settled batches grouped by settlement date"
        : "Independent POS transaction basis",
      settlement_timing_context: settlementTimingBasis,
      tg04_score: trustGates.TG04.scorePct,
      bank_basis: roundCurrency(reconciliationBreakdown.bankDeposit),
      bank_difference: reconciliationBreakdown.bankDifference,
      bank_difference_percent: reconciliationBreakdown.bankDifferencePct,
      bank_match_count: reconciliationBreakdown.bankMatchCount,
      bank_weekly_reconciliation: reconciliationBreakdown.bankWeeklyReconciliation,
      bank_score_contribution: reconciliationBreakdown.bankContribution,
      fee_score_contribution: reconciliationBreakdown.feeContribution,
      payout_basis: roundCurrency(reconciliationBreakdown.payoutAmount),
      pos_score_contribution: reconciliationBreakdown.posContribution,
      reconciliation_total_score: reconciliationBreakdown.totalScore,
      reconciliation_evaluable: reconciliationEvaluable,
    }),
    ...(reconciliationEvaluable
      ? [buildNarrativeCitation("R123", {
          detail:
            trustGates.TG04.scorePct >= 85
              ? "POS reconciliation cleared the release band."
              : "POS reconciliation remains below the release band.",
          reconciliation_evaluable: true,
          reconciliation_score: trustGates.TG04.scorePct,
          tg04_score: trustGates.TG04.scorePct,
        })]
      : []),
    buildNarrativeCitation("R124", {
      detail: duplicateDetected
        ? "Duplicate-absence control did not clear."
        : "Duplicate-absence control cleared.",
      duplicate_detected: duplicateDetected,
    }),
    buildNarrativeCitation("R125", {
      detail: duplicateDetected
        ? "Duplicate-detected penalty applied to TG05."
        : "No duplicate-detected penalty applied to TG05.",
      duplicate_order_count: numberValue(context.statement?.metrics?.duplicateOrderCount),
      duplicate_transaction_count: numberValue(context.statement?.metrics?.duplicateTransactionCount),
      tg05_score: trustGates.TG05.scorePct,
    }),
    buildNarrativeCitation("R126", {
      detail: `TG06 period coverage resolved at ${trustGates.TG06.scorePct}.`,
      agreement_present: Boolean(context.agreement?.uploaded),
      bank_present: Boolean(context.bank?.uploaded),
      pos_present: Boolean(context.pos?.uploaded),
      processor_present: Boolean(context.statement?.uploaded),
      tg06_score: trustGates.TG06.scorePct,
    }),
    buildNarrativeCitation("R127", {
      detail:
        trustGates.TG06.scorePct >= 75
          ? "No major period-gap penalty remains active."
          : "A period-gap penalty remains active.",
      tg06_score: trustGates.TG06.scorePct,
    }),
    buildNarrativeCitation("R128", {
      detail: `TG07 fee-legitimacy score resolved at ${trustGates.TG07.scorePct}.`,
      tg07_score: trustGates.TG07.scorePct,
    }),
    buildNarrativeCitation("R129", {
      detail:
        trustGates.TG07.scorePct >= 85
          ? "Fee-variance grade cleared the final legitimacy band."
          : "Fee-variance grade remains below the final legitimacy band.",
      tg07_score: trustGates.TG07.scorePct,
    }),
    buildNarrativeCitation("R130", {
      detail:
        trustGates.TG07.scorePct < 85
          ? "A high-variance fee condition remains active."
          : "No high-variance fee condition remains active.",
      high_variance_flag: trustGates.TG07.scorePct < 85,
    }),
    buildNarrativeCitation("R131", {
      detail:
        trustGates.TG08.scorePct >= 100
          ? "KPI formula currency cleared the governed readiness gate."
          : "KPI formula currency remains incomplete.",
      tg08_score: trustGates.TG08.scorePct,
    }),
    buildNarrativeCitation("R132", {
      detail:
        formulaChangedDuringPeriod
          ? "A governed formula-version change is recorded during the certification period."
          : "No governed mid-period formula-version change is recorded.",
      formula_version_changed_during_period: formulaChangedDuringPeriod,
      tg08_score: trustGates.TG08.scorePct,
    }),
    buildNarrativeCitation("R133", {
      detail:
        trustGates.TG09.scorePct >= 100
          ? "Audit-trail integrity cleared."
          : "Audit-trail integrity remains incomplete.",
      tg09_score: trustGates.TG09.scorePct,
    }),
    buildNarrativeCitation("R134", {
      detail:
        narrativeReady
          ? "Narrative hash match readiness is fully established."
          : "Narrative hash match readiness remains blocked.",
      tg08_score: trustGates.TG08.scorePct,
      tg09_score: trustGates.TG09.scorePct,
    }),
    buildNarrativeCitation("R135", {
      detail:
        trustGates.TG11.scorePct >= 100
          ? "CAAR eligibility cleared the final trust-gate threshold."
          : "CAAR eligibility remains blocked at the trust-gate layer.",
      tg11_score: trustGates.TG11.scorePct,
    }),
  ];

  void tg07VarianceCitations;
  return dedupeRuleCitations(citations);
}

function computeReviewedFeeVolume(context: RuleContext) {
  if (context.moduleId === "M01") {
    return Math.max(
      numberValue(context.statement?.metrics?.basisAmount),
      numberValue(context.pos?.metrics?.basisAmount),
      resolveM01ComparableFee(context.statement?.metrics),
    );
  }

  if (context.moduleId === "M02") {
    return Math.max(
      resolveM02ContractBase(context.statement?.metrics, context.pos?.metrics, context.contract),
      computeActualM02Commission(context.statement?.metrics ?? {}),
    );
  }

  if (context.moduleId === "M03") {
    const certifiedGrossSales = resolveM03CertifiedGrossSales(context.pos?.metrics, context.contract);
    return Math.max(
      certifiedGrossSales,
      numberValue(context.statement?.metrics?.feeAmount),
      numberValue(context.statement?.metrics?.marketingFeeAmount),
    );
  }

  return Math.max(
    numberValue(context.statement?.metrics?.basisAmount),
    numberValue(context.pos?.metrics?.basisAmount),
    numberValue(context.statement?.metrics?.feeAmount),
  );
}

function computeTrustGateScores({
  cadence,
  context,
  dimensions,
  reviewedFeeVolume,
  ruleCitations,
}: {
  cadence: Cadence;
  context: RuleContext;
  dimensions: Record<Mq6DimensionName, number>;
  reviewedFeeVolume: number;
  ruleCitations: RuleCitation[];
}) {
  const duplicateCitationIds = new Set(["DSP-DUP-01", "MFR-CBK-05"]);
  const duplicateFiredCount = ruleCitations
    .filter((citation) => duplicateCitationIds.has(citation.ruleId))
    .reduce((sum, citation) => sum + citation.firedCount, 0);
  const totalTransactions =
    Math.max(
      1,
      numberValue(context.statement?.metrics?.transactionCount) ||
        numberValue(context.statement?.metrics?.orderCount) ||
        numberValue(context.pos?.metrics?.transactionCount) ||
        numberValue(context.pos?.metrics?.orderCount),
    );
  const duplicateRatePct = (duplicateFiredCount / totalTransactions) * 100;
  const variancePct = reviewedFeeVolume > 0
    ? (Math.abs(ruleCitations.reduce((sum, citation) => sum + citation.varianceCents, 0)) / 100 / reviewedFeeVolume) * 100
    : 0;
  const posBasis = numberValue(context.pos?.metrics?.basisAmount);
  const statementBasis = resolveReconciliationStatementBasis(context);
  const reconciliationGapPct =
    statementBasis > 0 && posBasis > 0
      ? relativeDelta(statementBasis, posBasis) * 100
      : null;
  const comparableM02Orders = resolveComparableM02OrderCounts(
    context.statement?.metrics,
    context.pos?.metrics,
  );
  const dspOrderCount = comparableM02Orders.statementOrderCount;
  const posCertifiedOrderCount = comparableM02Orders.posOrderCount;
  const orderCountGapPct =
    dspOrderCount > 0 && posCertifiedOrderCount > 0
      ? relativeDelta(dspOrderCount, posCertifiedOrderCount) * 100
      : null;
  const tg04GapPct = context.moduleId === "M02" ? orderCountGapPct : reconciliationGapPct;
  const tg04EvidenceReady = context.moduleId === "M02"
    ? orderCountGapPct !== null
    : dimensions["Cross-System Reconciliation"] > 0 && reconciliationGapPct !== null;
  const settlementTimingBasis = usesSettlementTimingBasis(context);
  const contractExpirationDate = parseDateValue(
    context.contract?.expiration_date ||
    context.contract?.contract_expiration_date ||
    context.contract?.expires_on,
  );
  const contractExpired = Boolean(
    contractExpirationDate && contractExpirationDate.getTime() < context.evaluationDate.getTime(),
  );
  const statementPresent = Boolean(context.statement?.uploaded);
  const posPresent = Boolean(context.pos?.uploaded);
  const agreementPresent = Boolean(context.agreement?.uploaded);
  const bankPresent = cadence === "monthly_preliminary" ? true : Boolean(context.bank?.uploaded);
  const coreSourcePackagePresent = statementPresent && posPresent && agreementPresent;
  const coreStructuredPackageReady =
    artifactSatisfiesCompleteness(context, context.statement ?? null) &&
    artifactSatisfiesCompleteness(context, context.pos ?? null) &&
    agreementPresent;
  const allRequiredArtifactsPresent = coreSourcePackagePresent && bankPresent;
  const allRequiredArtifactsGoverned =
    artifactSatisfiesCompleteness(context, context.statement ?? null) &&
    artifactSatisfiesCompleteness(context, context.pos ?? null) &&
    (cadence === "monthly_preliminary" || artifactSatisfiesCompleteness(context, context.bank ?? null)) &&
    Boolean(agreementPresent && context.agreement?.hash) &&
    Boolean(context.contract && contractFieldCount(context.contract) >= 3);
  const periodCoverageFailed = [context.statement, context.pos, context.bank].some(
    (artifact) => artifact?.metrics?.certificationPeriodMismatch,
  );

  const tg01 = buildTrustGateScore(
    "TG01",
    dimensions["Data Completeness"] >= 90
      ? 100
      : posPresent
        ? Math.min(89, dimensions["Data Completeness"])
        : Math.min(50, dimensions["Data Completeness"]),
    dimensions["Data Completeness"] >= 90
      ? "Required data fields for the active module are at least 90% populated."
      : posPresent
        ? "Required data fields for the active module remain below the 90% completeness threshold."
        : "POS transaction data is missing, so completeness is capped at the low-confidence band.",
    ["R116", "R117"],
  );

  const tg02 = buildTrustGateScore(
    "TG02",
    dimensions["Source Authenticity"] >= 100
      ? 100
      : dimensions["Source Authenticity"] >= 67 && coreSourcePackagePresent
        ? 60
        : 0,
    dimensions["Source Authenticity"] >= 100
      ? "Authenticated source files carry intact integrity hashes for the active certification package."
      : dimensions["Source Authenticity"] >= 67 && coreSourcePackagePresent
        ? "The source package exists but provenance or integrity evidence remains partial because one release-critical artifact is still missing."
        : "Source authenticity failed because one or more required source artifacts are missing.",
    ["R118", "R119"],
  );

  const tg03 = buildTrustGateScore(
    "TG03",
    !context.contract || contractFieldCount(context.contract) < 3
      ? 0
      : contractExpired
        ? 50
        : 100,
    !context.contract || contractFieldCount(context.contract) < 3
      ? "No governed vendor profile / contract terms are available for the certification period."
      : contractExpired
        ? "The governed contract expiration date precedes the certification evaluation date."
        : "Vendor profile terms are present and no expired contract date is recorded.",
    ["R120", "R121"],
  );

  const tg04Score =
    !tg04EvidenceReady || tg04GapPct === null
      ? 0
      : settlementTimingBasis
        ? 100
      : tg04GapPct <= 1
        ? 100
        : tg04GapPct > 5
          ? 0
          : roundInteger(100 - ((tg04GapPct - 1) / 4) * 100);
  const tg04 = buildTrustGateScore(
    "TG04",
    tg04Score,
    !tg04EvidenceReady || tg04GapPct === null
      ? context.moduleId === "M02"
        ? "DSP and POS-certified order counts could not be reconciled for the active period."
        : "POS and source evidence could not be reconciled for the active period."
      : settlementTimingBasis
        ? "The Toast payout export is a settlement schedule, not an independent POS sales basis. Its difference from processing volume is recorded as timing context and does not reduce TG04."
      : context.moduleId === "M02"
        ? tg04GapPct <= 1
          ? "POS-certified order count reconciles to the DSP order count within the ±1% R122 tolerance."
          : tg04GapPct > 5
            ? "POS-to-DSP order-count reconciliation exceeds 5% and fails TG04 under R123."
            : "POS-to-DSP order-count reconciliation remains in the partial band between 1% and 5%."
        : tg04GapPct <= 1
          ? "POS-to-source reconciliation is within the ±1% tolerance band."
          : tg04GapPct > 5
            ? "POS-to-source reconciliation gap exceeds 5% and fails the trust gate."
            : "POS-to-source reconciliation remains in the partial band between 1% and 5%.",
    ["R122", "R123"],
  );

  const tg05 = buildTrustGateScore(
    "TG05",
    duplicateFiredCount === 0 ? 100 : clamp(roundInteger(100 - duplicateRatePct * 100), 0, 99),
    duplicateFiredCount === 0
      ? "No duplicate transactions were detected in the certification period."
      : `${duplicateFiredCount} duplicate or duplicate-like transaction events were detected in the certification period.`,
    ["R124", "R125"],
  );

  const tg06 = buildTrustGateScore(
    "TG06",
    periodCoverageFailed
      ? 0
      : cadence === "monthly_preliminary"
      ? Math.max(75, dimensions["Data Freshness"])
      : allRequiredArtifactsGoverned
        ? 100
        : allRequiredArtifactsPresent
          ? Math.max(80, dimensions["Data Freshness"])
          : coreStructuredPackageReady
            ? 75
            : 40,
    periodCoverageFailed
      ? "One or more evidence files contain no dated rows for the active certification month. Out-of-period and undated rows were excluded."
      : cadence === "monthly_preliminary"
      ? "Monthly preliminary coverage is accepted without the final bank evidence gate."
      : allRequiredArtifactsGoverned
        ? "All required monthly-final artifacts, including governed bank evidence, cover the active period."
        : allRequiredArtifactsPresent
          ? "All required files are present, but one or more artifacts still lacks governed field, schema, or integrity validation."
          : coreStructuredPackageReady
            ? "Core source artifacts cover the active period, but monthly-final release is still awaiting the bank tie-out package."
            : "One or more required period artifacts are missing, so coverage remains incomplete.",
    ["R126", "R127"],
  );

  const tg07Score =
    reviewedFeeVolume <= 0 || dimensions["Rule Integrity"] < 60
      ? 0
      : variancePct < 0.5
        ? 100
        : variancePct <= 3
          ? clamp(
              roundInteger(
                99 - ((variancePct - 0.5) / 2.5) * 14,
              ),
              85,
              99,
            )
          : variancePct <= 5
            ? clamp(
                roundInteger(
                  84 - ((variancePct - 3) / 2) * 16,
                ),
                68,
                84,
              )
            : clamp(roundInteger(68 - (variancePct - 5) * 4), 0, 68);
  const tg07 = buildTrustGateScore(
    "TG07",
    tg07Score,
    reviewedFeeVolume <= 0
      ? "Fee legitimacy could not be evaluated because no reviewed fee volume was available."
      : dimensions["Rule Integrity"] < 60
        ? "Fee legitimacy could not be certified because the source package did not preserve the governed rule inputs needed for deterministic review."
      : variancePct < 0.5
        ? "Certified variance is below 0.5% of total fees reviewed."
        : variancePct <= 3
          ? `Certified variance is ${roundCurrency(variancePct)}% of total fees reviewed, which lands in the documented partial band.`
          : variancePct <= 5
            ? `Certified variance is ${roundCurrency(variancePct)}% of total fees reviewed, creating an elevated fee-variance condition.`
            : `Certified variance is ${roundCurrency(variancePct)}% of total fees reviewed and remains materially above the final release band.`,
    ["R128", "R129", "R130"],
  );

  const tg08 = buildTrustGateScore(
    "TG08",
    allRequiredArtifactsGoverned
      ? 100
      : context.contract
        ? 50
        : 0,
    allRequiredArtifactsGoverned
      ? "The governed KPI formula inputs remained current for the full certification period."
      : context.contract
        ? "Governed formula inputs exist, but a split-period or incomplete governed state remains possible."
        : "No governed contract formula was available for the active certification period.",
    ["R131", "R132"],
  );

  const tg09 = buildTrustGateScore(
    "TG09",
    dimensions["Auditability"] >= 100
      ? 100
      : dimensions["Auditability"] >= 67
        ? 67
        : 0,
    dimensions["Auditability"] >= 100
      ? "Audit trail lineage is complete across upload provenance, governed config, and certification state."
      : dimensions["Auditability"] >= 67
        ? "Audit lineage is partial and still missing one or more processing events."
        : "Audit lineage is incomplete for the active certification package.",
    ["R133"],
  );

  const tg10 = buildTrustGateScore(
    "TG10",
    tg08.scorePct >= 100 && tg09.scorePct >= 100
      ? 100
      : tg08.scorePct >= 50 && tg09.scorePct >= 100
        ? 50
        : 0,
    tg08.scorePct >= 100 && tg09.scorePct >= 100
      ? "The governed package is internally consistent and ready for deterministic narrative sealing."
      : tg08.scorePct >= 50 && tg09.scorePct >= 100
        ? "Narrative readiness is partially established, but sealing is still blocked by incomplete governed evidence."
      : "Narrative hash readiness is blocked until governed formula and audit-lineage gates are both fully satisfied.",
    ["R134"],
  );

  const tg11 = buildTrustGateScore(
    "TG11",
    0,
    "CAAR eligibility is computed after TG01-TG10 and the system-health pass.",
    ["R135"],
  );

  const trustGates = {
    TG01: tg01,
    TG02: tg02,
    TG03: tg03,
    TG04: tg04,
    TG05: tg05,
    TG06: tg06,
    TG07: tg07,
    TG08: tg08,
    TG09: tg09,
    TG10: tg10,
    TG11: tg11,
  } satisfies Record<TrustGateName, TrustGateScore>;

  const preTg11 = computeTrustGateWeightedScore(trustGates, false);
  trustGates.TG11 = buildTrustGateScore(
    "TG11",
    preTg11 >= 85 ? 100 : 0,
    preTg11 >= 85
      ? "Composite Trust Gate score cleared the documented 85-point CAAR threshold."
      : "Composite Trust Gate score remains below the documented 85-point CAAR threshold.",
    ["R135", "R146"],
  );

  return trustGates;
}

function computeSystemHealth(flags: SystemHealthFlag[]): SystemHealthResult {
  if (flags.includes("R188")) {
    return {
      detail: "Rule registry version drift was detected. Certification must halt until the governed rule set is realigned.",
      flags,
      healthy: false,
      masterSystemHealthy: false,
      penaltyPoints: 100,
    };
  }

  const penaltyPoints = flags.reduce((sum, flag) => {
    if (flag === "R186" || flag === "R192") return sum + 5;
    if (flag === "R191") return sum + 3;
    return sum;
  }, 0);

  return {
    detail:
      flags.length === 0
        ? "System health checks passed for the active deterministic certification run."
        : `System health degradation detected via ${flags.join(", ")}; penalty applied after trust-gate scoring.`,
    flags,
    healthy: flags.length === 0,
    masterSystemHealthy: flags.length === 0,
    penaltyPoints,
  };
}

function computeTrustScoreFromTrustGates(
  trustGates: Record<TrustGateName, TrustGateScore>,
  systemHealth: SystemHealthResult,
) {
  const baseScore = computeTrustGateWeightedScore(trustGates, true);
  const finalScore = clamp(roundInteger(baseScore - systemHealth.penaltyPoints), 0, 100);
  return {
    certificationZone: getCertificationZone(finalScore),
    score: finalScore,
  };
}

function computeTrustGateWeightedScore(
  trustGates: Record<TrustGateName, TrustGateScore>,
  includeTg11: boolean,
) {
  return roundInteger(
    (Object.entries(TG_WEIGHTS) as Array<[TrustGateName, number]>).reduce((sum, [gate, weight]) => {
      if (!includeTg11 && gate === "TG11") {
        return sum;
      }
      return sum + trustGates[gate].scorePct * (weight / 100);
    }, 0),
  );
}

function buildTrustGateScore(
  gate: TrustGateName,
  scorePct: number,
  detail: string,
  canonicalRuleIds: string[],
): TrustGateScore {
  void gate;
  return {
    badge: scorePct >= 85 ? "PASS" : scorePct >= 60 ? "PARTIAL" : "FAIL",
    canonicalRuleIds,
    detail,
    scorePct: clamp(roundInteger(scorePct), 0, 100),
  };
}

function getCertificationZone(score: number): CertificationZone {
  if (score < 40) return "UNVERIFIED";
  if (score < 60) return "PROVISIONAL";
  if (score < 80) return "CONDITIONAL";
  if (score < 85) return "VALIDATED";
  return "CERTIFIED";
}

function scoreDataCompleteness(context: RuleContext): Mq6Score {
  const requiredArtifacts = context.artifacts.filter((artifact) => isRequiredArtifact(context, artifact));
  if (requiredArtifacts.length === 0) {
    return scoreDetail(0, "No governed artifacts are available for this module.");
  }
  const satisfied = requiredArtifacts.filter((artifact) => artifactSatisfiesCompleteness(context, artifact)).length;
  const baseScore = roundInteger((satisfied / requiredArtifacts.length) * 100);
  const statementComplete = context.statement ? artifactSatisfiesCompleteness(context, context.statement) : false;
  const posComplete = context.pos ? artifactSatisfiesCompleteness(context, context.pos) : false;
  const bankRequired = moduleRequiresBank(context);
  const bankComplete =
    !bankRequired || context.cadence === "monthly_preliminary"
      ? true
      : context.bank
        ? artifactSatisfiesCompleteness(context, context.bank)
        : false;

  let score = baseScore;
  if (!statementComplete || !posComplete) {
    // A broken source or POS file means the package is present but not structurally certifiable.
    score = Math.min(score, 20);
  } else if (bankRequired && !bankComplete) {
    // Monthly-final runs without the governed bank artifact stay in the blocked middle band.
    score = Math.min(score, 40);
  }

  return scoreDetail(
    score,
    `${satisfied} of ${requiredArtifacts.length} required certification artifacts passed the structural completeness gate.`,
  );
}

function scoreDataFreshness(context: RuleContext): Mq6Score {
  const periodMismatchArtifacts = [context.statement, context.pos, context.bank].filter(
    (artifact) => artifact?.metrics?.certificationPeriodMismatch,
  );
  if (periodMismatchArtifacts.length > 0) {
    return scoreDetail(
      0,
      periodMismatchArtifacts
        .map(
          (artifact) =>
            `${artifact?.label ?? "Evidence"} contains only ${artifact?.metrics?.certificationPeriodDetectedMonths?.join(", ") || "undated"} rows; none belong to the active certification month. ${artifact?.metrics?.certificationPeriodExcludedRows ?? 0} out-of-period or undated rows were excluded.`,
        )
        .join(" "),
    );
  }
  const uploads = [context.statement, context.pos, context.bank, context.agreement].filter(
    (artifact): artifact is ModuleArtifactState => Boolean(artifact?.uploaded && artifact.updatedAt),
  );
  if (uploads.length === 0) {
    return scoreDetail(0, "No uploaded artifacts were available to score freshness.");
  }
  const fresh = uploads.filter((artifact) => {
    const updatedAt = new Date(artifact.updatedAt as string);
    const ageDays = Math.floor((context.evaluationDate.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    return ageDays <= 45;
  }).length;
  const score = roundInteger((fresh / uploads.length) * 100);
  return scoreDetail(
    score,
    `${fresh} of ${uploads.length} uploaded artifacts are within the 45-day freshness window.`,
  );
}

function scoreSourceAuthenticity(context: RuleContext): Mq6Score {
  let score = 0;
  const statementEvidence = Boolean(
    context.statement?.uploaded &&
      context.statement.hash &&
      context.statement.schema &&
      context.statement.fields,
  );
  const posEvidence = Boolean(
    context.pos?.uploaded &&
      context.pos.hash &&
      context.pos.schema &&
      context.pos.fields,
  );
  const bankRequired = moduleRequiresBank(context);
  const bankEvidence = bankRequired
    ? Boolean(context.bank?.uploaded && context.bank.hash)
    : statementEvidence;

  if (statementEvidence) score += 34;
  if (posEvidence) score += 33;
  if (bankEvidence) score += 33;

  const detailParts = [
    statementEvidence ? "source statement verified" : "source statement missing or unverified",
    posEvidence ? "POS source verified" : "POS source missing or unverified",
    bankRequired
      ? bankEvidence
        ? "bank statement verified"
        : "bank statement missing or unverified"
      : bankEvidence
        ? "monthly preliminary source evidence verified"
        : "monthly preliminary source evidence incomplete",
  ];

  return scoreDetail(score, detailParts.join("; "));
}

function scoreCrossSystemReconciliation(context: RuleContext): Mq6Score {
  const breakdown = resolveCrossSystemReconciliationBreakdown(context);
  return scoreDetail(breakdown.totalScore, breakdown.detailParts.join(" "));
}

function resolveCrossSystemReconciliationBreakdown(context: RuleContext) {
  let posContribution = 0;
  let feeContribution = 0;
  let bankContribution = 0;
  const detailParts: string[] = [];
  const statementGoverned = Boolean(
    context.statement?.uploaded &&
      context.statement.schema &&
      context.statement.fields,
  );
  const posGoverned = Boolean(
    context.pos?.uploaded &&
      context.pos.schema &&
      context.pos.fields,
  );
  const bankRequired = moduleRequiresBank(context);
  const bankGoverned = Boolean(context.bank?.uploaded && context.bank.hash);
  const statementBasis = resolveReconciliationStatementBasis(context);
  const posBasis = numberValue(context.pos?.metrics?.basisAmount);
  const statementFees = context.moduleId === "M01"
    ? resolveM01ComparableFee(context.statement?.metrics)
    : numberValue(context.statement?.metrics?.feeAmount);
  const matchedPayoutDeposits = reconcilePayoutBankDeposits(context);
  const bankDeposit = numberValue(matchedPayoutDeposits?.matchedDepositAmount ?? context.bank?.metrics?.depositAmount);
  const payoutAmount = numberValue(
    matchedPayoutDeposits?.matchedPayoutAmount ||
      context.pos?.metrics?.payoutAmount ||
      context.statement?.metrics?.payoutAmount,
  );
  const settlementTimingBasis = usesSettlementTimingBasis(context);
  const periodMismatchArtifacts = [context.statement, context.pos, context.bank].filter(
    (artifact) => artifact?.metrics?.certificationPeriodMismatch,
  );

  if (periodMismatchArtifacts.length > 0) {
    detailParts.push(
      `Period mismatch: ${periodMismatchArtifacts
        .map(
          (artifact) =>
            `${artifact?.label ?? "evidence"} contains ${artifact?.metrics?.certificationPeriodDetectedMonths?.join(", ") || "undated"} data`,
        )
        .join("; ")}. Out-of-period rows were excluded from this certification.`,
    );
  }

  if (statementGoverned && posGoverned && statementBasis > 0 && posBasis > 0) {
    const delta = relativeDelta(statementBasis, posBasis);
    if (settlementTimingBasis) {
      posContribution = 25;
      detailParts.push("Processing volume and settled batches use different timing bases; the difference is retained as timing context and does not count as a POS failure.");
    } else if (delta <= 0.05) {
      posContribution = 25;
      detailParts.push("POS-to-source basis tied within 5%.");
    } else if (delta <= 0.12) {
      posContribution = 12;
      detailParts.push("POS-to-source basis tied within 12% but remains outside final tolerance.");
    } else {
      detailParts.push("POS-to-source basis failed tolerance.");
    }
  } else {
    detailParts.push("POS-to-source basis could not be reconciled.");
  }

  if (statementGoverned && statementFees > 0 && context.contract) {
    feeContribution = 25;
    detailParts.push("Contract-driven shadow fee could be computed from governed statement evidence.");
  } else {
    detailParts.push("Contract or statement evidence was insufficient for shadow fee computation.");
  }

  if (!bankRequired) {
    bankContribution = 50;
    detailParts.push("No governed bank tie-out is required for the active royalty module.");
  } else if (context.cadence === "monthly_preliminary") {
    bankContribution = 50;
    detailParts.push("Monthly bank tie-out deferred by monthly preliminary cadence.");
  } else if (statementGoverned && bankGoverned && bankDeposit > 0 && payoutAmount > 0) {
    const delta = relativeDelta(bankDeposit, payoutAmount);
    if (delta <= 0.05) {
      bankContribution = 50;
      detailParts.push(
        matchedPayoutDeposits
          ? `Payout-reference bank tie-out cleared within 5% across ${matchedPayoutDeposits.matchCount} matched deposits.`
          : "Settlement-to-bank tie-out cleared within 5%.",
      );
    } else if (delta <= 0.12) {
      bankContribution = 25;
      detailParts.push(
        matchedPayoutDeposits
          ? `Payout-reference bank tie-out remains outside final tolerance across ${matchedPayoutDeposits.matchCount} matched deposits.`
          : "Settlement-to-bank tie-out remains outside final tolerance.",
      );
    } else {
      detailParts.push(
        matchedPayoutDeposits
          ? "Payout-reference bank tie-out failed."
          : "Settlement-to-bank tie-out failed.",
      );
    }
  } else {
    detailParts.push("Bank reconciliation evidence missing.");
  }

  return {
    bankContribution,
    bankDeposit,
    bankDifference: bankDeposit > 0 && payoutAmount > 0 ? roundCurrency(Math.abs(bankDeposit - payoutAmount)) : null,
    bankDifferencePct:
      bankDeposit > 0 && payoutAmount > 0
        ? roundCurrency(relativeDelta(bankDeposit, payoutAmount) * 100)
        : null,
    bankMatchCount: matchedPayoutDeposits?.matchCount ?? 0,
    bankWeeklyReconciliation: matchedPayoutDeposits?.matches ?? [],
    detailParts,
    feeContribution,
    payoutAmount,
    posBasis,
    posContribution,
    statementBasis,
    totalScore: posContribution + feeContribution + bankContribution,
  };
}

function reconcilePayoutBankDeposits(context: RuleContext) {
  const payoutRows = context.moduleId === "M01"
    ? context.pos?.metrics?.payoutReferenceRows ?? []
    : context.statement?.metrics?.payoutReferenceRows ?? [];
  const depositRows = context.bank?.metrics?.depositReferenceRows ?? [];

  if (!payoutRows.length || !depositRows.length) {
    return null;
  }

  const usedDeposits = new Set<number>();
  let matchedDepositAmount = 0;
  let matchedPayoutAmount = 0;
  let matchCount = 0;
  const matches: Array<Record<string, string | number | null>> = [];

  for (const payoutRow of payoutRows) {
    const payoutRef = normalizeReferenceId(payoutRow.externalRefId);
    if (!payoutRef || payoutRow.amount <= 0) continue;

    const depositIndex = depositRows.findIndex((depositRow, index) => {
      if (usedDeposits.has(index)) return false;
      const referencesMatch = referenceIdsMatch(payoutRef, normalizeReferenceId(depositRow.externalRefId));
      if (!referencesMatch && context.moduleId !== "M02") return false;
      return resolveReferenceRowMatchedAmount(depositRow, payoutRow.amount) !== null;
    });

    if (depositIndex === -1) continue;

    usedDeposits.add(depositIndex);
    matchedPayoutAmount += payoutRow.amount;
    const matchedAmount = resolveReferenceRowMatchedAmount(depositRows[depositIndex], payoutRow.amount) ?? 0;
    matchedDepositAmount += matchedAmount;
    matchCount += 1;
    matches.push({
      bankDeposit: roundCurrency(matchedAmount),
      bankPostedDate: depositRows[depositIndex].postedDate ?? depositRows[depositIndex].settledDate ?? null,
      certificationMonthAmount: roundCurrency(payoutRow.certificationMonthAmount ?? payoutRow.amount),
      followingMonthAmount: roundCurrency(payoutRow.followingMonthAmount ?? 0),
      payoutAmount: roundCurrency(payoutRow.amount),
      payoutReference: payoutRef,
      payoutSettledDate: payoutRow.settledDate ?? null,
    });
  }

  if (matchCount === 0) {
    return null;
  }

  return {
    matchCount,
    matches,
    matchedDepositAmount: roundCurrency(matchedDepositAmount),
    matchedPayoutAmount: roundCurrency(matchedPayoutAmount),
  };
}

function referenceIdsMatch(left: string, right: string) {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTrimmed = left.replace(/^0+/, "");
  const rightTrimmed = right.replace(/^0+/, "");
  return (
    leftTrimmed === rightTrimmed ||
    left.endsWith(rightTrimmed) ||
    right.endsWith(leftTrimmed) ||
    leftTrimmed.endsWith(rightTrimmed) ||
    rightTrimmed.endsWith(leftTrimmed)
  );
}

function amountsMatch(left: number, right: number) {
  return Math.abs(numberValue(left) - numberValue(right)) <= 0.01;
}

function resolveReferenceRowMatchedAmount(row: ReferenceRow, targetAmount: number) {
  if (amountsMatch(row.amount, targetAmount)) {
    return row.amount;
  }

  const candidateMatch = (row.candidateAmounts ?? []).find((candidate) => amountsMatch(candidate, targetAmount));
  if (candidateMatch !== undefined) {
    return targetAmount;
  }

  return null;
}

function normalizeReferenceId(value: string | undefined | null) {
  const normalized = String(value ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
  return normalized.replace(/^0+/, "");
}

function scoreRuleIntegrity(context: RuleContext): Mq6Score {
  const hasContract = Boolean(context.contract && Object.keys(context.contract).length > 0);
  const hasGovernedStatement = Boolean(
    context.statement?.uploaded &&
      context.statement.schema &&
      context.statement.fields,
  );
  const hasSchema = Boolean(
    (context.statement?.schema && context.statement.fields) ||
      (context.pos?.schema && context.pos.fields),
  );
  const score = hasContract && hasGovernedStatement && hasSchema ? 100 : 0;
  return scoreDetail(
    score,
    score === 100
      ? "Deterministic rule registry executed against governed inputs without integrity gaps."
      : "Rule execution was blocked because governed contract, statement, or schema inputs were incomplete.",
  );
}

function scoreAuditability(context: RuleContext): Mq6Score {
  let score = 0;
  if (context.statement?.uploaded && context.statement.hash) score += 34;
  if (context.pos?.uploaded && context.pos.hash) score += 33;
  if (context.contract && Object.keys(context.contract).length > 0) score += 33;
  return scoreDetail(
    score,
    score === 100
      ? "Upload provenance, source lineage, and governed contract linkage are complete."
      : "Audit chain is incomplete across upload provenance, source lineage, or governed contract linkage.",
  );
}

function buildOperationalFindings(
  context: RuleContext,
  dimensions: Record<Mq6DimensionName, number>,
  ruleCitations: RuleCitation[],
  score: number,
  trustGates: Record<TrustGateName, TrustGateScore>,
  systemHealth: SystemHealthResult,
) {
  const findings: string[] = [];

  if (!context.statement?.uploaded) {
    findings.push(
      context.moduleId === "M01"
        ? "Processor statement upload is missing."
        : "DSP settlement upload is missing.",
    );
  }
  if (!context.pos?.uploaded) findings.push("POS reconciliation export is missing.");
  if (context.cadence === "monthly_final" && !context.bank?.uploaded) {
    findings.push("Bank statement evidence is missing for the monthly final run.");
  }
  if (!context.agreement?.uploaded) findings.push("Signed agreement PDF is missing.");
  if (!context.contract || contractFieldCount(context.contract) < 3) {
    findings.push("Contract config is incomplete for deterministic evaluation.");
  }
  if (dimensions["Cross-System Reconciliation"] < 85) {
    findings.push("Cross-system reconciliation remains below the final release gate.");
  }
  if (trustGates.TG07.scorePct < 85) {
    findings.push("Fee legitimacy remains below the documented TG07 release threshold.");
  }
  if (trustGates.TG10.scorePct < 100) {
    findings.push("Narrative hash readiness remains blocked by incomplete governed or audit-lineage controls.");
  }
  if (dimensions["Rule Integrity"] < 100) {
    findings.push("Rule integrity is degraded because governed inputs are incomplete.");
  }
  if (!systemHealth.masterSystemHealthy) {
    findings.push(systemHealth.detail);
  }
  for (const citation of ruleCitations.filter((row) => row.disposition === "blocking" || row.disposition === "monetary")) {
    findings.push(
      citation.disposition === "monetary"
        ? `${citation.ruleId} identified ${formatCurrency(centsToDollars(citation.varianceCents))} in attributed variance.`
        : `${citation.ruleId} remains an active release-blocking control.`,
    );
  }
  if (score >= 85 && ruleCitations.length === 0 && findings.length === 0) {
    findings.push("All deterministic certification gates cleared with no actionable variance detected.");
  }

  return findings.slice(0, 8);
}

function classifyFindingClass(ruleCitations: RuleCitation[], context: RuleContext): FindingClass {
  const totalVariance = ruleCitations.reduce((sum, citation) => sum + citation.varianceCents, 0);
  if (totalVariance > 100) return "BREACH_OVERCHARGE";
  if (totalVariance < -100) return "BREACH_UNDERCHARGE";
  if (!context.statement?.uploaded || !context.contract) return "INCONCLUSIVE";
  return "NO_FINDING";
}

function evaluateCardDowngradeRule({
  actualAmountKey,
  actualFeeKey,
  cardBrand,
  context,
  residualVariance,
  ruleId,
}: {
  actualAmountKey:
    | "visaDebitAmount"
    | "mcDebitAmount";
  actualFeeKey:
    | "visaDebitFeeAmount"
    | "mcDebitFeeAmount";
  cardBrand: "visa_debit" | "mastercard_debit";
  context: RuleContext;
  residualVariance: number;
  ruleId: string;
}) {
  const statement = context.statement?.metrics;
  if (!statement || residualVariance <= 1) return null;
  const amount = numberValue(statement[actualAmountKey]);
  const actualFee = numberValue(statement[actualFeeKey]);
  if (amount <= 0 || actualFee <= 0) return null;
  const rateTable = getM01RateTable(context.contract);
  const contracted = rateTable[cardBrand];
  const expected = computeCardBrandFee(amount, contracted.ratePct, contracted.fixedCents);
  const variance = Math.min(roundCurrency(Math.max(0, actualFee - expected)), residualVariance);
  if (variance <= 1) return null;
  return buildCitation(ruleId, 1, variance, {
    amount,
    card_brand: cardBrand,
    expected_fee: expected,
    observed_fee: actualFee,
  });
}

function evaluateVolumeTierRule(
  context: RuleContext,
  residualVariance: number,
  ruleId: string,
  basisThresholdPct: number,
  residualShare: number,
) {
  const statement = context.statement?.metrics;
  const contract = context.contract;
  if (!statement || !contract || residualVariance <= 1) return null;
  const feeMetrics = resolveM01FeeCalculationMetrics(context);
  const basisAmount = numberValue(feeMetrics.basisAmount);
  const actualFees = numberValue(statement.feeAmount);
  const pricingModel = String(contract.pricing_model ?? contract.contract_type ?? "").toLowerCase();
  if (basisAmount <= 0 || actualFees <= 0 || !pricingModel.includes("tier")) return null;
  const expectedTotal = computeExpectedM01Fees(feeMetrics, contract);
  const excess = actualFees - expectedTotal;
  if (excess <= basisAmount * basisThresholdPct) return null;
  const variance = Math.min(roundCurrency(excess * residualShare), residualVariance);
  if (variance <= 1) return null;
  return buildCitation(ruleId, 1, variance, {
    basis_amount: basisAmount,
    excess_fees: roundCurrency(excess),
    pricing_model: pricingModel,
  });
}

function buildCitation(
  ruleId: string,
  firedCount: number,
  varianceDollars: number,
  sampleEvidence: Record<string, unknown>,
): RuleCitation {
  return {
    disposition: varianceDollars !== 0 ? "monetary" : "informational",
    firedCount,
    ruleId,
    ruleVersion: RULE_VERSION,
    sampleEvidence: [sampleEvidence],
    varianceCents: dollarsToCents(varianceDollars),
  };
}

function buildNarrativeCitation(ruleId: string, sampleEvidence: Record<string, unknown>): RuleCitation {
  const disposition = resolveNarrativeCitationDisposition(ruleId, sampleEvidence);
  return {
    disposition,
    firedCount: disposition === "passed" ? 0 : 1,
    ruleId,
    ruleVersion: RULE_VERSION,
    sampleEvidence: [sampleEvidence],
    varianceCents: 0,
  };
}

function resolveNarrativeCitationDisposition(
  ruleId: string,
  sample: Record<string, unknown>,
): RuleCitation["disposition"] {
  const bool = (key: string) => sample[key] === true;
  const number = (key: string) => typeof sample[key] === "number" ? sample[key] as number : 0;

  if (["R002", "R003", "R016", "R045", "R046", "R048", "R051", "R053", "R088", "R089", "R093", "R098", "R107", "R108", "R109", "R110", "R111", "R112", "R113", "R116", "R118", "R122", "R126", "R128", "R129"].includes(ruleId)) {
    return "informational";
  }

  switch (ruleId) {
    case "R001": return bool("uploaded") ? "informational" : "blocking";
    case "R004": return bool("metrics_present") ? "informational" : "blocking";
    case "R005":
    case "R007":
    case "R008":
    case "R009": return bool("schema_ready") ? "passed" : "blocking";
    case "R006": return bool("governed_fields_ready") ? "passed" : "blocking";
    case "R010": return number("duplicate_transaction_count") > 0 ? "blocking" : number("duplicate_order_count") > 0 ? "informational" : "passed";
    case "R011": return bool("date_range_ready") ? "passed" : "blocking";
    case "R012": return number("normalized_amount_basis") > 0 ? "passed" : "blocking";
    case "R013": return bool("negative_signal_detected") ? "blocking" : "passed";
    case "R014": return number("contract_fields") >= 3 ? "passed" : "blocking";
    case "R015": return bool("source_uploaded") && bool("pos_uploaded") && bool("agreement_uploaded") && bool("bank_uploaded") ? "passed" : "blocking";
    case "R096": return bool("royalty_source_uploaded") ? "informational" : "blocking";
    case "R097": return number("certified_gross_sales") > 0 ? "informational" : "blocking";
    case "R102": return number("marketing_variance") > 0 ? "blocking" : "passed";
    case "R103": return number("variance_pct") > 1 ? "blocking" : "passed";
    case "R104": return bool("chronic_underreport_pattern") ? "blocking" : "passed";
    case "R105": return sample.contract_age_days === null ? "blocking" : "informational";
    case "R106": return bool("agreement_uploaded") ? "passed" : "blocking";
    case "R114": return number("auditability_score") >= 100 ? "passed" : "blocking";
    case "R115": return bool("gate_ready") && bool("marketing_ready") && bool("royalty_ready") ? "passed" : "blocking";
    case "R117": return bool("pos_uploaded") ? "passed" : "blocking";
    case "R119": return bool("source_hash") && bool("pos_hash") ? "passed" : "blocking";
    case "R120": return number("contract_fields") >= 3 ? "informational" : "blocking";
    case "R121": return bool("contract_expired") ? "blocking" : "informational";
    case "R123": return number("tg04_score") >= 85 ? "passed" : "blocking";
    case "R124": return bool("duplicate_detected") ? "informational" : "passed";
    case "R125": return number("tg05_score") >= 100 ? "passed" : "blocking";
    case "R127": return number("tg06_score") < 75 ? "blocking" : "passed";
    case "R130": return bool("high_variance_flag") ? "blocking" : "passed";
    case "R131": return number("tg08_score") >= 100 ? "passed" : "blocking";
    case "R132": return bool("formula_version_changed_during_period") ? "blocking" : "passed";
    case "R133": return number("tg09_score") >= 100 ? "passed" : "blocking";
    case "R134": return number("tg08_score") >= 100 && number("tg09_score") >= 100 ? "passed" : "blocking";
    case "R135": return number("tg11_score") >= 100 ? "passed" : "blocking";
    default: return "blocking";
  }
}

function dedupeRuleCitations(citations: RuleCitation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.ruleId}:${JSON.stringify(citation.sampleEvidence[0] ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSupplementalM01CanonicalCitations(
  context: RuleContext,
  recoveryValue: number,
) {
  const citations: RuleCitation[] = [];
  const statement = context.statement?.metrics;
  const contract = context.contract;
  if (!statement || !contract) return citations;

  const vendor = resolveVendorName(context);
  const actualFees = resolveM01ComparableFee(statement);
  const feeMetrics = resolveM01FeeCalculationMetrics(context);
  const basisAmount = numberValue(feeMetrics.basisAmount);
  const expectedFees = computeExpectedM01Fees(feeMetrics, contract);
  const posBasis = numberValue(context.pos?.metrics?.basisAmount);
  const debitVolume = numberValue(statement.visaDebitAmount) + numberValue(statement.mcDebitAmount);
  const duplicateTxnCount = numberValue(statement.duplicateTransactionCount);
  const chargebackCount = numberValue(statement.chargebackCount);
  const amexVolume = numberValue(statement.visaCreditAmount) + numberValue(statement.mcCreditAmount);
  const effectiveRatePct = basisAmount > 0 ? (actualFees / basisAmount) * 100 : 0;
  const surchargeRatePct = numberValue(contract.surcharge_rate_pct || contract.applied_surcharge_rate_pct);
  const surchargeCapPct = Math.min(
    4,
    numberValue(contract.max_surcharge_rate_pct || contract.contract_surcharge_cap_pct || contract.surcharge_cap_pct) || 4,
  );
  const monthlyVolume = numberValue(contract.monthly_card_volume || contract.monthly_volume || contract.volume_amount);
  const volumeDiscountThreshold = numberValue(contract.volume_discount_threshold || contract.discount_threshold_volume);
  const expectedVolumeDiscountPct = numberValue(contract.volume_discount_pct || contract.discount_rate_pct);

  if (basisAmount > 0 && actualFees > 0) {
    citations.push(buildNarrativeCitation("R002", {
      ...buildM01FeeGapSample(
        { ...statement, ...feeMetrics },
        contract,
        actualFees,
        expectedFees,
        roundCurrency(Math.max(0, actualFees - expectedFees)),
      ),
      detail: "M01 governed fee calculation and POS basis comparison were reconstructed for the certification period.",
      pos_basis_amount: posBasis,
      reconciliation_difference: roundCurrency(Math.abs(basisAmount - posBasis)),
    }));
  }

  if (textValue(contract.sic_code) && textValue(contract.certified_sic_code) && textValue(contract.sic_code) !== textValue(contract.certified_sic_code)) {
    citations.push(buildNarrativeCitation("R057", {
      certified_sic_code: textValue(contract.certified_sic_code),
      detail: "Certified SIC code differs from the active processor contract SIC classification.",
      processor_sic_code: textValue(contract.sic_code),
    }));
  }
  if (effectiveRatePct > numberValue(contract.max_effective_rate_pct || contract.rate_ceiling_pct) && numberValue(contract.max_effective_rate_pct || contract.rate_ceiling_pct) > 0) {
    citations.push(buildCitation("R058", 1, Math.max(0, recoveryValue), {
      actual_effective_rate_pct: roundCurrency(effectiveRatePct),
      basis_amount: basisAmount,
      max_effective_rate_pct: numberValue(contract.max_effective_rate_pct || contract.rate_ceiling_pct),
      observed_fee_amount: actualFees,
    }));
  }
  const uncontractedFeeAmount = numberValue(statement.uncontractedFeeAmount);
  if (uncontractedFeeAmount > 0) {
    citations.push(buildCitation("R059", 1, Math.min(uncontractedFeeAmount, Math.max(recoveryValue, uncontractedFeeAmount)), {
      detail: "Source evidence identifies a fee line with no corresponding governed contract term.",
      uncontracted_fee_amount: uncontractedFeeAmount,
    }));
  }
  if (
    truthyContractFlag(contract, "surcharge_enabled")
    && surchargeRatePct > surchargeCapPct
    && debitVolume + basisAmount > 0
  ) {
    const surchargedVolume = Math.max(debitVolume, basisAmount);
    const excessRatePct = Math.max(0, surchargeRatePct - surchargeCapPct);
    const surchargeVariance = Math.min(
      roundCurrency((surchargedVolume * excessRatePct) / 100),
      numberValue(statement.surchargeFeeAmount),
    );
    if (surchargeVariance > 0) {
      citations.push(buildCitation("R061", 1, Math.min(surchargeVariance, Math.max(recoveryValue, surchargeVariance)), {
        applied_surcharge_rate_pct: surchargeRatePct,
        detail: "The identified surcharge rate exceeds the contractual or network cap.",
        max_surcharge_rate_pct: surchargeCapPct,
        surcharge_fee_amount: numberValue(statement.surchargeFeeAmount),
        surcharged_volume: surchargedVolume,
      }));
    }
  }
  const debitSurchargeAmount = numberValue(statement.debitSurchargeAmount);
  if (debitVolume > 0 && debitSurchargeAmount > 0) {
    citations.push(buildCitation("R062", 1, Math.min(debitSurchargeAmount, Math.max(recoveryValue, debitSurchargeAmount)), {
      debit_volume: debitVolume,
      detail: "The source evidence identifies a surcharge applied to debit-card volume.",
      debit_surcharge_amount: debitSurchargeAmount,
    }));
  }
  if (numberValue(statement.avsDowngradeAmount) > 0 && truthyContractFlag(contract, "avs_required")) {
    citations.push(buildNarrativeCitation("R065", {
      avs_downgrade_amount: numberValue(statement.avsDowngradeAmount),
      avs_required: true,
      detail: "The source evidence identifies an AVS-related downgrade while AVS is contractually required.",
    }));
  }
  if (numberValue(statement.cvvDowngradeAmount) > 0 && truthyContractFlag(contract, "cvv_required")) {
    citations.push(buildNarrativeCitation("R066", {
      cvv_required: true,
      cvv_downgrade_amount: numberValue(statement.cvvDowngradeAmount),
      detail: "The source evidence identifies a CVV-related downgrade while CVV is contractually required.",
    }));
  }
  const partialAuthDuplicateAmount = numberValue(statement.partialAuthDuplicateAmount);
  if (duplicateTxnCount > 0 && partialAuthDuplicateAmount > 0) {
    citations.push(buildCitation("R067", Math.max(1, Math.round(duplicateTxnCount)), Math.min(partialAuthDuplicateAmount, Math.max(recoveryValue, partialAuthDuplicateAmount)), {
      detail: "The source evidence identifies a duplicate capture caused by partial-authorization handling.",
      duplicate_transaction_count: duplicateTxnCount,
      partial_auth_duplicate_amount: partialAuthDuplicateAmount,
    }));
  }
  if (numberValue(statement.earlyTerminationFeeAmount) > 0 && !truthyContractFlag(contract, "early_termination_triggered")) {
    citations.push(buildCitation("R069", 1, numberValue(statement.earlyTerminationFeeAmount), {
      detail: "Source evidence identifies an early-termination fee without a governed termination trigger.",
      early_termination_fee_amount: numberValue(statement.earlyTerminationFeeAmount),
    }));
  }
  const restrictedSurchargeAmount = numberValue(statement.restrictedSurchargeAmount);
  if (surchargeRestrictedState(contract) && restrictedSurchargeAmount > 0) {
    citations.push(buildCitation("R071", 1, Math.min(restrictedSurchargeAmount, Math.max(recoveryValue, restrictedSurchargeAmount)), {
      detail: "The source evidence identifies a surcharge in the governed restricted jurisdiction.",
      governed_state: textValue(contract.state || contract.jurisdiction),
      restricted_surcharge_amount: restrictedSurchargeAmount,
    }));
  }
  const retrievalFeeAmount = numberValue(statement.retrievalFeeAmount);
  if (chargebackCount > 0 && retrievalFeeAmount > 0 && numberValue(contract.retrieval_fee_amount) >= 0) {
    const retrievalVariance = Math.max(0, retrievalFeeAmount - chargebackCount * numberValue(contract.retrieval_fee_amount));
    citations.push(buildCitation("R074", Math.max(1, Math.round(chargebackCount)), Math.min(roundCurrency(retrievalVariance), Math.max(recoveryValue, 0)), {
      chargeback_count: chargebackCount,
      contracted_retrieval_fee: numberValue(contract.retrieval_fee_amount),
      detail: "Identified retrieval or representment fees exceed the governed contract rate.",
      observed_retrieval_fees: retrievalFeeAmount,
    }));
  }
  if (numberValue(statement.interchangeMismatchAmount) > 0) {
    citations.push(buildCitation("R076", 1, Math.min(numberValue(statement.interchangeMismatchAmount), Math.max(recoveryValue, numberValue(statement.interchangeMismatchAmount))), {
      card_mix_volume: roundCurrency(debitVolume + amexVolume),
      detail: "Source evidence identifies applied interchange rates that do not match the governed rate table.",
      interchange_mismatch_amount: numberValue(statement.interchangeMismatchAmount),
    }));
  }
  if (vendor.includes("amex") || textValue(contract.amex_program).includes("optblue")) {
    if (amexVolume > 0 && numberValue(statement.amexOptBlueVarianceAmount) > 0) {
      citations.push(buildCitation("R077", 1, Math.min(numberValue(statement.amexOptBlueVarianceAmount), Math.max(recoveryValue, 0)), {
        amex_program: textValue(contract.amex_program) || "optblue",
        amex_optblue_variance_amount: numberValue(statement.amexOptBlueVarianceAmount),
        amex_volume: amexVolume,
      }));
    }
  }
  if (truthyContractFlag(contract, "equipment_inactive") && numberValue(statement.equipmentRentalFeeAmount) > 0) {
    citations.push(buildCitation("R080", 1, Math.min(numberValue(statement.equipmentRentalFeeAmount), Math.max(recoveryValue, numberValue(statement.equipmentRentalFeeAmount))), {
      detail: "An identified equipment-rental fee was charged for equipment marked inactive.",
      equipment_rental_fee_amount: numberValue(statement.equipmentRentalFeeAmount),
    }));
  }
  if (numberValue(statement.internationalFeeExcessAmount) > 0) {
    citations.push(buildCitation("R081", 1, Math.min(numberValue(statement.internationalFeeExcessAmount), Math.max(recoveryValue, 0)), {
      detail: "An identified international-transaction fee exceeds the governed rate or cap.",
      international_fee_excess_amount: numberValue(statement.internationalFeeExcessAmount),
    }));
  }
  if (!truthyContractFlag(contract, "dcc_allowed") && numberValue(statement.dccFeeAmount) > 0) {
    citations.push(buildCitation("R082", 1, Math.min(numberValue(statement.dccFeeAmount), Math.max(recoveryValue, 0)), {
      dcc_fee_amount: numberValue(statement.dccFeeAmount),
      detail: "An identified dynamic-currency-conversion fee appears without governed permission.",
    }));
  }
  if (numberValue(contract.annual_fee_amount) <= 0 && numberValue(statement.annualFeeAmount) > 0) {
    citations.push(buildCitation("R084", 1, Math.min(numberValue(statement.annualFeeAmount), Math.max(recoveryValue, numberValue(statement.annualFeeAmount))), {
      annual_fee_amount: numberValue(statement.annualFeeAmount),
      detail: "An identified annual account fee is present without a governed annual-fee term.",
    }));
  }
  if (
    volumeDiscountThreshold > 0
    && monthlyVolume >= volumeDiscountThreshold
    && expectedVolumeDiscountPct > 0
  ) {
    const missedDiscount = numberValue(statement.missedVolumeDiscountAmount);
    if (missedDiscount > 0) {
      citations.push(buildCitation("R079", 1, Math.min(missedDiscount, Math.max(recoveryValue, missedDiscount)), {
        detail: "Source evidence identifies a contracted volume discount that was not applied.",
        expected_volume_discount_pct: expectedVolumeDiscountPct,
        missed_volume_discount_amount: missedDiscount,
        monthly_card_volume: monthlyVolume,
        volume_discount_threshold: volumeDiscountThreshold,
      }));
    }
  }
  if (recoveryValue >= 250) {
    citations.push(buildNarrativeCitation("R089", {
      detail: "Observed MFR recovery exceeds the certification threshold and remains eligible for release scoring.",
      recovery_threshold: 250,
      recovery_value: recoveryValue,
    }));
  }

  return citations;
}

function buildSupplementalM02CanonicalCitations(
  context: RuleContext,
  recoveryValue: number,
) {
  const citations: RuleCitation[] = [];
  const statement = context.statement?.metrics;
  const pos = context.pos?.metrics;
  const contract = context.contract;
  if (!statement || !contract) return citations;

  const vendor = resolveVendorName(context);
  const actualCommission = computeActualM02Commission(statement);
  const expectedRate = computeExpectedM02Rate(contract, statement);
  const basisAmount = resolveM02ContractBase(statement, pos, contract);
  const statementBasis = resolveComparableM02StatementBasis(statement, pos);
  const posBasis = numberValue(pos?.basisAmount);
  const pickupOrders = numberValue(statement.pickupOrderCount);
  const orderCount = Math.max(1, numberValue(statement.orderCount) || numberValue(statement.transactionCount));
  const refundCount = numberValue(statement.refundCount);
  const promoOrders = numberValue(statement.promoOrderCount);
  const marketingFee = numberValue(statement.marketingFeeAmount);
  const adjustmentAmount = numberValue(statement.adjustmentAmount);
  const taxRemitted = numberValue(statement.taxRemittedAmount);
  const averageOrderValue = statementBasis > 0 ? roundCurrency(statementBasis / orderCount) : 0;
  const observedRate = basisAmount > 0 ? roundCurrency((actualCommission / basisAmount) * 100) : 0;
  const basisDeltaPct = posBasis > 0 && statementBasis > 0 ? relativeDelta(statementBasis, posBasis) : 0;

  if (actualCommission > 0 && basisAmount > 0) {
    const deliveryBasis = numberValue(statement.deliveryBasisAmount);
    const pickupBasis = numberValue(statement.pickupBasisAmount);
    const deliveryRate = numberValue(contract.rate_delivery);
    const pickupRate = numberValue(contract.rate_pickup) || deliveryRate;
    const expectedDeliveryCommission = roundCurrency(deliveryBasis * (deliveryRate / 100));
    const expectedPickupCommission = roundCurrency(pickupBasis * (pickupRate / 100));
    const expectedCommission = roundCurrency(expectedDeliveryCommission + expectedPickupCommission);
    citations.push(buildNarrativeCitation("R016", {
      actual_commission: actualCommission,
      commission_base_amount: basisAmount,
      detail: "Commission basis was reconstructed from governed settlement and POS source evidence.",
      delivery_basis_amount: deliveryBasis,
      delivery_rate_pct: deliveryRate,
      expected_commission: expectedCommission,
      expected_delivery_commission: expectedDeliveryCommission,
      expected_pickup_commission: expectedPickupCommission,
      expected_rate_pct: expectedRate,
      observed_commission: actualCommission,
      pickup_basis_amount: pickupBasis,
      pickup_rate_pct: pickupRate,
      pos_basis_amount: posBasis,
      reconciliation_difference: roundCurrency(Math.abs(statementBasis - posBasis)),
      reconciliation_statement_basis: statementBasis,
    }));
  }
  if (observedRate > expectedRate + 0.5 && expectedRate > 0) {
    citations.push(buildCitation("R017", 1, Math.max(0, recoveryValue), {
      contracted_rate_pct: expectedRate,
      detail: "Observed settlement commission rate exceeds the governed DSP contract rate.",
      observed_rate_pct: observedRate,
    }));
  }
  if (promoOrders > 0 && marketingFee > 0) {
    citations.push(buildCitation("R018", Math.max(1, Math.round(promoOrders)), Math.min(marketingFee, Math.max(recoveryValue, marketingFee)), {
      detail: "Promotional order evidence is present and the period still carries promotional charge pressure.",
      marketing_fee_amount: marketingFee,
      promo_order_count: promoOrders,
    }));
  }
  if (refundCount > 0 && adjustmentAmount <= 0) {
    citations.push(buildCitation("R019", Math.max(1, Math.round(refundCount)), Math.min(roundCurrency(actualCommission * 0.08), Math.max(recoveryValue, 0)), {
      detail: "Refund/cancellation pressure appears without compensating settlement credit behavior.",
      refund_count: refundCount,
      settlement_adjustment_amount: adjustmentAmount,
    }));
  }
  if (refundCount > 0 && actualCommission > 0 && adjustmentAmount >= 0) {
    citations.push(buildCitation("R020", Math.max(1, Math.round(refundCount)), Math.min(roundCurrency(actualCommission * 0.05), Math.max(recoveryValue, 0)), {
      detail: "Commission remains present on pre-dispatch cancellation-style volume.",
      refund_count: refundCount,
      settlement_adjustment_amount: adjustmentAmount,
    }));
  }
  if (basisDeltaPct > 0.05 && posBasis > 0 && statementBasis > 0) {
    citations.push(buildCitation("R021", 1, Math.min(roundCurrency(Math.abs(statementBasis - posBasis) * (expectedRate / 100)), Math.max(recoveryValue, 0)), {
      detail: "Settlement basis and POS basis still diverge beyond price/base tolerance.",
      pos_basis_amount: posBasis,
      settlement_basis_amount: statementBasis,
    }));
  }
  if (basisDeltaPct > 0.08 && orderCount >= 3) {
    citations.push(buildNarrativeCitation("R022", {
      basis_delta_pct: roundCurrency(basisDeltaPct * 100),
      detail: "Repeated price/base mismatch pattern remains present in the governed DFR package.",
      order_count: orderCount,
    }));
  }
  if (vendor.includes("doordash") && averageOrderValue > 40 && observedRate > expectedRate + 0.5) {
    citations.push(buildCitation("R026", 1, Math.min(roundCurrency(actualCommission * 0.15), Math.max(recoveryValue, 0)), {
      average_order_value: averageOrderValue,
      detail: "DoorDash tier behavior appears inconsistent with governed high-value rate treatment.",
      observed_rate_pct: observedRate,
    }));
  }
  if (vendor.includes("uber") && textValue(contract.plan_name).includes("lite") && observedRate > expectedRate + 0.5) {
    citations.push(buildCitation("R027", 1, Math.min(roundCurrency(actualCommission * 0.15), Math.max(recoveryValue, 0)), {
      detail: "Uber Eats Lite plan marker is present while observed rate reflects full-rate pressure.",
      observed_rate_pct: observedRate,
      plan_name: textValue(contract.plan_name),
    }));
  }
  if (vendor.includes("grubhub") && marketingFee > numberValue(contract.marketing_fee_pct) && marketingFee > 1) {
    citations.push(buildCitation("R028", 1, Math.min(marketingFee, Math.max(recoveryValue, marketingFee)), {
      detail: "Grubhub marketing allocation exceeds the governed marketing exhibit envelope.",
      marketing_fee_amount: marketingFee,
      marketing_fee_pct: numberValue(contract.marketing_fee_pct),
    }));
  }
  if (pickupOrders > 0 && actualCommission > 0) {
    citations.push(buildCitation("R029", Math.max(1, Math.round(pickupOrders)), Math.min(roundCurrency(actualCommission * (pickupOrders / orderCount) * 0.5), Math.max(recoveryValue, 0)), {
      detail: "Pickup-order volume still carries delivery-rate commission pressure.",
      pickup_order_count: pickupOrders,
      total_order_count: orderCount,
    }));
  }
  if (adjustmentAmount > 0) {
    citations.push(buildCitation("R030", 1, Math.min(adjustmentAmount, Math.max(recoveryValue, adjustmentAmount)), {
      adjustment_amount: adjustmentAmount,
      detail: "Settlement adjustment credit remains unexplained by governed contract truth.",
    }));
  }
  if (truthyContractFlag(contract, "alcohol_commission_exempt") && taxRemitted > 0 && actualCommission > 0) {
    citations.push(buildCitation("R031", 1, Math.min(roundCurrency(actualCommission * 0.08), Math.max(recoveryValue, 0)), {
      alcohol_commission_exempt: true,
      detail: "Tax/exemptive signals are present while commission still appears to apply to excluded alcohol basis.",
      tax_remitted_amount: taxRemitted,
    }));
  }
  if (!truthyContractFlag(contract, "platform_delivered") && pickupOrders > 0 && actualCommission > 0) {
    citations.push(buildCitation("R032", Math.max(1, Math.round(pickupOrders)), Math.min(roundCurrency(actualCommission * 0.06), Math.max(recoveryValue, 0)), {
      detail: "Merchant-managed or third-party delivery profile still carries platform-delivered commission behavior.",
      pickup_order_count: pickupOrders,
      platform_delivered: false,
    }));
  }
  if (averageOrderValue > 0 && averageOrderValue < numberValue(contract.minimum_order_threshold) && actualCommission > 0) {
    citations.push(buildCitation("R033", 1, Math.min(roundCurrency(actualCommission * 0.12), Math.max(recoveryValue, 0)), {
      average_order_value: averageOrderValue,
      detail: "Minimum-order guarantee threshold was breached without protected commission treatment.",
      minimum_order_threshold: numberValue(contract.minimum_order_threshold),
    }));
  }
  if (refundCount > 0 && actualCommission > 0 && adjustmentAmount >= 0) {
    citations.push(buildCitation("R037", Math.max(1, Math.round(refundCount)), Math.min(roundCurrency(actualCommission * 0.07), Math.max(recoveryValue, 0)), {
      detail: "Refund volume is present but commission offset behavior remains incomplete.",
      refund_count: refundCount,
      settlement_adjustment_amount: adjustmentAmount,
    }));
  }
  if (textValue(contract.billing_currency) && textValue(contract.billing_currency) !== "usd" && expectedRate > 0) {
    citations.push(buildCitation("R039", 1, Math.min(roundCurrency(actualCommission * 0.04), Math.max(recoveryValue, 0)), {
      billing_currency: textValue(contract.billing_currency),
      detail: "Non-USD settlement profile requires governed FX validation and still shows commission variance pressure.",
      observed_rate_pct: observedRate,
    }));
  }
  const contractStartDate = parseDateValue(textValue(contract.location_start_date || contract.effective_date));
  if (contractStartDate) {
    const ageDays = Math.floor((context.evaluationDate.getTime() - contractStartDate.getTime()) / 86400000);
    const onboardingRate = numberValue(contract.onboarding_rate_pct);
    if (ageDays >= 0 && ageDays < 90 && onboardingRate > 0 && observedRate > onboardingRate + 0.5) {
      citations.push(buildCitation("R040", 1, Math.min(roundCurrency(actualCommission * 0.12), Math.max(recoveryValue, 0)), {
        age_days: ageDays,
        detail: "Location is within onboarding window but charged above governed onboarding rate.",
        onboarding_rate_pct: onboardingRate,
        observed_rate_pct: observedRate,
      }));
    }
  }
  if (!truthyContractFlag(contract, "allow_peak_surcharge") && numberValue(statement.deliveryFeeAmount) > 0 && actualCommission > 0) {
    citations.push(buildCitation("R042", 1, Math.min(roundCurrency(numberValue(statement.deliveryFeeAmount) * 0.15), Math.max(recoveryValue, 0)), {
      delivery_fee_amount: numberValue(statement.deliveryFeeAmount),
      detail: "Peak-hour or surge-like delivery surcharge pressure appears without governed authorization.",
    }));
  }
  if (truthyContractFlag(contract, "bundled_order_discount_required") && orderCount > 1 && actualCommission > 0) {
    citations.push(buildCitation("R043", 1, Math.min(roundCurrency(actualCommission * 0.08), Math.max(recoveryValue, 0)), {
      bundled_order_discount_required: true,
      detail: "Bundled-order discount requirement is governed but settlement still reflects full-fee pressure.",
      total_order_count: orderCount,
    }));
  }
  if (numberValue(statement.chargebackCount) > 0 && !truthyContractFlag(contract, "fraud_chargeback_supported")) {
    citations.push(buildCitation("R044", Math.max(1, Math.round(numberValue(statement.chargebackCount))), Math.min(roundCurrency(numberValue(statement.chargebackCount) * 15), Math.max(recoveryValue, 0)), {
      chargeback_count: numberValue(statement.chargebackCount),
      detail: "Fraud/chargeback fee pressure appears without governed support for that charge class.",
    }));
  }
  if (recoveryValue >= 250) {
    citations.push(buildNarrativeCitation("R045", {
      detail: "Observed DFR recovery exceeds the minimum certification threshold.",
      recovery_threshold: 250,
      recovery_value: recoveryValue,
    }));
  }
  if (statementBasis > 0 && numberValue(statement.errorChargeAmount) > 0) {
    const errorRatePct = roundCurrency((numberValue(statement.errorChargeAmount) / statementBasis) * 100);
    if (errorRatePct > 2) {
      citations.push(buildNarrativeCitation("R050", {
        detail: "Period error rate materially exceeds the governed benchmark tolerance band.",
        error_charge_amount: numberValue(statement.errorChargeAmount),
        error_rate_pct: errorRatePct,
      }));
    }
  }
  if (truthyContractFlag(contract, "multi_location_account") && recoveryValue > 0) {
    citations.push(buildNarrativeCitation("R053", {
      detail: "This location is part of a multi-location DSP account and should participate in roll-up review.",
      recovery_value: recoveryValue,
    }));
  }

  return citations;
}

function isRequiredArtifact(context: RuleContext, artifact: ModuleArtifactState) {
  if (artifact.key.includes("bank")) {
    return moduleRequiresBank(context) && context.cadence === "monthly_final";
  }
  return artifact.key.includes("processor") ||
    artifact.key.includes("settlement") ||
    artifact.key.includes("royalty") ||
    artifact.key.includes("pos") ||
    artifact.key.includes("agreement") ||
    artifact.key.includes("contract");
}

function artifactSatisfiesCompleteness(
  context: RuleContext,
  artifact: ModuleArtifactState | null,
) {
  if (!artifact) {
    return false;
  }
  if (artifact.type === "Manual Entry") {
    return Boolean(artifact.contractValues && contractFieldCount(artifact.contractValues) >= 3);
  }
  if (artifact.type === "CSV") {
    return artifact.uploaded && artifact.hash && artifact.schema && artifact.fields;
  }
  if (artifact.key.includes("bank") && context.cadence === "monthly_preliminary") {
    return true;
  }
  return artifact.uploaded && artifact.hash;
}

function resolveArtifact(artifacts: ModuleArtifactState[], token: string) {
  return artifacts.find((artifact) => artifact.key.includes(token)) ?? null;
}

function moduleRequiresBank(context: RuleContext) {
  return context.moduleId !== "M03";
}

function computeExpectedM01Fees(metrics: Metrics, contract: Record<string, string>) {
  const basisAmount = numberValue(metrics.basisAmount);
  const interchangeFees = resolveM01ComparableInterchange(metrics);
  const markupBps = numberValue(contract.markup_bps);
  const txnFee = numberValue(contract.txn_fee);
  const monthlyFee = numberValue(contract.monthly_fee);
  const transactionCount = Math.max(0, roundInteger(numberValue(metrics.transactionCount)));
  return roundCurrency(
    interchangeFees + basisAmount * (markupBps / 10000) + (transactionCount * txnFee) + monthlyFee,
  );
}

function resolveM01FeeCalculationMetrics(context: RuleContext): Metrics {
  const statement = context.statement?.metrics ?? {};
  const payout = context.pos?.metrics;
  if (!payout) return statement;
  return {
    ...statement,
    basisAmount: numberValue(payout.basisAmount),
    payoutAmount: numberValue(payout.payoutAmount),
    transactionCount: numberValue(payout.transactionCount),
  };
}

function resolveM01ComparableFee(metrics?: Metrics) {
  if (!metrics) return 0;
  return typeof metrics.processorFeeAmount === "number"
    ? numberValue(metrics.processorFeeAmount)
    : numberValue(metrics.feeAmount);
}

function resolveM01ComparableInterchange(metrics?: Metrics) {
  if (!metrics || typeof metrics.processorFeeAmount === "number") return 0;
  return numberValue(metrics.interchangeFeeAmount);
}

function buildM01FeeGapSample(metrics: Metrics, contract: Record<string, string>, actualFees: number, expectedTotal: number, variance: number) {
  const basisAmount = numberValue(metrics.basisAmount);
  const markupBps = numberValue(contract.markup_bps);
  const txnFee = numberValue(contract.txn_fee);
  const monthlyFee = numberValue(contract.monthly_fee);
  const transactionCount = Math.max(0, roundInteger(numberValue(metrics.transactionCount)));
  const markupComponent = roundCurrency(basisAmount * (markupBps / 10000));
  const txnComponent = roundCurrency(transactionCount * txnFee);

  return {
    actual_fee_amount: actualFees,
    basis_amount: basisAmount,
    contracted_markup_bps: markupBps,
    contracted_monthly_fee: monthlyFee,
    contracted_per_txn_fee: txnFee,
    expected_fee_amount: expectedTotal,
    expected_interchange_component:
      typeof metrics.processorFeeAmount === "number"
        ? 0
        : typeof metrics.interchangeFeeAmount === "number"
          ? numberValue(metrics.interchangeFeeAmount)
          : null,
    expected_markup_component: markupComponent,
    expected_monthly_component: monthlyFee,
    expected_txn_component: txnComponent,
    extracted_interchange_fee_amount:
      typeof metrics.interchangeFeeAmount === "number" ? numberValue(metrics.interchangeFeeAmount) : null,
    extracted_network_fee_amount:
      typeof metrics.networkFeeAmount === "number" ? numberValue(metrics.networkFeeAmount) : null,
    extracted_other_adjustment_amount:
      typeof metrics.otherAdjustmentAmount === "number" ? numberValue(metrics.otherAdjustmentAmount) : null,
    extracted_processor_fee_amount:
      typeof metrics.processorFeeAmount === "number" ? numberValue(metrics.processorFeeAmount) : null,
    extracted_statement_total_fee_amount:
      typeof metrics.statementTotalFeeAmount === "number" ? numberValue(metrics.statementTotalFeeAmount) : null,
    fee_comparison_scope:
      typeof metrics.processorFeeAmount === "number"
        ? "processor_fee_only"
        : "legacy_statement_fee_total",
    transaction_count: transactionCount,
    unexplained_fee_delta: variance,
  };
}

function getM01RateTable(contract?: Record<string, string> | null) {
  return {
    mastercard_credit: {
      fixedCents: numberValue(contract?.mastercard_credit_fixed_cents),
      ratePct: numberValue(contract?.mastercard_credit_rate_pct),
    },
    mastercard_debit: {
      fixedCents: numberValue(contract?.mastercard_debit_fixed_cents),
      ratePct: numberValue(contract?.mastercard_debit_rate_pct),
    },
    visa_credit: {
      fixedCents: numberValue(contract?.visa_credit_fixed_cents),
      ratePct: numberValue(contract?.visa_credit_rate_pct),
    },
    visa_debit: {
      fixedCents: numberValue(contract?.visa_debit_fixed_cents),
      ratePct: numberValue(contract?.visa_debit_rate_pct),
    },
  };
}

function computeCardBrandFee(amount: number, ratePct: number, fixedCents: number) {
  return roundCurrency(amount * (ratePct / 100) + (fixedCents / 100));
}

function computeM01Recovery(statement?: Metrics, payout?: Metrics, contract?: Record<string, string> | null) {
  if (!statement || !contract) return 0;
  const feeMetrics: Metrics = payout
    ? {
        ...statement,
        basisAmount: numberValue(payout.basisAmount),
        payoutAmount: numberValue(payout.payoutAmount),
        transactionCount: numberValue(payout.transactionCount),
      }
    : statement;
  return Math.max(0, roundCurrency(resolveM01ComparableFee(statement) - computeExpectedM01Fees(feeMetrics, contract)));
}

function computeExpectedM02Rate(contract: Record<string, string>, statement?: Metrics) {
  const deliveryRate = numberValue(contract.rate_delivery);
  const pickupRate = numberValue(contract.rate_pickup) || deliveryRate;
  const totalBasis = numberValue(statement?.basisAmount);
  const deliveryBasis = numberValue(statement?.deliveryBasisAmount);
  const pickupBasis = numberValue(statement?.pickupBasisAmount);
  const classifiedBasis = deliveryBasis + pickupBasis;

  if (totalBasis > 0 && classifiedBasis > 0) {
    const unclassifiedBasis = Math.max(0, totalBasis - classifiedBasis);
    const expectedCommission =
      deliveryBasis * (deliveryRate / 100) +
      pickupBasis * (pickupRate / 100) +
      unclassifiedBasis * (deliveryRate / 100);
    return roundCurrency((expectedCommission / totalBasis) * 100);
  }

  return deliveryRate || pickupRate;
}

function computeActualM02Commission(metrics: Metrics) {
  const directFeeAmount = numberValue(metrics.feeAmount);
  if (directFeeAmount > 0) return directFeeAmount;
  return Math.max(0, roundCurrency(numberValue(metrics.basisAmount) - numberValue(metrics.payoutAmount)));
}

function resolveM02ContractBase(
  statement?: Metrics,
  pos?: Metrics,
  contract?: Record<string, string> | null,
) {
  const fulfillmentBasis =
    numberValue(statement?.deliveryBasisAmount) + numberValue(statement?.pickupBasisAmount);
  if (fulfillmentBasis > 0) return fulfillmentBasis;

  const commissionBase = (contract?.commission_base ?? "").toLowerCase();
  if (commissionBase === "order_subtotal" || commissionBase === "restaurant_food_sales") {
    return numberValue(pos?.basisAmount) || numberValue(statement?.basisAmount);
  }
  return numberValue(statement?.basisAmount) || numberValue(pos?.basisAmount);
}

function resolveReconciliationStatementBasis(context: RuleContext) {
  if (context.moduleId !== "M02") return numberValue(context.statement?.metrics?.basisAmount);
  return resolveComparableM02StatementBasis(context.statement?.metrics, context.pos?.metrics);
}

function resolveComparableM02StatementBasis(statement?: Metrics, pos?: Metrics) {
  const totalBasis = numberValue(statement?.basisAmount);
  const deliveryBasis = numberValue(statement?.deliveryBasisAmount);
  const pickupBasis = numberValue(statement?.pickupBasisAmount);
  const posBasis = numberValue(pos?.basisAmount);

  if (deliveryBasis <= 0 || pickupBasis <= 0 || posBasis <= 0) return totalBasis;
  return Math.abs(deliveryBasis - posBasis) < Math.abs(totalBasis - posBasis)
    ? deliveryBasis
    : totalBasis;
}

function resolveComparableM02OrderCounts(statement?: Metrics, pos?: Metrics) {
  const totalOrderCount = Math.max(
    0,
    numberValue(statement?.orderCount) || numberValue(statement?.transactionCount),
  );
  const duplicateOrderCount = Math.min(
    totalOrderCount,
    Math.max(0, numberValue(statement?.duplicateOrderCount)),
  );
  const posOrderCount = Math.max(
    0,
    numberValue(pos?.orderCount) || numberValue(pos?.transactionCount),
  );
  const totalBasis = numberValue(statement?.basisAmount);
  const deliveryBasis = numberValue(statement?.deliveryBasisAmount);
  const pickupBasis = numberValue(statement?.pickupBasisAmount);
  const posBasis = numberValue(pos?.basisAmount);
  const deliveryOnlyScope =
    deliveryBasis > 0 &&
    pickupBasis > 0 &&
    posBasis > 0 &&
    Math.abs(deliveryBasis - posBasis) < Math.abs(totalBasis - posBasis);

  if (deliveryOnlyScope) {
    const deliveryEventCount = Math.max(0, numberValue(statement?.deliveryOrderCount));
    return {
      posOrderCount,
      scope: "delivery_unique_orders",
      statementOrderCount: Math.max(0, deliveryEventCount - duplicateOrderCount),
    };
  }

  return {
    posOrderCount,
    scope: "all_unique_orders",
    statementOrderCount: Math.max(0, totalOrderCount - duplicateOrderCount),
  };
}

function computeM02Recovery(
  statement?: Metrics,
  pos?: Metrics,
  contract?: Record<string, string> | null,
) {
  if (!statement || !contract) return 0;
  const basisAmount = resolveM02ContractBase(statement, pos, contract);
  const actualCommission = computeActualM02Commission(statement);
  const expectedRate = computeExpectedM02Rate(contract, statement);
  return Math.max(0, roundCurrency(actualCommission - basisAmount * (expectedRate / 100)));
}

function resolveM03ExcludedSales(
  pos?: Metrics,
  contract?: Record<string, string> | null,
) {
  return Math.max(
    0,
    numberValue(pos?.taxRemittedAmount) +
      numberValue(contract?.excluded_sales_amount) +
      numberValue(contract?.gift_card_redemptions_amount) +
      numberValue(contract?.bottle_deposit_amount),
  );
}

function resolveM03CertifiedGrossSales(
  pos?: Metrics,
  contract?: Record<string, string> | null,
) {
  const grossSales = numberValue(pos?.basisAmount);
  const exclusions = resolveM03ExcludedSales(pos, contract);
  return Math.max(0, roundCurrency(grossSales - exclusions));
}

function computeExpectedM03Royalty(
  certifiedGrossSales: number,
  contract?: Record<string, string> | null,
) {
  return roundCurrency(certifiedGrossSales * (numberValue(contract?.royalty_rate_pct) / 100));
}

function computeExpectedM03MarketingFund(
  certifiedGrossSales: number,
  contract?: Record<string, string> | null,
) {
  return roundCurrency(certifiedGrossSales * (numberValue(contract?.marketing_fund_rate_pct) / 100));
}

function computeM03Recovery(
  statement?: Metrics,
  pos?: Metrics,
  contract?: Record<string, string> | null,
) {
  if (!statement || !pos || !contract) return 0;
  const certifiedGrossSales = resolveM03CertifiedGrossSales(pos, contract);
  const requiredRoyalty = computeExpectedM03Royalty(certifiedGrossSales, contract);
  const requiredMarketing = computeExpectedM03MarketingFund(certifiedGrossSales, contract);
  const reportedRoyalty = numberValue(statement.feeAmount);
  const reportedMarketing = numberValue(statement.marketingFeeAmount || statement.otherFeeAmount);
  return Math.max(
    0,
    roundCurrency((requiredRoyalty - reportedRoyalty) + Math.max(0, requiredMarketing - reportedMarketing)),
  );
}

function contractFieldCount(values: Record<string, string>) {
  return Object.entries(values).filter(([key, value]) => key !== "__entry_mode" && Boolean(value)).length;
}

function relativeDelta(left: number, right: number) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1);
}

function scoreDetail(scorePct: number, detail: string): Mq6Score {
  return {
    badge: scorePct >= 85 ? "PASS" : scorePct >= 60 ? "PARTIAL" : "FAIL",
    detail,
    scorePct: clamp(roundInteger(scorePct), 0, 100),
  };
}

function truthyContractFlag(contract: Record<string, string> | null | undefined, key: string) {
  const value = textValue(contract?.[key]);
  return value === "true" || value === "yes" || value === "1" || value === "enabled";
}

function resolveVendorName(context: RuleContext) {
  return [
    context.statement?.label,
    context.statement?.key,
    context.agreement?.label,
    context.agreement?.key,
    context.contract?.vendor,
    context.contract?.processor,
    context.contract?.dsp,
  ]
    .map((value) => textValue(value ?? ""))
    .find((value) => value.length > 0) ?? "";
}

function surchargeRestrictedState(contract: Record<string, string> | null | undefined) {
  const state = textValue(contract?.state || contract?.jurisdiction);
  return ["ca", "co", "ct", "ma", "me", "ny", "ok"].some((token) => state === token || state.includes(token));
}
