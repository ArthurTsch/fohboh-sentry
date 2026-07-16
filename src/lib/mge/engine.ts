type ModuleId = "M01" | "M02";
type Cadence = "monthly_final" | "weekly_preliminary";

type Metrics = {
  adjustmentAmount?: number;
  basisAmount?: number;
  chargebackCount?: number;
  commissionRateAppliedAvg?: number;
  depositAmount?: number;
  deliveryFeeAmount?: number;
  deliveryOrderCount?: number;
  errorChargeAmount?: number;
  feeAmount?: number;
  interchangeFeeAmount?: number;
  marketingFeeAmount?: number;
  mcCreditAmount?: number;
  mcCreditFeeAmount?: number;
  mcDebitAmount?: number;
  mcDebitFeeAmount?: number;
  memberOrderCount?: number;
  otherFeeAmount?: number;
  orderCount?: number;
  pickupOrderCount?: number;
  promoOrderCount?: number;
  payoutAmount?: number;
  refundCount?: number;
  serviceFeeAmount?: number;
  taxRemittedAmount?: number;
  tipAmount?: number;
  transactionCount?: number;
  voidCount?: number;
  visaCreditAmount?: number;
  visaCreditFeeAmount?: number;
  visaDebitAmount?: number;
  visaDebitFeeAmount?: number;
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

type DeterministicRule = {
  evaluate: (context: RuleContext, residualVariance: number) => RuleCitation | null;
  id: string;
  module: ModuleId;
  version: string;
};

const MQ6_WEIGHTS: Record<Mq6DimensionName, number> = {
  Auditability: 0.2,
  "Cross-System Reconciliation": 0.25,
  "Data Completeness": 0.1,
  "Data Freshness": 0.1,
  "Rule Integrity": 0.15,
  "Source Authenticity": 0.2,
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
      const expectedTotal = computeExpectedM01Fees(statement, contract);
      const actualFees = numberValue(statement.feeAmount);
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
      const actualFees = numberValue(statement.feeAmount);
      const expectedTotal = computeExpectedM01Fees(statement, contract);
      const unexplained = roundCurrency(actualFees - expectedTotal);
      if (unexplained <= 1 || residualVariance <= 1) return null;
      const variance = Math.min(unexplained, residualVariance);
      return {
        firedCount: 1,
        ruleId: "MFR-BIL-15",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          actual_fee_amount: actualFees,
          expected_fee_amount: expectedTotal,
          unexplained_fee_delta: variance,
        }],
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
      const actualFees = numberValue(statement.feeAmount);
      const txnFee = numberValue(contract.txn_fee);
      const monthlyFee = numberValue(contract.monthly_fee);
      const transactionCount = Math.max(0, roundCurrency(numberValue(statement.transactionCount)));
      if (basisAmount <= 0 || markupBps <= 0 || actualFees <= 0 || residualVariance <= 1) return null;
      const observedRateBps =
        ((actualFees - transactionCount * txnFee - monthlyFee) / Math.max(basisAmount, 1)) * 10000;
      const excessRateBps = observedRateBps - markupBps;
      if (excessRateBps <= 5) return null;
      const variance = Math.min(roundCurrency((basisAmount * excessRateBps) / 10000), residualVariance);
      if (variance <= 1) return null;
      return {
        firedCount: 1,
        ruleId: "MFR-MRK-03",
        ruleVersion: RULE_VERSION,
        sampleEvidence: [{
          actual_rate_bps: roundCurrency(observedRateBps),
          basis_amount: basisAmount,
          contracted_markup_bps: markupBps,
          excess_rate_bps: roundCurrency(excessRateBps),
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
      const actualFees = numberValue(statement.feeAmount);
      const transactionCount = Math.max(0, roundCurrency(numberValue(statement.transactionCount)));
      const txnFee = numberValue(contract.txn_fee);
      if (actualFees <= 0 || transactionCount <= 0 || residualVariance <= 1) return null;
      const observedPerTxn = actualFees / Math.max(transactionCount, 1);
      const excessPerTxn = observedPerTxn - txnFee;
      if (txnFee <= 0 || excessPerTxn <= 0.02) return null;
      const variance = Math.min(roundCurrency(excessPerTxn * transactionCount), residualVariance);
      if (variance <= 1) return null;
      return {
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
      const actualFees = numberValue(statement.feeAmount);
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
      const feeAmount = numberValue(statement.feeAmount);
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
      const feeAmount = numberValue(statement.feeAmount);
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
      const expectedRate = computeExpectedM02Rate(contract);
      const basisAmount = resolveM02ContractBase(statement, context.pos?.metrics, contract);
      if (actualCommission <= 0 || expectedRate <= 0 || basisAmount <= 0 || residualVariance <= 1) return null;
      const observedRate = (actualCommission / Math.max(basisAmount, 1)) * 100;
      const variance = Math.min(
        roundCurrency(Math.max(0, actualCommission - basisAmount * (expectedRate / 100))),
        residualVariance,
      );
      if (observedRate <= expectedRate + 0.5 || variance <= 1) return null;
      return {
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
      const expectedRate = computeExpectedM02Rate(contract);
      const statementBasis = numberValue(statement.basisAmount);
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
      const expectedRate = computeExpectedM02Rate(contract);
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
      const expectedRate = computeExpectedM02Rate(contract);
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
      const expectedRate = computeExpectedM02Rate(contract);
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
      const statementOrders = Math.max(
        roundCurrency(numberValue(statement.orderCount)),
        roundCurrency(numberValue(statement.transactionCount)),
      );
      const posOrders = Math.max(
        roundCurrency(numberValue(pos.orderCount)),
        roundCurrency(numberValue(pos.transactionCount)),
      );
      if (statementOrders <= 0 || posOrders <= 0 || statementOrders <= posOrders) return null;
      const duplicateCount = statementOrders - posOrders;
      if (duplicateCount < 2) return null;
      const avgFeePerOrder = computeActualM02Commission(statement) / Math.max(statementOrders, 1);
      const variance = Math.min(roundCurrency(avgFeePerOrder * duplicateCount), residualVariance);
      if (variance <= 1) return null;
      return {
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
      const expectedRate = computeExpectedM02Rate(contract);
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
];

export function getRuleSetVersion(cadence: Cadence) {
  return cadence === "weekly_preliminary" ? "mge-v1.0.0-weekly-prelim" : RULE_VERSION;
}

export function runDeterministicModuleEngine(input: ModuleEngineInput): ModuleEngineResult {
  const statement = resolveArtifact(input.artifacts, input.moduleId === "M01" ? "processor" : "settlement");
  const pos = resolveArtifact(input.artifacts, "pos");
  const agreement = resolveArtifact(input.artifacts, "agreement");
  const bank = resolveArtifact(input.artifacts, "bank");
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
      ? computeM01Recovery(statement?.metrics, contract)
      : computeM02Recovery(statement?.metrics, pos?.metrics, contract),
  );
  const ruleCitations = runLoopA(context, recoveryValue);
  const reviewedFeeVolume = computeReviewedFeeVolume(context);
  const trustGates = computeTrustGateScores({
    cadence: input.cadence,
    context,
    dimensions,
    reviewedFeeVolume,
    ruleCitations,
  });
  const systemHealth = computeSystemHealth(input.systemHealthFlags ?? []);
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
  const ready =
    input.cadence === "monthly_final" &&
    certificationZone === "CERTIFIED" &&
    ruleIntegrity.scorePct >= 100 &&
    trustGates.TG10.scorePct >= 100 &&
    trustGates.TG11.scorePct >= 100 &&
    systemHealth.masterSystemHealthy;

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

function runLoopA(context: RuleContext, recoveryValue: number) {
  const rules = [...(context.moduleId === "M01" ? M01_RULES : M02_RULES)].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const citations: RuleCitation[] = [];
  let residualVariance = Math.max(0, recoveryValue);

  for (const rule of rules) {
    const citation = rule.evaluate(context, residualVariance);
    if (!citation) continue;
    citations.push(citation);
    residualVariance = Math.max(0, residualVariance - centsToDollars(citation.varianceCents));
  }

  return citations;
}

function computeReviewedFeeVolume(context: RuleContext) {
  if (context.moduleId === "M01") {
    return Math.max(
      numberValue(context.statement?.metrics?.basisAmount),
      numberValue(context.pos?.metrics?.basisAmount),
      numberValue(context.statement?.metrics?.feeAmount),
    );
  }

  if (context.moduleId === "M02") {
    return Math.max(
      resolveM02ContractBase(context.statement?.metrics, context.pos?.metrics, context.contract),
      computeActualM02Commission(context.statement?.metrics ?? {}),
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
  const statementBasis = numberValue(context.statement?.metrics?.basisAmount);
  const reconciliationGapPct =
    statementBasis > 0 && posBasis > 0
      ? relativeDelta(statementBasis, posBasis) * 100
      : null;
  const contractEffectiveDate = parseDateValue(context.contract?.effective_date);
  const contractAgeDays =
    contractEffectiveDate === null
      ? null
      : Math.floor((context.evaluationDate.getTime() - contractEffectiveDate.getTime()) / (1000 * 60 * 60 * 24));
  const statementPresent = Boolean(context.statement?.uploaded);
  const posPresent = Boolean(context.pos?.uploaded);
  const agreementPresent = Boolean(context.agreement?.uploaded);
  const bankPresent = cadence === "weekly_preliminary" ? true : Boolean(context.bank?.uploaded);
  const coreSourcePackagePresent = statementPresent && posPresent && agreementPresent;
  const coreStructuredPackageReady =
    artifactSatisfiesCompleteness(context, context.statement ?? null) &&
    artifactSatisfiesCompleteness(context, context.pos ?? null) &&
    agreementPresent;
  const allRequiredArtifactsPresent = coreSourcePackagePresent && bankPresent;
  const allRequiredArtifactsGoverned =
    artifactSatisfiesCompleteness(context, context.statement ?? null) &&
    artifactSatisfiesCompleteness(context, context.pos ?? null) &&
    (cadence === "weekly_preliminary" || artifactSatisfiesCompleteness(context, context.bank ?? null)) &&
    Boolean(agreementPresent && context.agreement?.hash) &&
    Boolean(context.contract && contractFieldCount(context.contract) >= 3);

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
      : contractAgeDays !== null && contractAgeDays > 180
        ? 50
        : 100,
    !context.contract || contractFieldCount(context.contract) < 3
      ? "No governed vendor profile / contract terms are available for the certification period."
      : contractAgeDays !== null && contractAgeDays > 180
        ? "Vendor profile is present but older than the 180-day currency window."
        : "Vendor profile and contract terms are current for the certification period.",
    ["R120", "R121"],
  );

  const tg04Score =
    dimensions["Cross-System Reconciliation"] <= 0 || reconciliationGapPct === null
      ? 0
      : reconciliationGapPct <= 1
        ? 100
        : reconciliationGapPct > 5
          ? 0
          : roundInteger(100 - ((reconciliationGapPct - 1) / 4) * 100);
  const tg04 = buildTrustGateScore(
    "TG04",
    tg04Score,
    dimensions["Cross-System Reconciliation"] <= 0 || reconciliationGapPct === null
      ? "POS and source evidence could not be reconciled for the active period."
      : reconciliationGapPct <= 1
        ? "POS-to-source reconciliation is within the ±1% tolerance band."
        : reconciliationGapPct > 5
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
    cadence === "weekly_preliminary"
      ? Math.max(75, dimensions["Data Freshness"])
      : coreStructuredPackageReady
        ? 75
      : allRequiredArtifactsPresent
        ? Math.max(80, dimensions["Data Freshness"])
        : 40,
    cadence === "weekly_preliminary"
      ? "Weekly preliminary coverage is accepted without the final bank evidence gate."
      : coreStructuredPackageReady
        ? "Core source artifacts cover the active period, but monthly-final release is still awaiting the bank tie-out package."
      : allRequiredArtifactsPresent
        ? "Required certification artifacts cover the active period without a visible evidence gap."
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
  const bankComplete =
    context.cadence === "weekly_preliminary"
      ? true
      : context.bank
        ? artifactSatisfiesCompleteness(context, context.bank)
        : false;

  let score = baseScore;
  if (!statementComplete || !posComplete) {
    // A broken source or POS file means the package is present but not structurally certifiable.
    score = Math.min(score, 20);
  } else if (!bankComplete) {
    // Monthly-final runs without the governed bank artifact stay in the blocked middle band.
    score = Math.min(score, 40);
  }

  return scoreDetail(
    score,
    `${satisfied} of ${requiredArtifacts.length} required certification artifacts passed the structural completeness gate.`,
  );
}

function scoreDataFreshness(context: RuleContext): Mq6Score {
  const uploads = context.artifacts.filter((artifact) => artifact.uploaded && artifact.updatedAt);
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
  const bankRequired = context.cadence === "monthly_final";
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
        ? "weekly preliminary source evidence verified"
        : "weekly preliminary source evidence incomplete",
  ];

  return scoreDetail(score, detailParts.join("; "));
}

function scoreCrossSystemReconciliation(context: RuleContext): Mq6Score {
  let score = 0;
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
  const bankGoverned = Boolean(context.bank?.uploaded && context.bank.hash);
  const statementBasis = numberValue(context.statement?.metrics?.basisAmount);
  const posBasis = numberValue(context.pos?.metrics?.basisAmount);
  const statementFees = numberValue(context.statement?.metrics?.feeAmount);
  const bankDeposit = numberValue(context.bank?.metrics?.depositAmount);
  const payoutAmount = numberValue(context.statement?.metrics?.payoutAmount);

  if (statementGoverned && posGoverned && statementBasis > 0 && posBasis > 0) {
    const delta = relativeDelta(statementBasis, posBasis);
    if (delta <= 0.05) {
      score += 25;
      detailParts.push("POS-to-source basis tied within 5%.");
    } else if (delta <= 0.12) {
      score += 12;
      detailParts.push("POS-to-source basis tied within 12% but remains outside final tolerance.");
    } else {
      detailParts.push("POS-to-source basis failed tolerance.");
    }
  } else {
    detailParts.push("POS-to-source basis could not be reconciled.");
  }

  if (statementGoverned && statementFees > 0 && context.contract) {
    score += 25;
    detailParts.push("Contract-driven shadow fee could be computed from governed statement evidence.");
  } else {
    detailParts.push("Contract or statement evidence was insufficient for shadow fee computation.");
  }

  if (context.cadence === "weekly_preliminary") {
    score += 50;
    detailParts.push("Monthly bank tie-out deferred by weekly preliminary cadence.");
  } else if (statementGoverned && bankGoverned && bankDeposit > 0 && payoutAmount > 0) {
    const delta = relativeDelta(bankDeposit, payoutAmount);
    if (delta <= 0.05) {
      score += 50;
      detailParts.push("Settlement-to-bank tie-out cleared within 5%.");
    } else if (delta <= 0.12) {
      score += 25;
      detailParts.push("Settlement-to-bank tie-out remains outside final tolerance.");
    } else {
      detailParts.push("Settlement-to-bank tie-out failed.");
    }
  } else {
    detailParts.push("Bank reconciliation evidence missing.");
  }

  return scoreDetail(score, detailParts.join(" "));
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
  for (const citation of ruleCitations) {
    findings.push(`${citation.ruleId} fired with ${formatCurrency(centsToDollars(citation.varianceCents))} in attributed variance.`);
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
  const basisAmount = numberValue(statement.basisAmount);
  const actualFees = numberValue(statement.feeAmount);
  const pricingModel = String(contract.pricing_model ?? contract.contract_type ?? "").toLowerCase();
  if (basisAmount <= 0 || actualFees <= 0 || !pricingModel.includes("tier")) return null;
  const expectedTotal = computeExpectedM01Fees(statement, contract);
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
    firedCount,
    ruleId,
    ruleVersion: RULE_VERSION,
    sampleEvidence: [sampleEvidence],
    varianceCents: dollarsToCents(varianceDollars),
  };
}

function isRequiredArtifact(context: RuleContext, artifact: ModuleArtifactState) {
  if (artifact.key.includes("bank")) {
    return context.cadence === "monthly_final";
  }
  return artifact.key.includes("processor") ||
    artifact.key.includes("settlement") ||
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
  if (artifact.key.includes("bank") && context.cadence === "weekly_preliminary") {
    return true;
  }
  return artifact.uploaded && artifact.hash;
}

function resolveArtifact(artifacts: ModuleArtifactState[], token: string) {
  return artifacts.find((artifact) => artifact.key.includes(token)) ?? null;
}

function computeExpectedM01Fees(metrics: Metrics, contract: Record<string, string>) {
  const basisAmount = numberValue(metrics.basisAmount);
  const markupBps = numberValue(contract.markup_bps);
  const txnFee = numberValue(contract.txn_fee);
  const monthlyFee = numberValue(contract.monthly_fee);
  const transactionCount = Math.max(0, roundInteger(numberValue(metrics.transactionCount)));
  return roundCurrency(
    basisAmount * (markupBps / 10000) + (transactionCount * txnFee) + monthlyFee,
  );
}

function getM01RateTable(contract?: Record<string, string> | null) {
  return {
    mastercard_credit: {
      fixedCents: numberValue(contract?.mastercard_credit_fixed_cents) || 10,
      ratePct: numberValue(contract?.mastercard_credit_rate_pct) || 1.85,
    },
    mastercard_debit: {
      fixedCents: numberValue(contract?.mastercard_debit_fixed_cents) || 22,
      ratePct: numberValue(contract?.mastercard_debit_rate_pct) || 0.05,
    },
    visa_credit: {
      fixedCents: numberValue(contract?.visa_credit_fixed_cents) || 10,
      ratePct: numberValue(contract?.visa_credit_rate_pct) || 1.85,
    },
    visa_debit: {
      fixedCents: numberValue(contract?.visa_debit_fixed_cents) || 22,
      ratePct: numberValue(contract?.visa_debit_rate_pct) || 0.05,
    },
  };
}

function computeCardBrandFee(amount: number, ratePct: number, fixedCents: number) {
  return roundCurrency(amount * (ratePct / 100) + (fixedCents / 100));
}

function computeM01Recovery(metrics?: Metrics, contract?: Record<string, string> | null) {
  if (!metrics || !contract) return 0;
  return Math.max(0, roundCurrency(numberValue(metrics.feeAmount) - computeExpectedM01Fees(metrics, contract)));
}

function computeExpectedM02Rate(contract: Record<string, string>) {
  const rates = [
    numberValue(contract.rate_delivery),
    numberValue(contract.rate_member),
    numberValue(contract.rate_pickup),
    numberValue(contract.rate_catering),
    numberValue(contract.rate_sponsored),
  ].filter((value) => value > 0);
  return rates.length > 0 ? roundCurrency(rates.reduce((sum, value) => sum + value, 0) / rates.length) : 0;
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
  const commissionBase = (contract?.commission_base ?? "").toLowerCase();
  if (commissionBase === "order_subtotal" || commissionBase === "restaurant_food_sales") {
    return numberValue(pos?.basisAmount) || numberValue(statement?.basisAmount);
  }
  return numberValue(statement?.basisAmount) || numberValue(pos?.basisAmount);
}

function computeM02Recovery(
  statement?: Metrics,
  pos?: Metrics,
  contract?: Record<string, string> | null,
) {
  if (!statement || !contract) return 0;
  const basisAmount = resolveM02ContractBase(statement, pos, contract);
  const actualCommission = computeActualM02Commission(statement);
  const expectedRate = computeExpectedM02Rate(contract);
  return Math.max(0, roundCurrency(actualCommission - basisAmount * (expectedRate / 100)));
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

function centsToDollars(value: number) {
  return value / 100;
}

function dollarsToCents(value: number) {
  return Math.round(value * 100);
}

function numberValue(value: number | string | undefined | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateValue(value: string | undefined | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundInteger(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}
