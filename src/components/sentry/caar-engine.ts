import type {
  CaarDimension,
  CaarRecord,
  IntakeState,
  LocationModuleState,
  LocationRecord,
  UploadModule,
} from "./types";

type CertificationStep = {
  detail: string;
  done: boolean;
  label: string;
};

type CertificationResult = {
  amountValue: number;
  ready: boolean;
  record: CaarRecord;
  status: LocationRecord["status"];
  steps: CertificationStep[];
  trustScore: number;
  updatedModules: LocationModuleState[];
  updatedRecovery: string;
};

type ModuleAssessment = {
  artifactCoverage: number;
  dimensions: Record<"Auditability" | "Cross-System Reconciliation" | "Data Completeness" | "Data Freshness" | "Rule Integrity" | "Source Authenticity", number>;
  findings: string[];
  moduleId: "M01" | "M02";
  note: string;
  ready: boolean;
  recoveryValue: number;
  score: number;
};

type ContractState = Record<string, Record<string, string>>;
type DimensionName = keyof ModuleAssessment["dimensions"];

const DIMENSION_ORDER: DimensionName[] = [
  "Data Completeness",
  "Rule Integrity",
  "Cross-System Reconciliation",
  "Source Authenticity",
  "Auditability",
  "Data Freshness",
];

const DIMENSION_WEIGHTS: Record<CaarDimension["name"], number> = {
  "Auditability": 0.1,
  "Cross-System Reconciliation": 0.25,
  "Data Completeness": 0.25,
  "Data Freshness": 0.05,
  "Rule Integrity": 0.2,
  "Source Authenticity": 0.15,
};

const DIMENSION_LABELS: Record<CaarDimension["name"], string> = {
  "Auditability": "10%",
  "Cross-System Reconciliation": "25%",
  "Data Completeness": "25%",
  "Data Freshness": "5%",
  "Rule Integrity": "20%",
  "Source Authenticity": "15%",
};

export function buildCertificationResult({
  artifactContractState,
  artifactIntakeState,
  location,
  uploadModules,
}: {
  artifactContractState: ContractState;
  artifactIntakeState: Record<string, IntakeState>;
  location: LocationRecord;
  uploadModules: UploadModule[];
}): CertificationResult {
  const modules = (["M01", "M02"] as const)
    .map((moduleId) => assessModule({
      accountId: location.accountId,
      artifactContractState,
      artifactIntakeState,
      locationId: location.id,
      moduleId,
      uploadModules,
    }))
    .filter((module): module is ModuleAssessment => module !== null);

  const activeModules = modules.length > 0 ? modules : [emptyModule("M01"), emptyModule("M02")];
  const overallDimensions = DIMENSION_ORDER.map((name) => ({
    name,
    score: clamp(
      round(
      activeModules.reduce((sum, assessment) => sum + assessment.dimensions[name], 0) / activeModules.length,
      ),
      0,
      100,
    ),
    weight: DIMENSION_LABELS[name],
  }));
  const trustScore = clamp(
    round(
      overallDimensions.reduce((sum, dimension) => sum + dimension.score * DIMENSION_WEIGHTS[dimension.name], 0),
    ),
    0,
    100,
  );
  const ready = activeModules.every((module) => module.ready) && trustScore >= 85;
  const amountValue = Math.max(0, round(activeModules.reduce((sum, module) => sum + module.recoveryValue, 0)));
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(2, 14);
  const period = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
  const record: CaarRecord = {
    accountId: location.accountId,
    amount: formatCurrency(amountValue),
    dimensions: overallDimensions,
    exhibits: activeModules.reduce((sum, assessment) => sum + Math.round((assessment.artifactCoverage / 100) * 5), 0),
    findings: buildOverallFindings(location.name, activeModules, ready, amountValue),
    id: `CAAR-${stamp}-${location.id.replace(/[^0-9A-Za-z]/g, "")}`,
    locationId: location.id,
    locationName: location.name,
    narrative: buildNarrative(location.name, activeModules, trustScore, ready),
    period,
    status: ready ? "Court Admissible" : "Needs Remediation",
    trustScore,
  };

  const updatedModules = mergeLocationModules(location.modules, activeModules);
  const evidenceScore = clamp(
    round(
      activeModules.reduce((sum, assessment) => sum + assessment.dimensions["Source Authenticity"], 0) /
        Math.max(activeModules.length, 1),
    ),
    0,
    100,
  );
  const evidenceNote = ready
    ? "Evidence package is fully hashed, schema-validated, and certification-ready."
    : "Evidence package still has unresolved authenticity, completeness, or reconciliation gaps.";
  if (!updatedModules.some((moduleState) => moduleState.label === "Evidence")) {
    updatedModules.push({
      label: "Evidence",
      note: evidenceNote,
      score: evidenceScore,
    });
  } else {
    for (const moduleState of updatedModules) {
      if (moduleState.label === "Evidence") {
        moduleState.score = evidenceScore;
        moduleState.note = evidenceNote;
      }
    }
  }

  return {
    amountValue,
    ready,
    record,
    status: ready ? "Certified" : trustScore >= 55 ? "At Risk" : "Onboarding",
    steps: buildCertificationSteps(activeModules, ready),
    trustScore,
    updatedModules,
    updatedRecovery: formatCurrency(amountValue),
  };
}

export function extractUploadMetrics(artifactKey: string, headers: string[], rows: string[][]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const metrics = {
    basisAmount: 0,
    depositAmount: 0,
    feeAmount: 0,
    orderCount: 0,
    payoutAmount: 0,
    transactionCount: 0,
  };

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
  }

  metrics.transactionCount =
    round(sumColumn(normalizedHeaders, rows, ["transaction_count"])) || rows.length;
  metrics.orderCount = round(sumColumn(normalizedHeaders, rows, ["order_count", "menu_item_count"])) || rows.length;

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
    basisAmount: readValue(values, ["gross_volume", "gross_sales", "channel_sales", "platform_gross_sales", "total_dsp_deposits"]),
    depositAmount: readValue(values, ["total_dsp_deposits"]),
    feeAmount: readValue(values, ["fees_total", "commission_total"]),
    orderCount: readValue(values, ["order_count", "transaction_count"]),
    payoutAmount: readValue(values, ["payout_total"]),
    transactionCount: readValue(values, ["transaction_count", "order_count"]),
  };
}

function assessModule({
  accountId,
  artifactContractState,
  artifactIntakeState,
  locationId,
  moduleId,
  uploadModules,
}: {
  accountId: string;
  artifactContractState: ContractState;
  artifactIntakeState: Record<string, IntakeState>;
  locationId: string;
  moduleId: "M01" | "M02";
  uploadModules: UploadModule[];
}): ModuleAssessment | null {
  const uploadModule = uploadModules.find((item) => item.accountId === accountId && item.id === moduleId);
  if (!uploadModule) {
    return null;
  }

  const artifacts = uploadModule.artifacts.map((artifact) => {
    const intake = resolveArtifactIntake(artifactIntakeState, accountId, locationId, moduleId, artifact.key);
    const contract = resolveContractValues(artifactContractState, accountId, locationId, moduleId, artifact.key);
    const manuallyReady =
      Boolean(contract) &&
      Object.entries(contract ?? {}).filter(([key, value]) => key !== "__entry_mode" && Boolean(value)).length >= 3;
    const uploaded = Boolean(intake?.uploaded || manuallyReady);
    const hashed = Boolean(intake?.hash || manuallyReady);
    const schema = Boolean(intake?.schema || manuallyReady);
    const fields = Boolean(intake?.fields || manuallyReady);
    return {
      artifact,
      contract,
      fields,
      hashed,
      intake,
      manuallyReady,
      schema,
      uploaded,
    };
  });

  const uploadedCount = artifacts.filter((artifact) => artifact.uploaded).length;
  const hashedCount = artifacts.filter((artifact) => artifact.hashed).length;
  const schemaArtifacts = artifacts.filter((artifact) => artifact.artifact.type === "CSV");
  const readyCount = artifacts.filter((artifact) => artifact.uploaded && artifact.hashed && artifact.schema && artifact.fields).length;
  const completeness = round((uploadedCount / Math.max(artifacts.length, 1)) * 100);
  const authenticity = round((hashedCount / Math.max(artifacts.length, 1)) * 100);
  const schemaIntegrity = schemaArtifacts.length
    ? round(
        schemaArtifacts.reduce((sum, artifact) => {
          if (!artifact.uploaded) return sum;
          return sum + (artifact.intake?.matchPct ?? (artifact.schema ? 100 : 40));
        }, 0) / Math.max(schemaArtifacts.length, 1),
      )
    : 100;
  const contractArtifact = artifacts.find((artifact) => artifact.artifact.key.includes("contract"));
  const agreementArtifact = artifacts.find((artifact) => artifact.artifact.key.includes("agreement"));
  const statementArtifact = artifacts.find((artifact) => artifact.artifact.key.includes(moduleId === "M01" ? "processor" : "settlement"));
  const posArtifact = artifacts.find((artifact) => artifact.artifact.key.includes("pos"));
  const bankArtifact = artifacts.find((artifact) => artifact.artifact.key.includes("bank"));
  const governance = clamp(
    round(
      (contractReadiness(contractArtifact?.contract) * 0.6) +
        ((agreementArtifact?.uploaded ? 100 : 0) * 0.2) +
        ((schemaIntegrity || 0) * 0.2),
    ),
    0,
    100,
  );
  const freshness = clamp(
    round(
      artifacts.reduce((sum, artifact) => {
        const updatedAt = artifact.intake?.updatedAt;
        if (!updatedAt) return sum;
        const ageDays = Math.max(
          0,
          Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
        );
        return sum + (ageDays <= 7 ? 96 : ageDays <= 31 ? 88 : ageDays <= 62 ? 74 : 58);
      }, uploadedCount > 0 ? 0 : 48) / Math.max(uploadedCount, 1),
    ),
    0,
    100,
  );

  const reconciliation = computeReconciliationScore(moduleId, {
    bank: bankArtifact?.intake,
    pos: posArtifact?.intake,
    statement: statementArtifact?.intake,
  });

  const dimensions: ModuleAssessment["dimensions"] = {
    "Auditability": clamp(round((readyCount / Math.max(artifacts.length, 1)) * 100), 0, 100),
    "Cross-System Reconciliation": reconciliation,
    "Data Completeness": completeness,
    "Data Freshness": freshness,
    "Rule Integrity": clamp(round((schemaIntegrity * 0.45) + (governance * 0.55)), 0, 100),
    "Source Authenticity": authenticity,
  };
  const score = clamp(
    round(
      DIMENSION_ORDER.reduce((sum, name) => sum + dimensions[name] * DIMENSION_WEIGHTS[name], 0),
    ),
    0,
    100,
  );
  const recoveryValue = moduleId === "M01"
    ? computeM01Recovery(statementArtifact?.intake, contractArtifact?.contract)
    : computeM02Recovery(statementArtifact?.intake, posArtifact?.intake, contractArtifact?.contract);

  const findings = buildModuleFindings(moduleId, {
    agreementUploaded: Boolean(agreementArtifact?.uploaded),
    authenticity,
    bankUploaded: Boolean(bankArtifact?.uploaded),
    completeness,
    contractReady: contractReadiness(contractArtifact?.contract) >= 80,
    posUploaded: Boolean(posArtifact?.uploaded),
    reconciliation,
    schemaIntegrity,
    statementUploaded: Boolean(statementArtifact?.uploaded),
  });

  return {
    artifactCoverage: completeness,
    dimensions,
    findings,
    moduleId,
    note: buildModuleNote(moduleId, score, findings),
    ready:
      score >= 85 &&
      Boolean(statementArtifact?.uploaded) &&
      Boolean(posArtifact?.uploaded) &&
      Boolean(bankArtifact?.uploaded) &&
      contractReadiness(contractArtifact?.contract) >= 80,
    recoveryValue,
    score,
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

function computeReconciliationScore(
  moduleId: "M01" | "M02",
  {
    bank,
    pos,
    statement,
  }: {
    bank?: IntakeState | null;
    pos?: IntakeState | null;
    statement?: IntakeState | null;
  },
) {
  let score = 0;
  if (statement?.uploaded) score += 35;
  if (pos?.uploaded) score += 25;
  if (bank?.uploaded) score += 25;
  if (statement?.schema) score += 5;
  if (pos?.schema) score += 5;
  if (bank?.hash) score += 5;

  const statementBasis = statement?.metrics?.basisAmount ?? 0;
  const posBasis = pos?.metrics?.basisAmount ?? 0;
  const payout = statement?.metrics?.payoutAmount ?? 0;
  const deposit = bank?.metrics?.depositAmount ?? 0;

  if (statementBasis > 0 && posBasis > 0) {
    const delta = Math.abs(statementBasis - posBasis) / Math.max(statementBasis, posBasis, 1);
    score += delta <= 0.05 ? 10 : delta <= 0.12 ? 5 : 0;
  }

  if (payout > 0 && deposit > 0) {
    const delta = Math.abs(payout - deposit) / Math.max(payout, deposit, 1);
    score += delta <= 0.05 ? 10 : delta <= 0.12 ? 5 : 0;
  } else if (moduleId === "M01" && bank?.uploaded) {
    score += 4;
  }

  return clamp(score, 0, 100);
}

function computeM01Recovery(statement?: IntakeState | null, contract?: Record<string, string> | null) {
  const basisAmount = statement?.metrics?.basisAmount ?? 0;
  const actualFees = statement?.metrics?.feeAmount ?? 0;
  const transactionCount = statement?.metrics?.transactionCount ?? statement?.rows ?? 0;
  const markupBps = parseNumber(contract?.markup_bps);
  const txnFee = parseNumber(contract?.txn_fee);
  const expected = basisAmount * (markupBps / 10000) + transactionCount * txnFee;
  return Math.max(0, actualFees - expected);
}

function computeM02Recovery(
  statement?: IntakeState | null,
  pos?: IntakeState | null,
  contract?: Record<string, string> | null,
) {
  const basisAmount = statement?.metrics?.basisAmount ?? pos?.metrics?.basisAmount ?? 0;
  const actualCommission =
    statement?.metrics?.feeAmount ??
    0;
  const payout = statement?.metrics?.payoutAmount ?? 0;
  const inferredCommission = actualCommission > 0 ? actualCommission : Math.max(0, basisAmount - payout);
  const channelRates = [
    parseNumber(contract?.rate_delivery),
    parseNumber(contract?.rate_member),
    parseNumber(contract?.rate_pickup),
    parseNumber(contract?.rate_catering),
    parseNumber(contract?.rate_sponsored),
  ].filter((value) => value > 0);
  const effectiveRate = channelRates.length
    ? channelRates.reduce((sum, value) => sum + value, 0) / channelRates.length
    : 0;
  const expected = basisAmount * (effectiveRate / 100);
  return Math.max(0, inferredCommission - expected);
}

function buildModuleFindings(
  moduleId: "M01" | "M02",
  status: {
    agreementUploaded: boolean;
    authenticity: number;
    bankUploaded: boolean;
    completeness: number;
    contractReady: boolean;
    posUploaded: boolean;
    reconciliation: number;
    schemaIntegrity: number;
    statementUploaded: boolean;
  },
) {
  const findings: string[] = [];
  const label = moduleId === "M01" ? "processor" : "DSP";

  if (!status.statementUploaded) findings.push(`Missing ${label} statement upload for the certification period.`);
  if (!status.posUploaded) findings.push("POS reconciliation export is missing.");
  if (!status.bankUploaded) findings.push("Bank deposit evidence is missing, which blocks D3 reconciliation.");
  if (!status.agreementUploaded) findings.push("Signed agreement PDF is not attached to the evidence package.");
  if (!status.contractReady) findings.push("Contract config is incomplete or not sufficiently keyed for deterministic scoring.");
  if (status.schemaIntegrity < 80) findings.push("Schema match is below acceptable threshold and requires WGS review.");
  if (status.authenticity < 80) findings.push("One or more uploaded artifacts are not fully hash-verified.");
  if (status.reconciliation < 85 && status.statementUploaded && status.posUploaded) {
    findings.push("Cross-system reconciliation remains incomplete or outside tolerance.");
  }
  if (status.completeness >= 100 && status.reconciliation >= 85 && status.contractReady) {
    findings.push(
      moduleId === "M01"
        ? "Processor, POS, bank, and contract evidence cleared the M01 release gate."
        : "Settlement, POS, bank, and commission controls cleared the M02 release gate.",
    );
  }

  return findings;
}

function buildNarrative(
  locationName: string,
  modules: ModuleAssessment[],
  trustScore: number,
  ready: boolean,
) {
  const moduleSummary = modules
    .map((module) => `${module.moduleId} scored ${module.score} with ${module.artifactCoverage}% evidence coverage`)
    .join("; ");
  if (ready) {
    return `${locationName} completed the certification pipeline successfully. ${moduleSummary}. The evidence package is sufficient for court-admissible release.`;
  }
  return `${locationName} completed certification analysis but remains below release threshold. ${moduleSummary}. Remediation is still required before external delivery.`;
}

function buildOverallFindings(
  locationName: string,
  modules: ModuleAssessment[],
  ready: boolean,
  amountValue: number,
) {
  const findings = modules.flatMap((module) => module.findings.slice(0, 2));
  if (amountValue > 0) {
    findings.unshift(`${locationName} currently shows ${formatCurrency(amountValue)} in computed certified variance across active modules.`);
  }
  if (ready) {
    findings.unshift(`Certification run cleared all core evidence and reconciliation gates for ${locationName}.`);
  } else {
    findings.unshift(`Certification run for ${locationName} remains blocked by one or more evidence, schema, or reconciliation controls.`);
  }
  return findings.slice(0, 6);
}

function buildCertificationSteps(modules: ModuleAssessment[], ready: boolean): CertificationStep[] {
  const completeness = round(modules.reduce((sum, module) => sum + module.artifactCoverage, 0) / Math.max(modules.length, 1));
  const ruleIntegrity = round(modules.reduce((sum, module) => sum + module.dimensions["Rule Integrity"], 0) / Math.max(modules.length, 1));
  const reconciliation = round(modules.reduce((sum, module) => sum + module.dimensions["Cross-System Reconciliation"], 0) / Math.max(modules.length, 1));
  return [
    {
      done: completeness >= 60,
      detail: `${completeness}% of required artifacts were present for the active certification scope.`,
      label: "Define Semantic Truths",
    },
    {
      done: ruleIntegrity >= 70,
      detail: `${ruleIntegrity}% rule-integrity confidence based on schema match and contract config readiness.`,
      label: "Define Deterministic Law",
    },
    {
      done: reconciliation >= 65,
      detail: `${reconciliation}% reconciliation confidence across source, POS, and bank evidence.`,
      label: "Execute Loop A",
    },
    {
      done: ready,
      detail: ready
        ? "Release threshold met and CAAR was generated."
        : "Run completed, but release remains blocked until missing controls are resolved.",
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

function contractReadiness(values?: Record<string, string> | null) {
  if (!values) return 0;
  const relevantEntries = Object.entries(values).filter(([key, value]) => key !== "__entry_mode" && Boolean(value));
  if (relevantEntries.length === 0) return 0;
  return clamp(round((relevantEntries.length / 8) * 100), 0, 100);
}

function buildModuleNote(moduleId: "M01" | "M02", score: number, findings: string[]) {
  if (score >= 85) {
    return moduleId === "M01"
      ? "Processor evidence, contract, and reconciliation gates are all release-ready."
      : "DSP settlement, contract, and reconciliation controls are release-ready.";
  }
  return findings[0] ?? `${moduleId} still requires evidence remediation before release.`;
}

function emptyModule(moduleId: "M01" | "M02"): ModuleAssessment {
  return {
    artifactCoverage: 0,
    dimensions: {
      "Auditability": 0,
      "Cross-System Reconciliation": 0,
      "Data Completeness": 0,
      "Data Freshness": 0,
      "Rule Integrity": 0,
      "Source Authenticity": 0,
    },
    findings: [`${moduleId} has no certification artifacts yet.`],
    moduleId,
    note: `${moduleId} has no certification artifacts yet.`,
    ready: false,
    recoveryValue: 0,
    score: 0,
  };
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
