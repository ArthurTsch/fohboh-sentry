import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCertificationResult,
  type HistoricalCertificationSnapshot,
} from "@/components/sentry/caar-engine";
import { uploadModules } from "@/components/sentry/data";
import { resolveVendorName } from "@/components/sentry/vendor-catalog";
import { isInformationalRuleCitation } from "@/lib/mge/citation-disposition";
import {
  CANONICAL_RULE_CLAUSES,
  CANONICAL_RULE_COUNT,
  CANONICAL_RULES,
} from "@/lib/mge/canonical-registry";
import { validateUploadArtifact } from "@/lib/uploads/intake";

type ModuleId = "M01" | "M02";

type VendorConfig = {
  agreement: string;
  bank: string;
  contract: Record<string, string>;
  moduleId: ModuleId;
  pos: string;
  settlement: string;
  vendorKey: string;
};

type ScenarioConfig = {
  badHeaders: boolean;
  dir: string;
  name: string;
  withBank: boolean;
};

const ROOT = process.cwd();
const ACCOUNT_ID = "C001";
const LOCATION_ID = "TEST-001";

const VENDORS: VendorConfig[] = [
  {
    agreement: "FohBoh_Test_M01_Merchant_Agreement.pdf",
    bank: "FohBoh_Test_M01_Bank_Statement.pdf",
    contract: {
      __entry_mode: "manual",
      chargeback_fee: "15",
      contract_type: "Interchange Plus",
      effective_date: "2026-01-01",
      markup_bps: "25",
      monthly_fee: "0",
      pricing_model: "Interchange Plus",
      processor_name: "Heartland",
      txn_fee: "0.08",
    },
    moduleId: "M01",
    pos: "FohBoh_Test_M01_Heartland_POS_Export.csv",
    settlement: "FohBoh_Test_M01_Heartland_Processor_Statement.csv",
    vendorKey: "heartland",
  },
  {
    agreement: "FohBoh_Test_M01_Toast_Merchant_Agreement.pdf",
    bank: "FohBoh_Test_M01_Toast_Bank_Statement.pdf",
    contract: {
      __entry_mode: "manual",
      chargeback_fee: "15",
      contract_type: "Interchange Plus",
      effective_date: "2026-01-01",
      markup_bps: "25",
      monthly_fee: "0",
      pricing_model: "Interchange Plus",
      processor_name: "Toast",
      txn_fee: "0.08",
    },
    moduleId: "M01",
    pos: "FohBoh_Test_M01_Toast_POS_Export.csv",
    settlement: "FohBoh_Test_M01_Toast_Processor_Statement.csv",
    vendorKey: "toast",
  },
  {
    agreement: "FohBoh_Test_M02_DoorDash_Agreement.pdf",
    bank: "FohBoh_Test_M02_Bank_Statement.pdf",
    contract: deliveryContract(),
    moduleId: "M02",
    pos: "FohBoh_Test_M02_DoorDash_POS_Summary.csv",
    settlement: "FohBoh_Test_M02_DoorDash_Settlement.csv",
    vendorKey: "doordash",
  },
  {
    agreement: "FohBoh_Test_M02_UberEats_Agreement.pdf",
    bank: "FohBoh_Test_M02_UberEats_Bank_Statement.pdf",
    contract: deliveryContract(),
    moduleId: "M02",
    pos: "FohBoh_Test_M02_UberEats_POS_Summary.csv",
    settlement: "FohBoh_Test_M02_UberEats_Settlement.csv",
    vendorKey: "ubereats",
  },
];

const SCENARIOS: ScenarioConfig[] = [
  {
    badHeaders: false,
    dir: "Test/archives/CAAR-92-Court-Admissible",
    name: "complete-evidence",
    withBank: true,
  },
  {
    badHeaders: false,
    dir: "Test/archives/CAAR-74-Missing-Bank",
    name: "missing-bank",
    withBank: false,
  },
  {
    badHeaders: true,
    dir: "Test/archives/CAAR-38-Schema-Mismatch",
    name: "schema-mismatch",
    withBank: true,
  },
];

async function main() {
  const failures: string[] = [];
  for (const vendor of VENDORS) {
    const results = [];
    for (const scenario of SCENARIOS) {
      const result = await runVendorScenario(scenario, vendor);
      const assessment = result.assessments.find((item) => item.moduleId === vendor.moduleId);
      if (!assessment) throw new Error(`${vendor.moduleId}/${vendor.vendorKey} was not assessed.`);
      verifyEngineCitationOutcomes(result);
      if (scenario.withBank && !scenario.badHeaders && assessment.trustGates.TG06.scorePct !== 100) {
        failures.push(
          `${vendor.vendorKey}: complete governed monthly evidence must produce TG06=100, received ${assessment.trustGates.TG06.scorePct}.`,
        );
      }
      results.push({ assessment, result, scenario });
      console.log(
        `[INFO] ${scenario.name} ${vendor.moduleId}/${resolveVendorName(vendor.moduleId, vendor.vendorKey)} ` +
          `trustScore=${result.trustScore} ready=${result.ready} moduleReady=${assessment.ready} ` +
          `moduleScore=${assessment.score} recovery=${assessment.recoveryValue.toFixed(2)}`,
      );
    }

    const [complete, missingBank, schemaMismatch] = results;
    if (
      !complete ||
      !missingBank ||
      !schemaMismatch ||
      complete.result.trustScore <= missingBank.result.trustScore ||
      schemaMismatch.assessment.recoveryValue > complete.assessment.recoveryValue ||
      (schemaMismatch.assessment.recoveryValue === complete.assessment.recoveryValue &&
        schemaMismatch.result.trustScore >= complete.result.trustScore) ||
      missingBank.result.ready ||
      schemaMismatch.result.ready
    ) {
      failures.push(
        `${vendor.vendorKey}: incomplete evidence must not match or exceed the complete pack.`,
      );
      console.log(`[FAIL] ${vendor.moduleId}/${resolveVendorName(vendor.moduleId, vendor.vendorKey)} evidence safety checks.`);
    } else {
      console.log(
        `[PASS] ${vendor.moduleId}/${resolveVendorName(vendor.moduleId, vendor.vendorKey)} provider evidence is recognized and degrades predictably.`,
      );
    }
  }

  await verifyM02VendorIsolation();
  await verifyM02ContractVendorNormalization();
  await verifyLoopBPeriodDeduplication();
  verifyCitationDispositions();
  verifyCanonicalRegistryIntegrity();
  if (failures.length > 0) {
    throw new Error(`Provider-aware CAAR verification failed:\n- ${failures.join("\n- ")}`);
  }
}

function verifyEngineCitationOutcomes(result: ReturnType<typeof buildCertificationResult>) {
  const citations = [
    ...result.assessments.flatMap((assessment) => assessment.ruleCitations),
    ...result.overallRuleCitations,
  ];

  for (const citation of citations) {
    if (!citation.disposition) {
      throw new Error(`${citation.ruleId} has no explicit citation disposition.`);
    }
    if (citation.varianceCents !== 0 && citation.disposition !== "monetary") {
      throw new Error(`${citation.ruleId} attributes variance without a monetary disposition.`);
    }
  }

  for (const assessment of result.assessments) {
    const attributedCents = assessment.ruleCitations
      .filter((citation) => citation.disposition === "monetary")
      .reduce((sum, citation) => sum + citation.varianceCents, 0);
    const recoveryCents = Math.round(assessment.recoveryValue * 100);
    if (attributedCents > recoveryCents) {
      throw new Error(
        `${assessment.moduleId} citations attribute ${attributedCents} cents against ${recoveryCents} cents of certified recovery.`,
      );
    }

    if (assessment.moduleId === "M01") {
      verifyM01CitationEvidence(assessment.ruleCitations);
    }
  }
}

function verifyM01CitationEvidence(citations: ReturnType<typeof buildCertificationResult>["assessments"][number]["ruleCitations"]) {
  const unsupportedWithoutIdentifiedCharge = new Set([
    "R062", "R063", "R065", "R066", "R067", "R068", "R069", "R071", "R072", "R073",
    "R074", "R075", "R076", "R077", "R079", "R080", "R081", "R082", "R083", "R084", "R085", "R086",
  ]);
  const unsupportedGovernanceProxies = new Set(["R091", "R092", "R094", "R095"]);
  const unexpected = citations.filter(
    (citation) => unsupportedWithoutIdentifiedCharge.has(citation.ruleId) || unsupportedGovernanceProxies.has(citation.ruleId),
  );

  if (unexpected.length > 0) {
    throw new Error(
      `M01 emitted rules without the required identified charge or canonical evidence: ${unexpected.map((citation) => citation.ruleId).join(", ")}.`,
    );
  }

  const belowThreshold = citations.find((citation) => citation.ruleId === "R088");
  const trustContribution = citations.find((citation) => citation.ruleId === "R093");
  if (belowThreshold?.disposition !== "informational" || trustContribution?.disposition !== "informational") {
    throw new Error("M01 threshold and Trust Score contribution records must remain informational.");
  }

  const reconciliation = citations.find((citation) => citation.ruleId === "R122");
  const reconciliationSample = reconciliation?.sampleEvidence[0];
  if (
    typeof reconciliationSample?.tg04_score === "number" &&
    reconciliationSample.tg04_score < 100 &&
    typeof reconciliationSample.processor_basis === "number" &&
    typeof reconciliationSample.pos_basis === "number" &&
    reconciliationSample.processor_basis > 0 &&
    reconciliationSample.pos_basis > 0 &&
    (typeof reconciliationSample.difference_amount !== "number" ||
      typeof reconciliationSample.difference_percent !== "number")
  ) {
    throw new Error("A TG04 deduction must persist both source bases and the absolute and percentage difference.");
  }
}

function verifyCanonicalRegistryIntegrity() {
  const ruleIds = CANONICAL_RULES.map((rule) => rule.ruleId);
  const clauseIds = CANONICAL_RULE_CLAUSES.map((rule) => rule.ruleId);
  const expectedIds = Array.from({ length: 198 }, (_, index) => `R${String(index + 1).padStart(3, "0")}`);

  if (
    CANONICAL_RULE_COUNT !== 198 ||
    new Set(ruleIds).size !== 198 ||
    new Set(clauseIds).size !== 198 ||
    expectedIds.some((ruleId) => !ruleIds.includes(ruleId) || !clauseIds.includes(ruleId))
  ) {
    throw new Error("Canonical registry integrity failed: R001-R198 must be unique and clause-backed.");
  }

  console.log("[PASS] Canonical registry contains one definition and clause record for every rule R001-R198.");
}

function verifyCitationDispositions() {
  const informationalCases = [
    { rule_id: "R999", sample_evidence: { disposition: "informational", samples: [] } },
    { rule_id: "R046", sample_evidence: { samples: [{ recovery_value: 0, threshold: 250 }] } },
    { rule_id: "R051", sample_evidence: { samples: [{ tg07: 0, tg10: 0 }] } },
    { rule_id: "R088", sample_evidence: { samples: [{ recovery_value: 0, threshold: 250 }] } },
    { rule_id: "R091", sample_evidence: { samples: [{ recovery_value: 500 }] } },
    { rule_id: "R092", sample_evidence: { samples: [{ has_statement: false }] } },
    { rule_id: "R093", sample_evidence: { samples: [{ tg07: 0, tg10: 0 }] } },
    { rule_id: "R094", sample_evidence: { samples: [{ auditability_score: 67 }] } },
    { rule_id: "R095", sample_evidence: { samples: [{ tg07: 0, tg10: 0 }] } },
    { rule_id: "R121", sample_evidence: { samples: [{ contract_age_days: 300 }] } },
    { rule_id: "R132", sample_evidence: { samples: [{ tg08_score: 0 }] } },
  ];
  const blockingCases = [
    { rule_id: "R046", sample_evidence: { disposition: "blocking", samples: [] } },
    { rule_id: "R121", sample_evidence: { samples: [{ contract_expired: true }] } },
    { rule_id: "R132", sample_evidence: { samples: [{ formula_version_changed_during_period: true }] } },
  ];

  if (
    informationalCases.some((citation) => !isInformationalRuleCitation(citation)) ||
    blockingCases.some((citation) => isInformationalRuleCitation(citation))
  ) {
    throw new Error("Rule disposition verification failed for calculation or evidence-specific controls.");
  }

  console.log("[PASS] Rule dispositions separate calculations from evidence-backed control failures.");
}

async function runVendorScenario(
  config: ScenarioConfig,
  vendor: VendorConfig,
  contractVendorKey = vendor.vendorKey,
  history: HistoricalCertificationSnapshot[] = [],
  period?: string,
) {
  const artifactIntakeState: Record<string, Awaited<ReturnType<typeof validateUploadArtifact>>> = {};
  const artifactContractState: Record<string, Record<string, string>> = {};
  const settlementKey = vendor.moduleId === "M01" ? "m01-processor" : "m02-settlement";
  const posKey = vendor.moduleId === "M01" ? "m01-pos" : "m02-pos";
  const agreementKey = vendor.moduleId === "M01" ? "m01-agreement" : "m02-agreement";
  const bankKey = vendor.moduleId === "M01" ? "m01-bank" : "m02-bank";
  const contractKey = vendor.moduleId === "M01" ? "m01-contract" : "m02-contract";

  const settlement = await loadArtifact(config, vendor, vendor.settlement, settlementKey);
  const pos = await loadArtifact(config, vendor, vendor.pos, posKey);
  artifactIntakeState[getKey(vendor.moduleId, settlementKey, vendor.vendorKey)] = settlement;
  artifactIntakeState[getKey(vendor.moduleId, posKey, vendor.vendorKey)] = pos;
  artifactIntakeState[getKey(vendor.moduleId, agreementKey, vendor.vendorKey)] = await loadArtifact(
    config,
    vendor,
    vendor.agreement,
    agreementKey,
  );
  if (config.withBank) {
    artifactIntakeState[getKey(vendor.moduleId, bankKey, vendor.vendorKey)] = await loadArtifact(
      config,
      vendor,
      vendor.bank,
      bankKey,
    );
  }
  artifactContractState[getKey(vendor.moduleId, contractKey, contractVendorKey)] = vendor.contract;

  if (settlement.vendorKey !== vendor.vendorKey || pos.vendorKey !== vendor.vendorKey) {
    throw new Error(`${vendor.vendorKey} evidence lost its provider scope during intake.`);
  }

  return buildCertificationResult({
    artifactContractState,
    artifactIntakeState,
    cadence: "monthly_final",
    history,
    location: testLocation(vendor.moduleId),
    period,
    runAt: new Date("2026-07-15T12:00:00Z"),
    scopeModules: [vendor.moduleId],
    scopeVendorKey: vendor.moduleId === "M02" ? vendor.vendorKey : undefined,
    uploadModules: uploadModules.filter(
      (module) => module.accountId === ACCOUNT_ID && module.id === vendor.moduleId,
    ),
  });
}

async function verifyLoopBPeriodDeduplication() {
  const toast = VENDORS.find((item) => item.vendorKey === "toast")!;
  const duplicateReruns: HistoricalCertificationSnapshot[] = [
    { completedAt: "2026-08-01T00:00:00Z", moduleId: "M01", period: "June 2026", recoveryValue: 0, ruleIds: ["R088"], trustScore: 80 },
    { completedAt: "2026-08-02T00:00:00Z", moduleId: "M01", period: "June 2026", recoveryValue: 0, ruleIds: ["R088"], trustScore: 82 },
    { completedAt: "2026-08-03T00:00:00Z", moduleId: "M01", period: "July 2026", recoveryValue: 0, ruleIds: ["R088"], trustScore: 82 },
  ];
  const result = await runVendorScenario(
    SCENARIOS[0],
    toast,
    toast.vendorKey,
    duplicateReruns,
    "June 2026",
  );
  const invalidLoopB = result.overallRuleCitations.filter((citation) =>
    citation.ruleId === "R154" || citation.ruleId === "R157",
  );
  if (invalidLoopB.length > 0) {
    throw new Error("Loop B must not treat same-period reruns or recurring informational rules as historical patterns.");
  }
  console.log("[PASS] Loop B deduplicates certification periods and ignores recurring informational rules.");
}

async function verifyM02ContractVendorNormalization() {
  const scenario = SCENARIOS[0];
  const cases = [
    { displayName: "DoorDash", vendor: VENDORS.find((item) => item.vendorKey === "doordash")! },
    { displayName: "Uber Eats", vendor: VENDORS.find((item) => item.vendorKey === "ubereats")! },
  ];

  for (const { displayName, vendor } of cases) {
    const result = await runVendorScenario(scenario, vendor, displayName);
    const assessment = result.assessments.find((item) => item.moduleId === "M02");
    const citation = assessment?.ruleCitations.find((item) => item.ruleId === "R014");
    const sample = citation?.sampleEvidence[0] as { contract_fields?: number; detail?: string } | undefined;

    if (
      !sample ||
      (sample.contract_fields ?? 0) < 3 ||
      sample.detail !== "Vendor profile lookup resolved governed contract values for this module."
    ) {
      throw new Error(
        `M02 vendor normalization failed: ${displayName} did not resolve under ${vendor.vendorKey}.`,
      );
    }
  }

  console.log("[PASS] M02 contract lookup normalizes DoorDash and Uber Eats display names.");
}

async function verifyM02VendorIsolation() {
  const scenario = SCENARIOS[0];
  const doorDash = VENDORS.find((vendor) => vendor.vendorKey === "doordash")!;
  const uberEats = VENDORS.find((vendor) => vendor.vendorKey === "ubereats")!;
  const doorDashResult = await runVendorScenario(scenario, doorDash);
  const uberEatsResult = await runVendorScenario(scenario, uberEats);

  const wrongScopeState: Record<string, Awaited<ReturnType<typeof validateUploadArtifact>>> = {};
  wrongScopeState[getKey("M02", "m02-settlement", "doordash")] = await loadArtifact(
    scenario,
    doorDash,
    doorDash.settlement,
    "m02-settlement",
  );
  const isolated = buildCertificationResult({
    artifactContractState: {},
    artifactIntakeState: wrongScopeState,
    cadence: "monthly_final",
    location: testLocation("M02"),
    scopeModules: ["M02"],
    scopeVendorKey: "ubereats",
    uploadModules: uploadModules.filter(
      (module) => module.accountId === ACCOUNT_ID && module.id === "M02",
    ),
  });
  const isolatedAssessment = isolated.assessments.find((item) => item.moduleId === "M02");
  if (
    isolated.ready ||
    (isolatedAssessment?.recoveryValue ?? 0) !== 0 ||
    isolated.trustScore >= doorDashResult.trustScore ||
    isolated.trustScore >= uberEatsResult.trustScore
  ) {
    throw new Error("M02 vendor isolation failed: one provider's evidence satisfied another provider's run.");
  }
  console.log("[PASS] M02 DoorDash and Uber Eats certify independently; cross-provider evidence is rejected.");
}

async function loadArtifact(
  scenario: ScenarioConfig,
  vendor: VendorConfig,
  fileName: string,
  artifactKey: string,
) {
  const fixtureName =
    artifactKey.endsWith("-bank") && scenario.name !== "complete-evidence"
      ? vendor.moduleId === "M01"
        ? "FohBoh_Test_M01_Bank_Statement.pdf"
        : "FohBoh_Test_M02_Bank_Statement.pdf"
      : fileName;
  const resolvedName = scenario.badHeaders
    ? fixtureName.replace(/\.csv$/i, "_BAD_HEADERS.csv")
    : fixtureName;
  const vendorSubdir =
    scenario.name === "complete-evidence"
      ? vendor.moduleId === "M01"
        ? "MO1"
        : vendor.vendorKey === "doordash"
          ? "MO2/DD"
          : "MO2/UE"
      : "";
  const currentM02Fixture =
    vendor.moduleId === "M02" && scenario.name !== "schema-mismatch"
      ? resolveCurrentM02Fixture(vendor.vendorKey, artifactKey)
      : null;
  const fixturePath = currentM02Fixture
    ? path.join(ROOT, currentM02Fixture)
    : path.join(ROOT, scenario.dir, vendorSubdir, resolvedName);
  const buffer = await readFile(fixturePath);
  return validateUploadArtifact({
    artifactKey,
    buffer,
    contentType: resolvedName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/csv",
    fileName: resolvedName,
    vendorKey: vendor.vendorKey,
    vendorName: resolveVendorName(vendor.moduleId, vendor.vendorKey),
  });
}

function resolveCurrentM02Fixture(vendorKey: string, artifactKey: string) {
  if (artifactKey === "m02-pos") {
    return "Test/MO2/CBM_Toast_SalesByChannel_2026-03_2026-05.csv";
  }
  if (vendorKey === "doordash") {
    if (artifactKey === "m02-settlement") {
      return "Test/MO2/DoorDash/CBM_DoorDash_PayoutSummary_2026-03_2026-05.csv";
    }
    if (artifactKey === "m02-agreement") {
      return "Test/MO2/DoorDash/FohBoh_Test_M02_DoorDash_DSP_Agreement_2026.pdf";
    }
  }
  if (vendorKey === "ubereats") {
    if (artifactKey === "m02-settlement") {
      return "Test/MO2/Uber/CBM_Uber_PayoutSettlement_2026-03_2026-05.csv";
    }
    if (artifactKey === "m02-agreement") {
      return "Test/MO2/Uber/FohBoh_Test_M02_UberEats_DSP_Agreement_2026.pdf";
    }
  }
  return null;
}

function deliveryContract() {
  return {
    __entry_mode: "manual",
    commission_base: "Subtotal before tax",
    delivery_active: "true",
    effective_date: "2026-01-01",
    rate_catering: "22",
    rate_delivery: "22",
    rate_member: "22",
    rate_pickup: "22",
    rate_sponsored: "22",
    store_id: LOCATION_ID,
  };
}

function testLocation(moduleId: ModuleId) {
  return {
    accountId: ACCOUNT_ID,
    id: LOCATION_ID,
    ium: "--",
    lastCertified: "",
    m01: 0,
    m02: 0,
    market: "Test City, Test State",
    modules: [{ label: moduleId, note: "", score: 0 }],
    name: "Test location",
    recovery: "$0",
    status: "At Risk" as const,
  };
}

function getKey(moduleId: ModuleId, artifactKey: string, vendorKey: string) {
  return `${ACCOUNT_ID}:${LOCATION_ID}:${moduleId}:${artifactKey}:${vendorKey}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
