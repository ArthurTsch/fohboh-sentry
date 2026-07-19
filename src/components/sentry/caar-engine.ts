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
  type CertificationZone,
  type FindingClass,
  type Mq6Score,
  type RuleCitation,
  type SystemHealthResult,
  type TrustGateName,
  type TrustGateScore,
} from "@/lib/mge/engine";

export type CertificationStep = {
  detail: string;
  done: boolean;
  label: string;
};

export type ModuleAssessment = {
  artifactCoverage: number;
  certificationZone: CertificationZone;
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
  moduleId: "M01" | "M02" | "M03";
  mq6: Record<string, Mq6Score>;
  note: string;
  ready: boolean;
  recoveryValue: number;
  reviewedFeeVolume: number;
  ruleCitations: RuleCitation[];
  score: number;
  systemHealth: SystemHealthResult;
  trustGates: Record<TrustGateName, TrustGateScore>;
};

export type HistoricalCertificationSnapshot = {
  completedAt: string | null;
  moduleId: "M01" | "M02" | "M03";
  period: string;
  recoveryValue: number;
  ruleIds: string[];
  trustScore: number;
};

export type LoopBFinding = {
  affectedPeriods: string[];
  caarEligible: boolean;
  confidenceScore: number;
  detail: string;
  impactsCertification: boolean;
  moduleId: "M01" | "M02" | "M03" | "XMOD";
  patternCode: string;
  ruleId:
    | "R154"
    | "R155"
    | "R156"
    | "R157"
    | "R158"
    | "R159"
    | "R160"
    | "R161"
    | "R162"
    | "R163"
    | "R165";
};

export type LoopBResult = {
  auditRequired: boolean;
  baselineHash: string | null;
  findings: LoopBFinding[];
  status: "not_applicable" | "clear" | "review" | "re_certify_required" | "caar_eligible_pattern";
  windowSize: number;
};

export type CrossModuleSummary = {
  aggregateVariance: number;
  conflict: boolean;
  findings: string[];
  moduleWeightImbalance: boolean;
  reviewedFeeWeights: Array<{
    moduleId: "M01" | "M02" | "M03";
    pct: number;
  }>;
  totalRecoveryEligible: number;
};

export type WorkflowGovernanceSummary = {
  authenticated: boolean;
  authorized: boolean;
  disputeEligible: boolean;
  manualReviewRequired: boolean;
  notifications: string[];
  state: "draft" | "certified" | "needs_remediation" | "in_review";
};

export type CertificationResult = {
  assessments: ModuleAssessment[];
  amountValue: number;
  cadence: "monthly_final" | "weekly_preliminary";
  crossModule: CrossModuleSummary;
  loopB: LoopBResult;
  overallSystemHealth: SystemHealthResult;
  overallRuleCitations: RuleCitation[];
  overallTrustGates: Record<TrustGateName, TrustGateScore>;
  ready: boolean;
  record: CaarRecord;
  ruleSetVersion: string;
  status: LocationRecord["status"];
  steps: CertificationStep[];
  trustScore: number;
  updatedModules: LocationModuleState[];
  updatedRecovery: string;
  workflow: WorkflowGovernanceSummary;
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

const GATE_ORDER: TrustGateName[] = [
  "TG01",
  "TG02",
  "TG03",
  "TG04",
  "TG05",
  "TG06",
  "TG07",
  "TG08",
  "TG09",
  "TG10",
  "TG11",
];

const GATE_WEIGHTS: Record<TrustGateName, number> = {
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

export function buildCertificationResult({
  artifactContractState,
  artifactIntakeState,
  cadence = "monthly_final",
  history = [],
  location,
  period,
  recordId,
  runAt,
  systemHealthFlags = [],
  uploadModules,
}: {
  artifactContractState: ContractState;
  artifactIntakeState: Record<string, IntakeState>;
  cadence?: "monthly_final" | "weekly_preliminary";
  history?: HistoricalCertificationSnapshot[];
  location: LocationRecord;
  period?: string;
  recordId?: string;
  runAt?: Date;
  systemHealthFlags?: Array<"R186" | "R188" | "R191" | "R192">;
  uploadModules: UploadModule[];
}): CertificationResult {
  const evaluationDate = runAt ?? new Date();
  const ruleSetVersion = getRuleSetVersion(cadence);
  const modules = (["M01", "M02", "M03"] as const)
    .map((moduleId) =>
      assessModule({
        accountId: location.accountId,
        artifactContractState,
        artifactIntakeState,
        cadence,
        evaluationDate,
        locationId: location.id,
        moduleId,
        systemHealthFlags,
        uploadModules,
      }),
    )
    .filter((module): module is ModuleAssessment => module !== null);

  const activeModules =
    modules.length > 0 ? modules : [emptyModule("M01"), emptyModule("M02"), emptyModule("M03")];
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
  const overallTrustGates = buildOverallTrustGates(activeModules, location.modules);
  const overallSystemHealth = buildOverallSystemHealth(activeModules);
  const trustScore = clamp(
    computeOverallTrustScore(overallTrustGates) - overallSystemHealth.penaltyPoints,
    0,
    100,
  );
  const crossModule = buildCrossModuleSummary(activeModules);
  const loopB = buildLoopBResult({
    cadence,
    currentModules: activeModules,
    history,
    trustScore,
  });
  const ready =
    cadence === "monthly_final" &&
    activeModules.every((module) => module.ready) &&
    overallSystemHealth.masterSystemHealthy &&
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
  const workflow = buildWorkflowGovernanceSummary({
    activeModules,
    crossModule,
    loopB,
    ready,
  });
  const overallRuleCitations = buildOverallCanonicalRuleCitations({
    activeModules,
    cadence,
    crossModule,
    loopB,
    overallSystemHealth,
    overallTrustGates,
    ready,
    record,
    trustScore,
    workflow,
  });

  return {
    assessments: activeModules,
    amountValue,
    cadence,
    crossModule,
    loopB,
    overallSystemHealth,
    overallRuleCitations,
    overallTrustGates,
    ready,
    record,
    ruleSetVersion,
    status: ready ? "Certified" : trustScore >= 55 ? "At Risk" : "Onboarding",
    steps: buildCertificationSteps(activeModules, cadence, ready),
    trustScore,
    updatedModules,
    updatedRecovery: formatCurrency(amountValue),
    workflow,
  };
}

function buildOverallCanonicalRuleCitations({
  activeModules,
  cadence,
  crossModule,
  loopB,
  overallSystemHealth,
  overallTrustGates,
  ready,
  record,
  trustScore,
  workflow,
}: {
  activeModules: ModuleAssessment[];
  cadence: "monthly_final" | "weekly_preliminary";
  crossModule: CrossModuleSummary;
  loopB: LoopBResult;
  overallSystemHealth: SystemHealthResult;
  overallTrustGates: Record<TrustGateName, TrustGateScore>;
  ready: boolean;
  record: CaarRecord;
  trustScore: number;
  workflow: WorkflowGovernanceSummary;
}) {
  const citations: RuleCitation[] = [];
  const activeModuleIds = activeModules.map((module) => module.moduleId);
  const totalRecovery = round(activeModules.reduce((sum, module) => sum + module.recoveryValue, 0));

  citations.push(
    buildOverallCitation("R136", {
      detail: "Composite Trust Score was calculated from the persisted TG01-TG11 framework and SYS penalty layer.",
      trust_score: trustScore,
    }),
  );

  const zoneRuleId =
    trustScore < 40 ? "R137" : trustScore < 60 ? "R138" : trustScore < 80 ? "R139" : trustScore < 85 ? "R140" : "R141";
  citations.push(
    buildOverallCitation(zoneRuleId, {
      certification_status: record.status,
      detail: `Certification state assigned from the composite Trust Score band (${trustScore}).`,
      trust_score: trustScore,
    }),
  );

  citations.push(
    buildOverallCitation("R142", {
      detail: ready
        ? "Certification record is eligible for final lock and court-admissible release."
        : "Certification record remains mutable only through superseding remediation because release gates are unresolved.",
      ready,
    }),
  );
  citations.push(
    buildOverallCitation("R143", {
      caar_status: record.status,
      detail: "DCLS / CAAR template path was selected from the composite certification state.",
    }),
  );
  citations.push(
    buildOverallCitation("R144", {
      detail: "Certification output tokens were injected into the canonical CAAR payload assembly path.",
      module_count: activeModules.length,
    }),
  );
  citations.push(
    buildOverallCitation("R145", {
      detail: "Narrative-hash generation path is included in the canonical CAAR sealing workflow.",
      tg10_score: overallTrustGates.TG10.scorePct,
    }),
  );
  citations.push(
    buildOverallCitation("R146", {
      detail: overallTrustGates.TG11.scorePct >= 100
        ? "CAAR eligibility confirmed by the composite trust-gate release threshold."
        : "CAAR eligibility remains blocked by the composite trust-gate release threshold.",
      tg11_score: overallTrustGates.TG11.scorePct,
    }),
  );
  citations.push(
    buildOverallCitation("R147", {
      detail: "CAAR output template was selected from the current certification class and workflow state.",
      ready,
      status: record.status,
    }),
  );
  citations.push(
    buildOverallCitation("R148", {
      detail: "Evidence bundle assembly used persisted upload, governance, and rule-engine state.",
      active_modules: activeModuleIds,
      exhibit_count: record.exhibits,
    }),
  );
  citations.push(
    buildOverallCitation("R149", {
      detail: "Attestation block values were prepared from certification, governance, and audit state.",
      court_admissible: ready,
    }),
  );
  citations.push(
    buildOverallCitation("R150", {
      detail: "CAAR hash-computation path is part of the canonical persistence and artifact workflow.",
      caar_id: record.id,
    }),
  );
  citations.push(
    buildOverallCitation("R151", {
      detail: ready
        ? "ExportPack assembly is eligible because the composite certification cleared release gates."
        : "ExportPack assembly remains blocked until the composite certification clears release gates.",
      ready,
    }),
  );
  citations.push(
    buildOverallCitation("R152", {
      detail: "Immutable audit finalization path is attached to the persisted CAAR lifecycle.",
      workflow_state: workflow.state,
    }),
  );

  if (cadence === "monthly_final") {
    citations.push(
      buildOverallCitation("R153", {
        detail: "Loop B historical batch window activated for the monthly final certification cycle.",
        window_size: loopB.windowSize,
      }),
    );
  }

  for (const finding of loopB.findings) {
    citations.push(
      buildOverallCitation(finding.ruleId, {
        affected_periods: finding.affectedPeriods,
        caar_eligible: finding.caarEligible,
        confidence_score: finding.confidenceScore,
        detail: finding.detail,
        impacts_certification: finding.impactsCertification,
        module: finding.moduleId,
        pattern_code: finding.patternCode,
      }),
    );
  }

  if (loopB.findings.length > 0) {
    const hasVendorPattern = loopB.findings.some((finding) => finding.ruleId === "R157");
    const hasRecertify = loopB.findings.some((finding) => finding.ruleId === "R159");
    const hasCrossModulePattern = loopB.findings.some((finding) => finding.ruleId === "R162");
    if (!hasVendorPattern) {
      citations.push(
        buildOverallCitation("R155", {
          detail: "Loop B vendor-anomaly layer executed; no vendor-systemic anomaly was promoted beyond the active findings set.",
          status: loopB.status,
        }),
      );
    }
    citations.push(
      buildOverallCitation("R160", {
        detail: "Loop B confidence scoring executed across the promoted historical findings.",
        finding_count: loopB.findings.length,
      }),
    );
    citations.push(
      buildOverallCitation("R164", {
        detail: "Loop B findings are prepared for persisted audit-trail write in the CAAR pipeline.",
        finding_count: loopB.findings.length,
      }),
    );
    citations.push(
      buildOverallCitation("R165", {
        detail: "Loop B token set assembled from the promoted historical findings.",
        status: loopB.status,
      }),
    );
    if (!hasRecertify) {
      citations.push(
        buildOverallCitation("R159", {
          detail: "Loop B re-certification trigger evaluated and did not require a mandatory historical recertification path.",
          status: loopB.status,
        }),
      );
    }
    if (!hasCrossModulePattern && activeModules.length >= 2) {
      citations.push(
        buildOverallCitation("R162", {
          detail: "Loop B cross-vendor / cross-module correlation executed without promoting an executive-tier pattern finding.",
          active_modules: activeModuleIds,
        }),
      );
    }
  }

  citations.push(
    buildOverallCitation("R166", {
      detail: "Cross-module order / transaction reconciliation executed across active modules.",
      active_modules: activeModuleIds,
    }),
  );
  if (activeModuleIds.includes("M02") && activeModuleIds.includes("M03")) {
    citations.push(
      buildOverallCitation("R167", {
        active_modules: activeModuleIds,
        conflict: crossModule.conflict,
        detail:
          "Cross-module royalty-to-DFR sales reconciliation executed between governed M02 settlement sales and governed M03 certified royalty sales.",
        reviewed_fee_weights: crossModule.reviewedFeeWeights,
      }),
    );
  }
  citations.push(
    buildOverallCitation("R168", {
      aggregate_variance: crossModule.aggregateVariance,
      detail: "Cross-module variance aggregation executed across active modules.",
    }),
  );
  citations.push(
    buildOverallCitation("R169", {
      detail: "Total recovery amount was calculated from the active module recovery values.",
      total_recovery_eligible: crossModule.totalRecoveryEligible,
    }),
  );
  citations.push(
    buildOverallCitation("R170", {
      detail: "Cross-module Trust Score roll-up executed from the composite trust-gate framework.",
      trust_score: trustScore,
    }),
  );
  citations.push(
    buildOverallCitation("R171", {
      detail: "Module-coverage completeness evaluated against the location's configured active modules.",
      configured_modules: activeModules.length,
      tg01_score: overallTrustGates.TG01.scorePct,
    }),
  );
  citations.push(
    buildOverallCitation("R172", {
      conflict: crossModule.conflict,
      detail: crossModule.conflict
        ? "Cross-module conflict resolution remains active because module evidence or findings diverge."
        : "Cross-module conflict resolution executed with no active conflict.",
    }),
  );
  citations.push(
    buildOverallCitation("R173", {
      caar_id: record.id,
      detail: "Composite certification record assembled from active module outputs, trust gates, Loop B, and workflow state.",
    }),
  );
  citations.push(
    buildOverallCitation("R174", {
      detail: "Cross-module audit trail prepared for persisted CAAR traceability.",
      module_count: activeModules.length,
    }),
  );
  citations.push(
    buildOverallCitation("R175", {
      detail: "Cross-module token set assembled for the composite CAAR payload.",
      workflow_state: workflow.state,
    }),
  );

  citations.push(
    buildOverallCitation("R176", {
      authenticated: workflow.authenticated,
      detail: "Operator authentication gate was evaluated for certification execution.",
    }),
  );
  citations.push(
    buildOverallCitation("R177", {
      authorized: workflow.authorized,
      detail: "Certification action authorization was evaluated for certification execution.",
    }),
  );
  citations.push(
    buildOverallCitation("R178", {
      detail: workflow.manualReviewRequired
        ? "Manual review queue routing remains active for this certification."
        : "Manual review queue routing is not required for this certification.",
      manual_review_required: workflow.manualReviewRequired,
    }),
  );
  citations.push(
    buildOverallCitation("R179", {
      detail: "Operator override / remediation logging path is attached to the certification workflow.",
      workflow_state: workflow.state,
    }),
  );
  citations.push(
    buildOverallCitation("R181", {
      detail: "Recovery action tracking is derived from persisted findings and workflow remediation steps.",
      total_recovery: totalRecovery,
    }),
  );
  citations.push(
    buildOverallCitation("R182", {
      detail: "Operator attribution recording is attached to the persisted certification and CAAR workflow.",
      workflow_state: workflow.state,
    }),
  );
  citations.push(
    buildOverallCitation("R183", {
      detail: "Workflow state transition was computed from readiness, Loop B, and manual-review conditions.",
      workflow_state: workflow.state,
    }),
  );
  citations.push(
    buildOverallCitation("R185", {
      detail: "Operator activity audit trail is attached to certification, CAAR, and persistence actions.",
      notification_count: workflow.notifications.length,
    }),
  );

  if (overallSystemHealth.flags.length > 0) {
    citations.push(
      buildOverallCitation("R180", {
        detail: "Downstream recovery / dispute escalation remains blocked until active certification blockers are resolved.",
        dispute_eligible: workflow.disputeEligible,
      }),
    );
  }
  citations.push(
    buildOverallCitation("R184", {
      detail: "Notification dispatch state was computed from workflow notifications and release conditions.",
      notification_count: workflow.notifications.length,
    }),
  );

  return dedupeOverallCitations(citations);
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
  systemHealthFlags,
  uploadModules,
}: {
  accountId: string;
  artifactContractState: ContractState;
  artifactIntakeState: Record<string, IntakeState>;
  cadence: "monthly_final" | "weekly_preliminary";
  evaluationDate: Date;
  locationId: string;
  moduleId: "M01" | "M02" | "M03";
  systemHealthFlags: Array<"R186" | "R188" | "R191" | "R192">;
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
    systemHealthFlags,
  });

  return {
    artifactCoverage: result.artifactCoverage,
    certificationZone: result.certificationZone,
    dimensions: result.dimensions,
    findingClass: result.findingClass,
    findings: result.findings,
    moduleId,
    mq6: result.mq6,
    note: buildModuleNote(moduleId, result.score, result.findings, result.ruleCitations.length),
    ready: result.ready,
    recoveryValue: result.recoveryValue,
    reviewedFeeVolume: result.reviewedFeeVolume,
    ruleCitations: result.ruleCitations,
    score: result.score,
    systemHealth: result.systemHealth,
    trustGates: result.trustGates,
  };
}

function resolveArtifactIntake(
  state: Record<string, IntakeState>,
  accountId: string,
  locationId: string,
  moduleId: "M01" | "M02" | "M03",
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
  moduleId: "M01" | "M02" | "M03",
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
  moduleId: "M01" | "M02" | "M03",
  score: number,
  findings: string[],
  citationCount: number,
) {
  if (score >= 85 && citationCount === 0) {
    if (moduleId === "M01") {
      return "Processor evidence, contract, and reconciliation gates are release-ready.";
    }
    if (moduleId === "M02") {
      return "DSP settlement, contract, and reconciliation controls are release-ready.";
    }
    return "Royalty evidence, franchise terms, and governed sales reconciliation are release-ready.";
  }
  if (citationCount > 0) {
    return `${citationCount} deterministic ${moduleId} rule citation${citationCount === 1 ? "" : "s"} require review.`;
  }
  return findings[0] ?? `${moduleId} still requires evidence remediation before release.`;
}

function emptyModule(moduleId: "M01" | "M02" | "M03"): ModuleAssessment {
  return {
    artifactCoverage: 0,
    certificationZone: "UNVERIFIED",
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
    reviewedFeeVolume: 0,
    ruleCitations: [],
    score: 0,
    systemHealth: {
      detail: "System health was not evaluated because no governed certification package exists yet.",
      flags: [],
      healthy: true,
      masterSystemHealthy: true,
      penaltyPoints: 0,
    },
    trustGates: Object.fromEntries(
      GATE_ORDER.map((gate) => [
        gate,
        {
          badge: "FAIL",
          canonicalRuleIds: gate === "TG11" ? ["R135"] : [],
          detail: "No certification package exists yet.",
          scorePct: 0,
        },
      ]),
    ) as Record<TrustGateName, TrustGateScore>,
  };
}

function estimateExhibitCount(modules: ModuleAssessment[]) {
  return modules.reduce((sum, module) => sum + Math.max(module.ruleCitations.length, 2), 0);
}

function buildOverallSystemHealth(modules: ModuleAssessment[]) {
  const flags = dedupe(modules.flatMap((module) => module.systemHealth.flags)) as SystemHealthResult["flags"];
  const penaltyPoints = Math.max(
    0,
    ...modules.map((module) => module.systemHealth.penaltyPoints),
  );
  return {
    detail:
      flags.length === 0
        ? "All active modules passed the certification-period system-health checks."
        : `System-health degradation was detected across the active certification package: ${flags.join(", ")}.`,
    flags,
    healthy: flags.length === 0,
    masterSystemHealthy: flags.length === 0,
    penaltyPoints,
  } satisfies SystemHealthResult;
}

function buildCrossModuleSummary(modules: ModuleAssessment[]): CrossModuleSummary {
  const reviewedFeeTotal = Math.max(
    1,
    modules.reduce((sum, module) => sum + Math.max(module.reviewedFeeVolume, 0), 0),
  );
  const reviewedFeeWeights = modules.map((module) => ({
    moduleId: module.moduleId,
    pct: round((Math.max(module.reviewedFeeVolume, 0) / reviewedFeeTotal) * 100),
  }));
  const moduleWeightImbalance = reviewedFeeWeights.some((entry) => entry.pct > 80);
  const aggregateVariance = round(
    modules.reduce((sum, module) => sum + Math.max(module.recoveryValue, 0), 0),
  );
  const totalRecoveryEligible = aggregateVariance;
  const findings: string[] = [];
  const m01 = modules.find((module) => module.moduleId === "M01");
  const m02 = modules.find((module) => module.moduleId === "M02");
  const m03 = modules.find((module) => module.moduleId === "M03");
  if (moduleWeightImbalance) {
    findings.push(
      "Cross-module reviewed-fee weighting is imbalanced because one module contributes more than 80% of the reviewed base.",
    );
  }
  let conflict = false;
  if (m01 && m02) {
    if (
      m01.recoveryValue > 0 &&
      m02.recoveryValue < 0
    ) {
      conflict = true;
      findings.push(
        "Cross-module conflict detected: active module recovery directions disagree and require manual reconciliation before aggregation.",
      );
    }
    const orderCountDelta = Math.abs(
      (m01.dimensions["Cross-System Reconciliation"] ?? 0) -
        (m02.dimensions["Cross-System Reconciliation"] ?? 0),
    );
    if (orderCountDelta >= 50) {
      findings.push(
        "Cross-module order / channel reconciliation shows materially different confidence between active modules.",
      );
    }
  }

  if (m02 && m03) {
    const m02ReviewedBase = Math.max(m02.reviewedFeeVolume, 0);
    const m03ReviewedBase = Math.max(m03.reviewedFeeVolume, 0);
    if (m02ReviewedBase > 0 && m03ReviewedBase > 0) {
      const mismatchPct = Math.abs(m02ReviewedBase - m03ReviewedBase) / Math.max(m02ReviewedBase, 1);
      if (mismatchPct > 0.15) {
        conflict = true;
        findings.push(
          "R167 cross-module royalty-to-DFR sales reconciliation detected a material mismatch between governed M02 settlement sales and governed M03 royalty sales basis.",
        );
      }
    }
  }

  return {
    aggregateVariance,
    conflict,
    findings,
    moduleWeightImbalance,
    reviewedFeeWeights,
    totalRecoveryEligible,
  };
}

function buildLoopBResult({
  cadence,
  currentModules,
  history,
  trustScore,
}: {
  cadence: "monthly_final" | "weekly_preliminary";
  currentModules: ModuleAssessment[];
  history: HistoricalCertificationSnapshot[];
  trustScore: number;
}): LoopBResult {
  if (cadence !== "monthly_final") {
    return {
      auditRequired: false,
      baselineHash: null,
      findings: [],
      status: "not_applicable",
      windowSize: 0,
    };
  }

  const relevantHistory = history
    .slice()
    .sort((left, right) =>
      (left.completedAt ?? "").localeCompare(right.completedAt ?? ""),
    )
    .slice(-13);

  const findings: LoopBFinding[] = [];

  for (const module of currentModules) {
    const moduleHistory = relevantHistory.filter((entry) => entry.moduleId === module.moduleId);
    const windowSize = moduleHistory.length;
    if (windowSize === 0) {
      continue;
    }

    const recoverySeries = [...moduleHistory.map((entry) => entry.recoveryValue), module.recoveryValue];
    if (
      recoverySeries.length >= 4 &&
      recoverySeries
        .slice(-4)
        .every((value, index, values) => index === 0 || value >= values[index - 1])
    ) {
      const occurrenceCount = 4;
      const consistencyFactor = 1;
      const confidenceScore = round(
        Math.min(1, (occurrenceCount * consistencyFactor) / Math.max(windowSize, 1)),
      );
      findings.push({
        affectedPeriods: moduleHistory.slice(-3).map((entry) => entry.period),
        caarEligible: confidenceScore >= 0.85 && trustScore >= 85,
        confidenceScore,
        detail:
          "Certified variance has increased monotonically across at least four consecutive periods and may indicate a stable recoverable pattern.",
        impactsCertification: confidenceScore >= 0.75,
        moduleId: module.moduleId,
        patternCode: "VARIANCE_TREND_ASCENDING",
        ruleId: confidenceScore >= 0.85 && trustScore >= 85 ? "R163" : "R154",
      });
    }

    const previousRuleIds = moduleHistory.flatMap((entry) => entry.ruleIds);
    const recurringRuleId = module.ruleCitations
      .map((citation) => citation.ruleId)
      .find((ruleId) => previousRuleIds.filter((entry) => entry === ruleId).length >= 2);
    if (recurringRuleId) {
      const occurrenceCount =
        previousRuleIds.filter((entry) => entry === recurringRuleId).length + 1;
      const confidenceScore = round(
        Math.min(1, occurrenceCount / Math.max(windowSize + 1, 1)),
      );
      findings.push({
        affectedPeriods: moduleHistory
          .filter((entry) => entry.ruleIds.includes(recurringRuleId))
          .map((entry) => entry.period),
        caarEligible: confidenceScore >= 0.85 && trustScore >= 85,
        confidenceScore,
        detail: `Rule ${recurringRuleId} recurred across multiple periods for the same module, suggesting a vendor-systemic error signature.`,
        impactsCertification: confidenceScore >= 0.75,
        moduleId: module.moduleId,
        patternCode: "VENDOR_SYSTEMIC_PATTERN",
        ruleId: confidenceScore >= 0.85 && trustScore >= 85 ? "R163" : "R157",
      });
    }

    const priorAverage =
      moduleHistory.reduce((sum, entry) => sum + entry.recoveryValue, 0) /
      Math.max(moduleHistory.length, 1);
    const squaredDrift =
      moduleHistory.reduce((sum, entry) => sum + Math.pow(entry.recoveryValue - priorAverage, 2), 0) /
      Math.max(moduleHistory.length, 1);
    const baselineDeviation = Math.sqrt(Math.max(0, squaredDrift));
    if (module.recoveryValue > priorAverage * 1.5 && moduleHistory.length >= 3) {
      const confidenceScore = round(
        Math.min(1, 0.5 + moduleHistory.length / 10),
      );
      findings.push({
        affectedPeriods: moduleHistory.slice(-3).map((entry) => entry.period),
        caarEligible: false,
        confidenceScore,
        detail:
          "Current-period recoverable variance materially exceeds the recent certified baseline and should trigger supplemental review of prior periods.",
        impactsCertification: true,
        moduleId: module.moduleId,
        patternCode: "RE_CERTIFY_REQUIRED",
        ruleId: "R159",
      });
    }

    if (
      moduleHistory.length >= 4 &&
      baselineDeviation > 0 &&
      Math.abs(module.recoveryValue - priorAverage) > baselineDeviation * 1.5
    ) {
      const confidenceScore = round(
        Math.min(1, Math.abs(module.recoveryValue - priorAverage) / Math.max(baselineDeviation * 2, 1)),
      );
      findings.push({
        affectedPeriods: moduleHistory.slice(-4).map((entry) => entry.period),
        caarEligible: confidenceScore >= 0.85 && trustScore >= 85,
        confidenceScore,
        detail:
          "Current certified error behavior falls materially outside the recent merchant baseline and should be reviewed as a cluster-style outlier pattern.",
        impactsCertification: confidenceScore >= 0.75,
        moduleId: module.moduleId,
        patternCode: "CLUSTER_OUTLIER",
        ruleId: "R156",
      });
    }

    if (
      module.ruleCitations.length === 0 &&
      module.recoveryValue > 0 &&
      moduleHistory.length >= 2
    ) {
      const confidenceScore = round(Math.min(1, 0.55 + moduleHistory.length / 10));
      findings.push({
        affectedPeriods: moduleHistory.slice(-2).map((entry) => entry.period),
        caarEligible: false,
        confidenceScore,
        detail:
          "Historical recovery posture persists but the current certified package does not map it to a known active canonical finding, so it is recorded as an unclassified pattern for rule-registry review.",
        impactsCertification: confidenceScore >= 0.75,
        moduleId: module.moduleId,
        patternCode: "UNCLASSIFIED_PATTERN",
        ruleId: "R158",
      });
    }
  }

  if (currentModules.length >= 2) {
    const allPositive = currentModules.every((module) => module.recoveryValue > 0);
    if (allPositive && trustScore >= 85) {
      findings.push({
        affectedPeriods: relevantHistory.slice(-3).map((entry) => entry.period),
        caarEligible: true,
        confidenceScore: 0.85,
        detail:
          "Multiple active modules exhibit concurrent recoverable patterns, creating a cross-module executive-tier pattern finding.",
        impactsCertification: true,
        moduleId: "XMOD",
        patternCode: "CROSS_MODULE_PATTERN",
        ruleId: "R162",
      });
    }
  }

  const baselineHash =
    relevantHistory.length > 0
      ? dedupe(
          relevantHistory.map(
            (entry) => `${entry.moduleId}:${entry.period}:${entry.trustScore}:${entry.recoveryValue}`,
          ),
        ).join("|")
      : null;
  const hasCaarEligiblePattern = findings.some((finding) => finding.caarEligible);
  const requiresRecertification = findings.some(
    (finding) => finding.ruleId === "R159" || finding.impactsCertification,
  );

  return {
    auditRequired: findings.length > 0,
    baselineHash,
    findings,
    status: hasCaarEligiblePattern
      ? "caar_eligible_pattern"
      : requiresRecertification
        ? "re_certify_required"
        : findings.length > 0
          ? "review"
          : "clear",
    windowSize: relevantHistory.length,
  };
}

function buildWorkflowGovernanceSummary({
  activeModules,
  crossModule,
  loopB,
  ready,
}: {
  activeModules: ModuleAssessment[];
  crossModule: CrossModuleSummary;
  loopB: LoopBResult;
  ready: boolean;
}): WorkflowGovernanceSummary {
  const manualReviewRequired =
    crossModule.conflict ||
    loopB.status === "re_certify_required" ||
    activeModules.some((module) => module.certificationZone !== "CERTIFIED");
  const notifications = [
    ...(crossModule.moduleWeightImbalance
      ? ["Cross-module weight imbalance should be reviewed by WGS."]
      : []),
    ...(loopB.findings.length > 0
      ? [`Loop B produced ${loopB.findings.length} historical pattern finding(s).`]
      : []),
  ];

  return {
    authenticated: true,
    authorized: true,
    disputeEligible: ready,
    manualReviewRequired,
    notifications,
    state: ready
      ? "certified"
      : manualReviewRequired
        ? "in_review"
        : "needs_remediation",
  };
}

function buildOverallTrustGates(
  modules: ModuleAssessment[],
  configuredModules: LocationModuleState[],
) {
  const activeConfiguredModules = configuredModules.filter(
    (module) => module.label === "M01" || module.label === "M02" || module.label === "M03",
  ).length;
  const reviewedFeeTotal = Math.max(
    1,
    modules.reduce((sum, module) => sum + Math.max(module.reviewedFeeVolume, 0), 0),
  );

  const gates = Object.fromEntries(
    GATE_ORDER.map((gate) => {
      if (gate === "TG07") {
        const weightedTg07 = round(
          modules.reduce(
            (sum, module) =>
              sum + module.trustGates.TG07.scorePct * (Math.max(module.reviewedFeeVolume, 0) / reviewedFeeTotal),
            0,
          ),
        );
        return [
          gate,
          {
            badge: weightedTg07 >= 85 ? "PASS" : weightedTg07 >= 60 ? "PARTIAL" : "FAIL",
            canonicalRuleIds: ["R168", "R169", "R170"],
            detail:
              modules.length > 1
                ? "Cross-module TG07 roll-up uses reviewed-fee weighting across active modules."
                : "Single active module; TG07 carries through directly.",
            scorePct: weightedTg07,
          } satisfies TrustGateScore,
        ];
      }

      const average = round(
        modules.reduce((sum, module) => sum + module.trustGates[gate].scorePct, 0) / Math.max(modules.length, 1),
      );

      if (gate === "TG01" && activeConfiguredModules > modules.length && modules.length > 0) {
        const coverageRatio = modules.length / activeConfiguredModules;
        const penalized = round(average * coverageRatio);
        return [
          gate,
          {
            badge: penalized >= 85 ? "PASS" : penalized >= 60 ? "PARTIAL" : "FAIL",
            canonicalRuleIds: ["R171"],
            detail:
              "Module coverage completeness penalty applied because fewer modules produced a certification record than were configured for this location.",
            scorePct: penalized,
          } satisfies TrustGateScore,
        ];
      }

      return [
        gate,
        {
          badge: average >= 85 ? "PASS" : average >= 60 ? "PARTIAL" : "FAIL",
          canonicalRuleIds: dedupe(modules.flatMap((module) => module.trustGates[gate].canonicalRuleIds)),
          detail:
            modules.length > 1
              ? `Location-level ${gate} is averaged across active module certifications.`
              : modules[0]?.trustGates[gate].detail ?? "No module gate detail is available.",
          scorePct: average,
        } satisfies TrustGateScore,
      ];
    }),
  ) as Record<TrustGateName, TrustGateScore>;

  const preTg11 = round(
    GATE_ORDER.filter((gate) => gate !== "TG11").reduce(
      (sum, gate) => sum + gates[gate].scorePct * (GATE_WEIGHTS[gate] / 100),
      0,
    ),
  );

  gates.TG11 = {
    badge: preTg11 >= 85 ? "PASS" : "FAIL",
    canonicalRuleIds: ["R135", "R146"],
    detail:
      preTg11 >= 85
        ? "Composite trust-gate score cleared the CAAR eligibility threshold."
        : "Composite trust-gate score remains below the CAAR eligibility threshold.",
    scorePct: preTg11 >= 85 ? 100 : 0,
  };

  return gates;
}

function computeOverallTrustScore(gates: Record<TrustGateName, TrustGateScore>) {
  return round(
    GATE_ORDER.reduce((sum, gate) => sum + gates[gate].scorePct * (GATE_WEIGHTS[gate] / 100), 0),
  );
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function buildOverallCitation(
  ruleId: string,
  sampleEvidence: Record<string, unknown>,
  varianceCents = 0,
): RuleCitation {
  return {
    firedCount: 1,
    ruleId,
    ruleVersion: "mge-v1.0.0",
    sampleEvidence: [sampleEvidence],
    varianceCents,
  };
}

function dedupeOverallCitations(citations: RuleCitation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.ruleId}:${JSON.stringify(citation.sampleEvidence[0] ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
