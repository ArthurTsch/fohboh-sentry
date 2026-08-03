import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildCertificationResult } from "@/components/sentry/caar-engine";
import { uploadModules } from "@/components/sentry/data";
import { validateUploadArtifact } from "@/lib/uploads/intake";

type RecoveryScenario = {
  dir: string;
  expectedM01: number;
  expectedM02: number;
  name: string;
};

const ROOT = process.cwd();
const ACCOUNT_ID = "C001";
const LOCATION_ID = "TEST-001";
const TOLERANCE = 0.01;

const SCENARIOS: RecoveryScenario[] = [
  {
    dir: "Test/archives/RECOVERY-M01-ONLY",
    expectedM01: 40.6,
    expectedM02: 0,
    name: "RECOVERY-M01-ONLY",
  },
  {
    dir: "Test/archives/RECOVERY-M02-ONLY",
    expectedM01: 0,
    expectedM02: 0,
    name: "RECOVERY-M02-ONLY",
  },
  {
    dir: "Test/archives/RECOVERY-BOTH",
    expectedM01: 40.6,
    expectedM02: 0,
    name: "RECOVERY-BOTH",
  },
];

async function main() {
  for (const scenario of SCENARIOS) {
    const { m01Result, m02Result } = await runScenario(scenario.dir);
    const m01 = m01Result.assessments.find((item) => item.moduleId === "M01")?.recoveryValue ?? 0;
    const m02 = m02Result.assessments.find((item) => item.moduleId === "M02")?.recoveryValue ?? 0;
    const passM01 = nearlyEqual(m01, scenario.expectedM01);
    const passM02 = nearlyEqual(m02, scenario.expectedM02);
    const passed = passM01 && passM02;

    console.log(`\n[${passed ? "PASS" : "FAIL"}] ${scenario.name}`);
    console.log(
      `  M01 trust=${m01Result.trustScore} recovery=${m01.toFixed(2)}; ` +
        `M02/DoorDash trust=${m02Result.trustScore} recovery=${m02.toFixed(2)}; ` +
        `total=${(m01 + m02).toFixed(2)}`,
    );

    if (!passed) {
      throw new Error(`${scenario.name} recovery values no longer match the expected module split.`);
    }
  }
}

async function runScenario(dir: string) {
  const artifactIntakeState: Record<string, Awaited<ReturnType<typeof validateUploadArtifact>>> = {};
  const artifactContractState: Record<string, Record<string, string>> = {};

  artifactIntakeState[getKey("M01", "m01-processor", "heartland")] = await loadArtifact(
    dir,
    "FohBoh_Test_M01_Heartland_Processor_Statement.csv",
    "m01-processor",
    "heartland",
  );
  artifactIntakeState[getKey("M01", "m01-pos", "heartland")] = await loadArtifact(
    dir,
    "FohBoh_Test_M01_Heartland_POS_Export.csv",
    "m01-pos",
    "heartland",
  );
  artifactIntakeState[getKey("M01", "m01-agreement", "heartland")] = await loadArtifact(
    dir,
    "FohBoh_Test_M01_Merchant_Agreement.pdf",
    "m01-agreement",
    "heartland",
  );
  artifactIntakeState[getKey("M01", "m01-bank", "heartland")] = await loadArtifact(
    dir,
    "FohBoh_Test_M01_Bank_Statement.pdf",
    "m01-bank",
    "heartland",
  );
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
    dir,
    "FohBoh_Test_M02_DoorDash_Settlement.csv",
    "m02-settlement",
    "doordash",
  );
  artifactIntakeState[getKey("M02", "m02-pos", "doordash")] = await loadArtifact(
    dir,
    "FohBoh_Test_M02_DoorDash_POS_Summary.csv",
    "m02-pos",
    "doordash",
  );
  artifactIntakeState[getKey("M02", "m02-agreement", "doordash")] = await loadArtifact(
    dir,
    "FohBoh_Test_M02_DoorDash_Agreement.pdf",
    "m02-agreement",
    "doordash",
  );
  artifactIntakeState[getKey("M02", "m02-bank", "doordash")] = await loadArtifact(
    dir,
    "FohBoh_Test_M02_Bank_Statement.pdf",
    "m02-bank",
    "doordash",
  );
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

  const shared = {
    artifactContractState,
    artifactIntakeState,
    cadence: "monthly_final" as const,
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
      status: "At Risk" as const,
    },
    runAt: new Date("2026-07-15T12:00:00Z"),
  };

  return {
    m01Result: buildCertificationResult({
      ...shared,
      scopeModules: ["M01"],
      uploadModules: uploadModules.filter(
        (module) => module.accountId === ACCOUNT_ID && module.id === "M01",
      ),
    }),
    m02Result: buildCertificationResult({
      ...shared,
      scopeModules: ["M02"],
      scopeVendorKey: "doordash",
      uploadModules: uploadModules.filter(
        (module) => module.accountId === ACCOUNT_ID && module.id === "M02",
      ),
    }),
  };
}

async function loadArtifact(dir: string, fileName: string, artifactKey: string, vendorKey: string) {
  const buffer = await readFile(path.join(ROOT, dir, fileName));
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

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= TOLERANCE;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
