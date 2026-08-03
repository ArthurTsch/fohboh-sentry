import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildCertificationResult } from "@/components/sentry/caar-engine";
import { uploadModules } from "@/components/sentry/data";
import { resolveVendorName } from "@/components/sentry/vendor-catalog";
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
  if (failures.length > 0) {
    throw new Error(`Provider-aware CAAR verification failed:\n- ${failures.join("\n- ")}`);
  }
}

async function runVendorScenario(config: ScenarioConfig, vendor: VendorConfig) {
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
  artifactContractState[getKey(vendor.moduleId, contractKey, vendor.vendorKey)] = vendor.contract;

  if (settlement.vendorKey !== vendor.vendorKey || pos.vendorKey !== vendor.vendorKey) {
    throw new Error(`${vendor.vendorKey} evidence lost its provider scope during intake.`);
  }

  return buildCertificationResult({
    artifactContractState,
    artifactIntakeState,
    cadence: "monthly_final",
    location: testLocation(vendor.moduleId),
    runAt: new Date("2026-07-15T12:00:00Z"),
    scopeModules: [vendor.moduleId],
    scopeVendorKey: vendor.moduleId === "M02" ? vendor.vendorKey : undefined,
    uploadModules: uploadModules.filter(
      (module) => module.accountId === ACCOUNT_ID && module.id === vendor.moduleId,
    ),
  });
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
