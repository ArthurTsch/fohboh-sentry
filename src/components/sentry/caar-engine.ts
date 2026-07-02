import type {
  CaarDimension,
  CaarRecord,
  IntakeState,
  LocationModuleState,
  LocationRecord,
  UploadModule,
} from "./types";
import {
  getRuleSetVersion,
  runDeterministicModuleEngine,
  type FindingClass,
  type Mq6Score,
  type RuleCitation,
} from "@/lib/mge/engine";

export type CertificationStep = {
  detail: string;
  done: boolean;
  label: string;
};

export type ModuleAssessment = {
  artifactCoverage: number;
  dimensions: Record<
    | "Auditability"
    | "Cross-System Reconciliation"
    | "Data Completeness"
    | "Data Freshness"
    | "Rule Integrity"
    | "Source Authenticity",
    number
  >;
  findingClass: FindingClass;
  findings: string[];
  moduleId: "M01" | "M02";
  mq6: Record<string, Mq6Score>;
  note: string;
  ready: boolean;
  recoveryValue: number;
  ruleCitations: RuleCitation[];
  score: number;
};

export type CertificationResult = {
  assessments: ModuleAssessment[];
  amountValue: number;
  cadence: "monthly_final" | "weekly_preliminary";
  ready: boolean;
  record: CaarRecord;
  ruleSetVersion: string;
  status: LocationRecord["status"];
  steps: CertificationStep[];
  trustScore: number;
  updatedModules: LocationModuleState[];
  updatedRecovery: string;
};

type ContractState = Record<string, Record<string, string>>;
type DimensionName = keyof ModuleAssessment["dimensions"];

const DIMENSION_ORDER: DimensionName[] = [
  "Data Completeness",
  "Data Freshness",
  "Source Authenticity",
  "Cross-System Reconciliation",
  "Rule Integrity",
  "Auditability",
];

const DIMENSION_LABELS: Record<CaarDimension["name"], string> = {
  Auditability: "20%",
  "Cross-System Reconciliation": "25%",
  "Data Completeness": "10%",
  "Data Freshness": "10%",
  "Rule Integrity": "15%",
  "Source Authenticity": "20%",
};

const DIMENSION_WEIGHTS: Record<CaarDimension["name"], number> = {
  Auditability: 0.2,
  "Cross-System Reconciliation": 0.25,
  "Data Completeness": 0.1,
  "Data Freshness": 0.1,
  "Rule Integrity": 0.15,
  "Source Authenticity": 0.2,
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function buildCertificationResult({
  artifactContractState,
  artifactIntakeState,
  cadence = "monthly_final",
  location,
  period,
  recordId,
  runAt,
  uploadModules,
}: {
  artifactContractState: ContractState;
  artifactIntakeState: Record<string, IntakeState>;
  cadence?: "monthly_final" | "weekly_preliminary";
  location: LocationRecord;
  period?: string;
  recordId?: string;
  runAt?: Date;
  uploadModules: UploadModule[];
}): CertificationResult {
  const evaluationDate = runAt ?? new Date();
  const ruleSetVersion = getRuleSetVersion(cadence);
  const modules = (["M01", "M02"] as const)
    .map((moduleId) =>
      assessModule({
        accountId: location.accountId,
        artifactContractState,
        artifactIntakeState,
        cadence,
        evaluationDate,
        locationId: location.id,
        moduleId,
        uploadModules,
      }),
    )
    .filter((module): module is ModuleAssessment => module !== null);

  const activeModules = modules.length > 0 ? modules : [emptyModule("M01"), emptyModule("M02")];
  const overallDimensions = DIMENSION_ORDER.map((name) => ({
    name,
    score: clamp(
      round(
        activeModules.reduce((sum, assessment) => sum + assessment.dimensions[name], 0) /
          Math.max(activeModules.length, 1),
      ),
      0,
      100,
    ),
    weight: DIMENSION_LABELS[name],
  }));
  const trustScore = clamp(
    round(
      overallDimensions.reduce(
        (sum, dimension) => sum + dimension.score * DIMENSION_WEIGHTS[dimension.name],
        0,
      ),
    ),
    0,
    100,
  );
  const ready =
    cadence === "monthly_final" &&
    activeModules.every((module) => module.ready) &&
    trustScore >= 85;
  const amountValue = Math.max(
    0,
    round(activeModules.reduce((sum, module) => sum + module.recoveryValue, 0)),
  );
  const stamp = evaluationDate.toISOString().replace(/[-:TZ.]/g, "").slice(2, 14);
  const resolvedPeriod = period ?? `${MONTH_NAMES[evaluationDate.getUTCMonth()]} ${evaluationDate.getUTCFullYear()}`;
  const record: CaarRecord = {
    accountId: location.accountId,
    amount: formatCurrency(amountValue),
    dimensions: overallDimensions,
    exhibits: estimateExhibitCount(activeModules),
    findings: buildOverallFindings(location.name, activeModules, cadence, ready, amountValue),
    id: recordId ?? `CAAR-${stamp}-${location.id.replace(/[^0-9A-Za-z]/g, "")}`,
    locationId: location.id,
    locationName: location.name,
    narrative: buildNarrative(location.name, activeModules, cadence, trustScore, ready),
    period: resolvedPeriod,
    status: ready ? "Court Admissible" : "Needs Remediation",
    trustScore,
  };

  const updatedModules = mergeLocationModules(location.modules, activeModules);
  const evidenceScore = clamp(
    round(
      activeModules.reduce(
        (sum, assessment) => sum + assessment.dimensions["Source Authenticity"],
        0,
      ) / Math.max(activeModules.length, 1),
    ),
    0,
    100,
  );
  const evidenceNote = ready
    ? "Evidence package is fully authenticated, governed, and certification-ready."
    : cadence === "weekly_preliminary"
      ? "Weekly preliminary run completed. Final bank-reconciliation evidence is deferred until the monthly final."
      : "Evidence package still has unresolved authenticity, completeness, or reconciliation gaps.";
  upsertEvidenceModule(updatedModules, evidenceScore, evidenceNote);

  return {
    assessments: activeModules,
    amountValue,
    cadence,
    ready,
    record,
    ruleSetVersion,
    status: ready ? "Certified" : trustScore >= 55 ? "At Risk" : "Onboarding",
    steps: buildCertificationSteps(activeModules, cadence, ready),
    trustScore,
    updatedModules,
    updatedRecovery: formatCurrency(amountValue),
  };
}

export function extractUploadMetrics(artifactKey: string, headers: string[], rows: string[][]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const metrics = {
    adjustmentAmount: 0,
    basisAmount: 0,
    chargebackCount: 0,
    commissionRateAppliedAvg: 0,
    depositAmount: 0,
    deliveryFeeAmount: 0,
    deliveryOrderCount: 0,
    errorChargeAmount: 0,
    feeAmount: 0,
    interchangeFeeAmount: 0,
    marketingFeeAmount: 0,
    mcCreditAmount: 0,
    mcCreditFeeAmount: 0,
    mcDebitAmount: 0,
    mcDebitFeeAmount: 0,
    memberOrderCount: 0,
    otherFeeAmount: 0,
    orderCount: 0,
    pickupOrderCount: 0,
    promoOrderCount: 0,
    payoutAmount: 0,
    refundCount: 0,
    serviceFeeAmount: 0,
    taxRemittedAmount: 0,
    tipAmount: 0,
    transactionCount: 0,
    voidCount: 0,
    visaCreditAmount: 0,
    visaCreditFeeAmount: 0,
    visaDebitAmount: 0,
    visaDebitFeeAmount: 0,
  };
  let commissionRateSampleCount = 0;

  for (const row of rows) {
    const valueFor = (...names: string[]) =>
      names
        .map((name) => normalizedHeaders.indexOf(normalizeHeader(name)))
        .find((index) => index >= 0) ?? -1;

    const read = (...names: string[]) => {
      const index = valueFor(...names);
      return index >= 0 ? parseNumber(row[index]) : 0;
    };

    metrics.basisAmount += read(
      "trans_amount",
      "gross_amount",
      "amount",
      "txn_amount",
      "transaction_amount",
      "platform_gross_sales",
      "order_subtotal",
      "restaurant_food_sales",
      "gross_sales",
      "channel_sales",
      "pos_merchant_sales",
    );
    metrics.feeAmount += read(
      "fee_amount",
      "processing_fees",
      "fee",
      "disc_amount",
      "interchange_fee",
      "commission_charged",
      "dd_commission_amount",
      "grubhub_commission",
      "slice_commission",
      "transaction_fees",
    );
    metrics.interchangeFeeAmount += read("interchange_fee", "interchange_amount");
    metrics.serviceFeeAmount += read("service_fee", "processing_fees", "transaction_fees");
    metrics.otherFeeAmount += read("other_merchant_fees", "assessment");
    metrics.marketingFeeAmount += read("marketing_fee", "marketing_contribution");
    metrics.taxRemittedAmount += read("tax_remitted", "tax");
    metrics.tipAmount += read("tip");
    metrics.adjustmentAmount += read("adjustment_amount", "adjustment");
    metrics.errorChargeAmount += read("error_charge");
    metrics.deliveryFeeAmount += read("delivery_fee", "consumer_fee");
    metrics.payoutAmount += read(
      "payout_amount",
      "net_payout",
      "platform_net_sales",
      "bank_deposit_amount",
    );
    metrics.depositAmount += read(
      "bank_deposit_amount",
      "total_dsp_deposits",
      "deposit_amount",
      "net_payout",
      "payout_amount",
    );

    const commissionRateApplied = read("commission_rate_applied", "dd_commission_rate");
    if (commissionRateApplied > 0) {
      metrics.commissionRateAppliedAvg += commissionRateApplied;
      commissionRateSampleCount += 1;
    }

    const orderTypeIndex = valueFor("order_type", "channel");
    const orderType = orderTypeIndex >= 0 ? String(row[orderTypeIndex] ?? "").toLowerCase() : "";
    if (orderType.includes("pickup")) metrics.pickupOrderCount += 1;
    if (orderType.includes("delivery")) metrics.deliveryOrderCount += 1;
    if (orderType.includes("dashpass") || orderType.includes("member") || orderType.includes("uber one")) {
      metrics.memberOrderCount += 1;
    }

    if (read("marketing_fee", "marketing_contribution") > 0) {
      metrics.promoOrderCount += 1;
    }

    const orderStatusIndex = valueFor("order_status", "trans_type", "description");
    const orderStatus = orderStatusIndex >= 0 ? String(row[orderStatusIndex] ?? "").toLowerCase() : "";
    if (orderStatus.includes("refund")) metrics.refundCount += 1;
    if (orderStatus.includes("void")) metrics.voidCount += 1;

    const disputeIndex = valueFor("dispute_id");
    if (disputeIndex >= 0 && String(row[disputeIndex] ?? "").trim()) {
      metrics.chargebackCount += 1;
    }
    const refundIdIndex = valueFor("refund_id");
    if (refundIdIndex >= 0 && String(row[refundIdIndex] ?? "").trim()) {
      metrics.refundCount += 1;
    }

    const cardTypeIndex = valueFor("card_type", "card_brand");
    if (cardTypeIndex >= 0) {
      const cardType = String(row[cardTypeIndex] ?? "").toLowerCase();
      const amount = read("trans_amount", "amount", "txn_amount", "transaction_amount");
      const fee = read("fee_amount", "fee", "disc_amount", "interchange_amount", "interchange_fee");
      if (cardType.includes("visa") && cardType.includes("debit")) {
        metrics.visaDebitAmount += amount;
        metrics.visaDebitFeeAmount += fee;
      } else if (cardType.includes("visa")) {
        metrics.visaCreditAmount += amount;
        metrics.visaCreditFeeAmount += fee;
      } else if ((cardType.includes("master") || cardType.includes("mc")) && cardType.includes("debit")) {
        metrics.mcDebitAmount += amount;
        metrics.mcDebitFeeAmount += fee;
      } else if (cardType.includes("master") || cardType.includes("mc")) {
        metrics.mcCreditAmount += amount;
        metrics.mcCreditFeeAmount += fee;
      }
    }
  }

  if (commissionRateSampleCount > 0) {
    metrics.commissionRateAppliedAvg = round(metrics.commissionRateAppliedAvg / commissionRateSampleCount);
  }

  metrics.transactionCount =
    round(sumColumn(normalizedHeaders, rows, ["transaction_count"])) || rows.length;
  metrics.orderCount =
    round(sumColumn(normalizedHeaders, rows, ["order_count", "menu_item_count"])) || rows.length;

  if (artifactKey.includes("bank")) {
    metrics.basisAmount = 0;
    metrics.feeAmount = 0;
    metrics.payoutAmount = metrics.depositAmount;
  }

  if (artifactKey.includes("pos")) {
    metrics.payoutAmount = 0;
    metrics.depositAmount = 0;
  }

  return metrics;
}

export function extractManualMetrics(artifactKey: string, values: Record<string, string>) {
  void artifactKey;
  return {
    adjustmentAmount: readValue(values, ["adjustment_amount"]),
    basisAmount: readValue(values, [
      "gross_volume",
      "gross_sales",
      "channel_sales",
      "platform_gross_sales",
      "total_dsp_deposits",
    ]),
    chargebackCount: readValue(values, ["chargeback_count"]),
    commissionRateAppliedAvg: readValue(values, ["commission_rate_applied"]),
    depositAmount: readValue(values, ["total_dsp_deposits"]),
    deliveryFeeAmount: readValue(values, ["delivery_fee_total"]),
    deliveryOrderCount: readValue(values, ["delivery_order_count"]),
    errorChargeAmount: readValue(values, ["error_charge_total"]),
    feeAmount: readValue(values, ["fees_total", "commission_total"]),
    interchangeFeeAmount: readValue(values, ["interchange_fee_total"]),
    marketingFeeAmount: readValue(values, ["marketing_fee_total"]),
    mcCreditAmount: readValue(values, ["mc_credit_amount"]),
    mcCreditFeeAmount: readValue(values, ["mc_credit_fee_amount"]),
    mcDebitAmount: readValue(values, ["mc_debit_amount"]),
    mcDebitFeeAmount: readValue(values, ["mc_debit_fee_amount"]),
    memberOrderCount: readValue(values, ["member_order_count"]),
    otherFeeAmount: readValue(values, ["other_fee_total"]),
    orderCount: readValue(values, ["order_count", "transaction_count"]),
    pickupOrderCount: readValue(values, ["pickup_order_count"]),
    promoOrderCount: readValue(values, ["promo_order_count"]),
    payoutAmount: readValue(values, ["payout_total"]),
    refundCount: readValue(values, ["refund_count"]),
    serviceFeeAmount: readValue(values, ["service_fee_total"]),
    taxRemittedAmount: readValue(values, ["tax_remitted_total"]),
    tipAmount: readValue(values, ["tip_total"]),
    transactionCount: readValue(values, ["transaction_count", "order_count"]),
    voidCount: readValue(values, ["void_count"]),
    visaCreditAmount: readValue(values, ["visa_credit_amount"]),
    visaCreditFeeAmount: readValue(values, ["visa_credit_fee_amount"]),
    visaDebitAmount: readValue(values, ["visa_debit_amount"]),
    visaDebitFeeAmount: readValue(values, ["visa_debit_fee_amount"]),
  };
}

function assessModule({
  accountId,
  artifactContractState,
  artifactIntakeState,
  cadence,
  evaluationDate,
  locationId,
  moduleId,
  uploadModules,
}: {
  accountId: string;
  artifactContractState: ContractState;
  artifactIntakeState: Record<string, IntakeState>;
  cadence: "monthly_final" | "weekly_preliminary";
  evaluationDate: Date;
  locationId: string;
  moduleId: "M01" | "M02";
  uploadModules: UploadModule[];
}): ModuleAssessment | null {
  const uploadModule = uploadModules.find(
    (item) => item.accountId === accountId && item.id === moduleId,
  );
  if (!uploadModule) return null;

  const artifacts = uploadModule.artifacts.map((artifact) => {
    const intake = resolveArtifactIntake(
      artifactIntakeState,
      accountId,
      locationId,
      moduleId,
      artifact.key,
    );
    const contractValues = resolveContractValues(
      artifactContractState,
      accountId,
      locationId,
      moduleId,
      artifact.key,
    );
    const manualReady =
      Boolean(contractValues) &&
      Object.entries(contractValues ?? {}).filter(
        ([key, value]) => key !== "__entry_mode" && Boolean(value),
      ).length >= 3;

    return {
      contractValues,
      fields: Boolean(intake?.fields || manualReady),
      hash: Boolean(intake?.hash || manualReady),
      key: artifact.key,
      label: artifact.label,
      metrics: intake?.metrics,
      schema: Boolean(intake?.schema || manualReady),
      type: artifact.type,
      updatedAt: intake?.updatedAt,
      uploaded: Boolean(intake?.uploaded || manualReady),
    };
  });

  const result = runDeterministicModuleEngine({
    artifacts,
    cadence,
    evaluationDate,
    moduleId,
  });

  return {
    artifactCoverage: result.artifactCoverage,
    dimensions: result.dimensions,
    findingClass: result.findingClass,
    findings: result.findings,
    moduleId,
    mq6: result.mq6,
    note: buildModuleNote(moduleId, result.score, result.findings, result.ruleCitations.length),
    ready: result.ready,
    recoveryValue: result.recoveryValue,
    ruleCitations: result.ruleCitations,
    score: result.score,
  };
}

function resolveArtifactIntake(
  state: Record<string, IntakeState>,
  accountId: string,
  locationId: string,
  moduleId: "M01" | "M02",
  artifactKey: string,
) {
  const prefix = `${accountId}:${locationId}:${moduleId}:${artifactKey}:`;
  const matches = Object.entries(state)
    .filter(([key, value]) => key.startsWith(prefix) && value.uploaded)
    .map(([, value]) => value)
    .sort((left, right) => {
      const leftReady = Number(left.hash && left.schema && left.fields);
      const rightReady = Number(right.hash && right.schema && right.fields);
      return rightReady - leftReady;
    });
  return matches[0] ?? null;
}

function resolveContractValues(
  state: ContractState,
  accountId: string,
  locationId: string,
  moduleId: "M01" | "M02",
  artifactKey: string,
) {
  const prefix = `${accountId}:${locationId}:${moduleId}:${artifactKey}:`;
  const key = Object.keys(state).find((candidate) => candidate.startsWith(prefix));
  return key ? state[key] : null;
}

function buildNarrative(
  locationName: string,
  modules: ModuleAssessment[],
  cadence: "monthly_final" | "weekly_preliminary",
  trustScore: number,
  ready: boolean,
) {
  const moduleSummary = modules
    .map(
      (module) =>
        `${module.moduleId} scored ${module.score} with ${module.ruleCitations.length} deterministic citation${module.ruleCitations.length === 1 ? "" : "s"}`,
    )
    .join("; ");

  if (ready) {
    return `${locationName} completed the certification pipeline successfully. ${moduleSummary}. The evidence package is sufficient for court-admissible release at Trust Score ${trustScore}.`;
  }
  if (cadence === "weekly_preliminary") {
    return `${locationName} completed a weekly preliminary certification. ${moduleSummary}. Bank-reconciliation proof is deferred until the monthly final cadence, so this output remains operational and non-court-admissible by design.`;
  }
  return `${locationName} completed deterministic certification analysis but remains below the final release threshold. ${moduleSummary}. Remediation is still required before external delivery.`;
}

function buildOverallFindings(
  locationName: string,
  modules: ModuleAssessment[],
  cadence: "monthly_final" | "weekly_preliminary",
  ready: boolean,
  amountValue: number,
) {
  const findings = modules.flatMap((module) => module.findings.slice(0, 3));
  if (amountValue > 0) {
    findings.unshift(
      `${locationName} currently shows ${formatCurrency(amountValue)} in computed recoverable variance across active modules.`,
    );
  }
  if (ready) {
    findings.unshift(
      `Certification run cleared all deterministic evidence and reconciliation gates for ${locationName}.`,
    );
  } else if (cadence === "weekly_preliminary") {
    findings.unshift(
      `Weekly preliminary certification for ${locationName} completed without the final bank-statement gate. This output is intended for early detection, not final external release.`,
    );
  } else {
    findings.unshift(
      `Certification run for ${locationName} remains blocked by one or more evidence, governance, or reconciliation controls.`,
    );
  }
  return dedupe(findings).slice(0, 8);
}

function buildCertificationSteps(
  modules: ModuleAssessment[],
  cadence: "monthly_final" | "weekly_preliminary",
  ready: boolean,
): CertificationStep[] {
  const completeness = round(
    modules.reduce((sum, module) => sum + module.artifactCoverage, 0) /
      Math.max(modules.length, 1),
  );
  const ruleIntegrity = round(
    modules.reduce((sum, module) => sum + module.dimensions["Rule Integrity"], 0) /
      Math.max(modules.length, 1),
  );
  const reconciliation = round(
    modules.reduce(
      (sum, module) => sum + module.dimensions["Cross-System Reconciliation"],
      0,
    ) / Math.max(modules.length, 1),
  );
  return [
    {
      detail: `${completeness}% of required governed artifacts passed structural completeness.`,
      done: completeness >= 80,
      label: "Define Semantic Truths",
    },
    {
      detail: `${ruleIntegrity}% rule-integrity confidence based on governed contract, statement, and schema inputs.`,
      done: ruleIntegrity >= 100,
      label: "Define Deterministic Law",
    },
    {
      detail:
        cadence === "weekly_preliminary"
          ? `${reconciliation}% reconciliation confidence across source and POS evidence. Final bank tie-out is deferred.`
          : `${reconciliation}% reconciliation confidence across source, POS, and bank evidence.`,
      done: reconciliation >= (cadence === "weekly_preliminary" ? 66 : 85),
      label: "Execute Loop A",
    },
    {
      detail: ready
        ? "Release threshold met and CAAR was generated."
        : cadence === "weekly_preliminary"
          ? "Preliminary run completed. Monthly Final is still required for court-admissible release."
          : "Run completed, but release remains blocked until missing controls are resolved.",
      done: ready,
      label: "Certify & Lock",
    },
  ];
}

function mergeLocationModules(
  currentModules: LocationModuleState[],
  assessments: ModuleAssessment[],
) {
  const nextModules = [...currentModules];
  for (const assessment of assessments) {
    const existingIndex = nextModules.findIndex((module) => module.label === assessment.moduleId);
    const nextState = {
      label: assessment.moduleId,
      note: assessment.note,
      score: assessment.score,
    };
    if (existingIndex === -1) {
      nextModules.push(nextState);
    } else {
      nextModules[existingIndex] = nextState;
    }
  }
  return nextModules;
}

function upsertEvidenceModule(
  modules: LocationModuleState[],
  score: number,
  note: string,
) {
  const existingIndex = modules.findIndex((module) => module.label === "Evidence");
  const nextState = {
    label: "Evidence",
    note,
    score,
  };
  if (existingIndex === -1) {
    modules.push(nextState);
  } else {
    modules[existingIndex] = nextState;
  }
}

function buildModuleNote(
  moduleId: "M01" | "M02",
  score: number,
  findings: string[],
  citationCount: number,
) {
  if (score >= 85 && citationCount === 0) {
    return moduleId === "M01"
      ? "Processor evidence, contract, and reconciliation gates are release-ready."
      : "DSP settlement, contract, and reconciliation controls are release-ready.";
  }
  if (citationCount > 0) {
    return `${citationCount} deterministic ${moduleId} rule citation${citationCount === 1 ? "" : "s"} require review.`;
  }
  return findings[0] ?? `${moduleId} still requires evidence remediation before release.`;
}

function emptyModule(moduleId: "M01" | "M02"): ModuleAssessment {
  return {
    artifactCoverage: 0,
    dimensions: {
      Auditability: 0,
      "Cross-System Reconciliation": 0,
      "Data Completeness": 0,
      "Data Freshness": 0,
      "Rule Integrity": 0,
      "Source Authenticity": 0,
    },
    findingClass: "INCONCLUSIVE",
    findings: [`${moduleId} has no certification artifacts yet.`],
    moduleId,
    mq6: {
      auditability: { badge: "FAIL", detail: "No audit trail exists yet.", scorePct: 0 },
      cross_system_reconciliation: {
        badge: "FAIL",
        detail: "No reconciliation evidence exists yet.",
        scorePct: 0,
      },
      data_completeness: {
        badge: "FAIL",
        detail: "No governed artifacts exist yet.",
        scorePct: 0,
      },
      data_freshness: { badge: "FAIL", detail: "No uploads exist yet.", scorePct: 0 },
      rule_integrity: {
        badge: "FAIL",
        detail: "No deterministic rule execution could occur.",
        scorePct: 0,
      },
      source_authenticity: {
        badge: "FAIL",
        detail: "No authenticated source evidence exists yet.",
        scorePct: 0,
      },
    },
    note: `${moduleId} has no certification artifacts yet.`,
    ready: false,
    recoveryValue: 0,
    ruleCitations: [],
    score: 0,
  };
}

function estimateExhibitCount(modules: ModuleAssessment[]) {
  return modules.reduce((sum, module) => sum + Math.max(module.ruleCitations.length, 2), 0);
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function sumColumn(headers: string[], rows: string[][], names: string[]) {
  const index = headers.findIndex((header) => names.includes(header));
  if (index === -1) return 0;
  return rows.reduce((sum, row) => sum + parseNumber(row[index]), 0);
}

function readValue(values: Record<string, string> | undefined | null, keys: string[]) {
  for (const key of keys) {
    const value = parseNumber(values?.[key]);
    if (value > 0) return value;
  }
  return 0;
}

function parseNumber(value: string | number | undefined | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function round(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
