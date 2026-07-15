import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildCertificationResult } from "@/components/sentry/caar-engine";
import { uploadModules } from "@/components/sentry/data";
import { validateUploadArtifact } from "@/lib/uploads/intake";

type ScenarioConfig = {
  badHeaders: boolean;
  dir: string;
  expectReady: boolean;
  maxScore?: number;
  minScore?: number;
  name: string;
  withBank: boolean;
};

const ROOT = process.cwd();
const ACCOUNT_ID = "C001";
const LOCATION_ID = "TEST-001";

const SCENARIOS: ScenarioConfig[] = [
  {
    dir: "Test/CAAR-92-Court-Admissible",
    expectReady: true,
    minScore: 85,
    name: "CAAR-92",
    badHeaders: false,
    withBank: true,
  },
  {
    dir: "Test/CAAR-74-Missing-Bank",
    expectReady: false,
    minScore: 70,
    maxScore: 79,
    name: "CAAR-74",
    badHeaders: false,
    withBank: false,
  },
  {
    dir: "Test/CAAR-38-Schema-Mismatch",
    expectReady: false,
    maxScore: 45,
    name: "CAAR-38",
    badHeaders: true,
    withBank: true,
  },
];

async function main() {
  for (const scenario of SCENARIOS) {
    const result = await runScenario(scenario);
    const trustScore = result.trustScore;
    const passReady = result.ready === scenario.expectReady;
    const passMin = scenario.minScore === undefined || trustScore >= scenario.minScore;
    const passMax = scenario.maxScore === undefined || trustScore <= scenario.maxScore;
    const passed = passReady && passMin && passMax;

    console.log(`\n[${passed ? "PASS" : "FAIL"}] ${scenario.name}`);
    console.log(`  trustScore=${trustScore} ready=${result.ready} status=${result.record.status}`);
    for (const assessment of result.assessments) {
      console.log(
        `  ${assessment.moduleId}: score=${assessment.score} ready=${assessment.ready} ` +
          `DC=${assessment.dimensions["Data Completeness"]} ` +
          `SA=${assessment.dimensions["Source Authenticity"]} ` +
          `CSR=${assessment.dimensions["Cross-System Reconciliation"]} ` +
          `RI=${assessment.dimensions["Rule Integrity"]}`,
      );
    }

    if (!passed) {
      throw new Error(`${scenario.name} no longer lands in the expected certification band.`);
    }
  }
}

async function runScenario(config: ScenarioConfig) {
  const artifactIntakeState: Record<string, Awaited<ReturnType<typeof validateUploadArtifact>>> = {};
  const artifactContractState: Record<string, Record<string, string>> = {};

  artifactIntakeState[getKey("M01", "m01-processor", "heartland")] = await loadArtifact(
    config.dir,
    config.badHeaders
      ? "FohBoh_Test_M01_Heartland_Processor_Statement_BAD_HEADERS.csv"
      : "FohBoh_Test_M01_Heartland_Processor_Statement.csv",
    "m01-processor",
    "heartland",
  );
  artifactIntakeState[getKey("M01", "m01-pos", "heartland")] = await loadArtifact(
    config.dir,
    config.badHeaders
      ? "FohBoh_Test_M01_Heartland_POS_Export_BAD_HEADERS.csv"
      : "FohBoh_Test_M01_Heartland_POS_Export.csv",
    "m01-pos",
    "heartland",
  );
  artifactIntakeState[getKey("M01", "m01-agreement", "heartland")] = await loadArtifact(
    config.dir,
    "FohBoh_Test_M01_Merchant_Agreement.pdf",
    "m01-agreement",
    "heartland",
  );
  if (config.withBank) {
    artifactIntakeState[getKey("M01", "m01-bank", "heartland")] = await loadArtifact(
      config.dir,
      "FohBoh_Test_M01_Bank_Statement.pdf",
      "m01-bank",
      "heartland",
    );
  }
  artifactContractState[getKey("M01", "m01-contract", "heartland")] = {
    __entry_mode: "manual",
    chargeback_fee: "15",
    contract_type: "Interchange Plus",
    effective_date: "2026-01-01",
    markup_bps: "25",
    monthly_fee: "0",
    pricing_model: "Interchange Plus",
    processor_name: "Heartland",
    txn_fee: "0.08",
  };

  artifactIntakeState[getKey("M02", "m02-settlement", "doordash")] = await loadArtifact(
    config.dir,
    config.badHeaders
      ? "FohBoh_Test_M02_DoorDash_Settlement_BAD_HEADERS.csv"
      : "FohBoh_Test_M02_DoorDash_Settlement.csv",
    "m02-settlement",
    "doordash",
  );
  artifactIntakeState[getKey("M02", "m02-pos", "doordash")] = await loadArtifact(
    config.dir,
    config.badHeaders
      ? "FohBoh_Test_M02_DoorDash_POS_Summary_BAD_HEADERS.csv"
      : "FohBoh_Test_M02_DoorDash_POS_Summary.csv",
    "m02-pos",
    "doordash",
  );
  artifactIntakeState[getKey("M02", "m02-agreement", "doordash")] = await loadArtifact(
    config.dir,
    "FohBoh_Test_M02_DoorDash_Agreement.pdf",
    "m02-agreement",
    "doordash",
  );
  if (config.withBank) {
    artifactIntakeState[getKey("M02", "m02-bank", "doordash")] = await loadArtifact(
      config.dir,
      "FohBoh_Test_M02_Bank_Statement.pdf",
      "m02-bank",
      "doordash",
    );
  }
  artifactContractState[getKey("M02", "m02-contract", "doordash")] = {
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

  return buildCertificationResult({
    artifactContractState,
    artifactIntakeState,
    cadence: "monthly_final",
    location: {
      accountId: ACCOUNT_ID,
      id: LOCATION_ID,
      name: "Test location",
      market: "Test City, Test State",
      modules: [
        { label: "M01", note: "", score: 0 },
        { label: "M02", note: "", score: 0 },
      ],
      m01: 0,
      m02: 0,
      ium: "--",
      lastCertified: "",
      recovery: "$0",
      status: "At Risk",
    },
    runAt: new Date("2026-07-15T12:00:00Z"),
    uploadModules,
  });
}

async function loadArtifact(
  baseDir: string,
  fileName: string,
  artifactKey: string,
  vendorKey: string,
) {
  const buffer = await readFile(path.join(ROOT, baseDir, fileName));
  return validateUploadArtifact({
    artifactKey,
    buffer,
    contentType: fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/csv",
    fileName,
    vendorKey,
    vendorName: vendorKey,
  });
}

function getKey(moduleId: "M01" | "M02", artifactKey: string, vendorKey: string) {
  return `${ACCOUNT_ID}:${LOCATION_ID}:${moduleId}:${artifactKey}:${vendorKey}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
