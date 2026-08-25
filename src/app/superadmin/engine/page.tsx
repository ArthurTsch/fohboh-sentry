import Link from "next/link";
import type { Metadata } from "next";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";
import {
  getCanonicalCoverageSummary,
  getCanonicalSectionCoverage,
  getRuntimeRuleCrosswalk,
  findCanonicalRule,
  findCanonicalRuleClause,
} from "@/lib/mge/canonical-registry";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
  ...adminMetadata,
  title: "Engine | SuperAdmin | FohBoh Sentry",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type DocSectionId =
  | "system-map"
  | "modules-inputs"
  | "workflows"
  | "engine"
  | "persistence"
  | "code-map";

type DocSection = {
  description: string;
  id: string;
  shortTitle: string;
  title: string;
};

type RuleGroup = {
  detail: string;
  ids: string[];
  title: string;
};

type RuntimeCrosswalkStatus = "implemented" | "partially_implemented" | "not_implemented";
type RuntimeCrosswalkRow = {
  canonicalRuleIds: string[];
  module: "M01" | "M02" | "M03" | "XMOD";
  note: string;
  runtimeRuleId: string;
  status: RuntimeCrosswalkStatus;
  triggerCount: number;
};

const sections: DocSection[] = [
  {
    id: "system-map",
    shortTitle: "System Map",
    title: "System Map",
    description: "How evidence becomes a governed CAAR.",
  },
  {
    id: "modules-inputs",
    shortTitle: "Modules",
    title: "Modules & Inputs",
    description: "Every source document, vendor file, and contract input.",
  },
  {
    id: "workflows",
    shortTitle: "Workflows",
    title: "Workflows",
    description: "Upload, schema, contract config, proof zone, and vault sealing.",
  },
  {
    id: "engine",
    shortTitle: "Engine",
    title: "Deterministic Engine",
    description: "Loop A, MQ6, Trust Gates, system health, and release logic.",
  },
  {
    id: "persistence",
    shortTitle: "Persistence",
    title: "Persistence",
    description: "What is saved, where, and why.",
  },
  {
    id: "code-map",
    shortTitle: "Code & Tables",
    title: "Code & Tables",
    description: "Implementation and storage map for SuperAdmin review.",
  },
];

const architectureSteps = [
  {
    step: "1",
    title: "Source Intake",
    text:
      "The app receives raw evidence per location and governed provider scope. CSV uploads are hashed, parsed, schema-checked, and reduced into numeric metrics. M02 CSVs also preserve certification-month buckets; undated POS summary rows are excluded from metrics. PDF uploads use coordinate-aware, all-page text extraction. A bank statement is uploaded once per location and linked to each configured module/provider evidence set while remaining one stored object.",
  },
  {
    step: "2",
    title: "Governed Workspace",
    text:
      "Each active vendor at each location has a governance workspace. That workspace carries source-column mappings, missing-field review, contract terms used by the engine, proof-zone verification, and a sealed vault state.",
  },
  {
    step: "3",
    title: "Certification Gate",
    text:
      "A certification request selects an explicit certification month and exactly one module. M02 additionally selects one provider. The run is blocked until required uploads are present and the matching schema and contract workspace are sealed for that scope.",
  },
  {
    step: "4",
    title: "Loop A Deterministic Execution",
    text:
      "The engine reconstructs expected fee behavior from governed contract truth, compares it against source evidence and reconciliation evidence, and emits deterministic rule citations with attributed variance.",
  },
  {
    step: "5",
    title: "Trust Scoring & Readiness",
    text:
      "The engine computes MQ6 dimensions, rolls them into Trust Gates TG01-TG11, applies system-health penalties where required, then determines module readiness and overall CAAR release readiness.",
  },
  {
    step: "6",
    title: "CAAR & Persistence",
    text:
      "The resulting module/provider/month CAAR includes trust score, recovery amount, findings, narrative, rule citations, Loop B context, workflow state, reconciliation notes/warnings/exceptions, and persistence into certification, CAAR, citation, audit, artifact, and system-health tables.",
  },
];

const m01Artifacts = [
  {
    doc: "Processor Statement",
    format: "CSV preferred, machine-readable PDF accepted",
    source: "Card processor portal",
    purpose:
      "Primary M01 source-of-truth fee evidence. Parsed into basisAmount, feeAmount, payoutAmount, transactionCount, card-brand fee buckets, refunds, voids, chargebacks, and related metrics.",
  },
  {
    doc: "POS Export",
    format: "CSV",
    source: "Restaurant POS / operating system",
    purpose:
      "Restaurant-side comparison file used for cross-system reconciliation against the processor statement. The governed workspace now supports a sealed POS source-schema step where a representative sample export is uploaded, headers are extracted or entered manually, and the validated header set is sealed for recurring upload validation.",
  },
  {
    doc: "Signed Merchant Agreement",
    format: "PDF",
    source: "Executed processor agreement",
    purpose:
      "Legal contract source for markup, txn fee, monthly fee, chargeback fee, pricing model, and card-brand rate truth.",
  },
  {
    doc: "Bank Statement",
    format: "PDF",
    source: "Operating account bank statement",
    purpose:
      "Monthly-final deposit reconciliation evidence tying processor payouts to the actual bank deposit trail. The physical PDF is location-shared: one upload is parsed per configured provider and linked into each governed evidence set.",
  },
  {
    doc: "Proof Zone Sample",
    format: "CSV",
    source: "Fresh vendor export from the same processor layout",
    purpose:
      "Monthly schema proof cycle verifying that the active sealed processor layout still matches the live upstream column layout.",
  },
];

const m02Artifacts = [
  {
    doc: "DSP Settlement Export",
    format: "CSV",
    source: "DoorDash / Uber Eats / Grubhub / other DSP portal",
    purpose:
      "Primary M02 source-of-truth settlement evidence. Parsed by certification month into total, delivery, and pickup basis; actual commission; order counts; payout, tax, promotion, and marketing metrics. Native DoorDash Final order status and Uber Eats Dining Mode fields govern the delivery/pickup classification.",
  },
  {
    doc: "POS Summary by Channel",
    format: "CSV",
    source: "Restaurant POS / operating system",
    purpose:
      "Restaurant-side channel summary used for certification-month, like-for-like reconciliation against DSP settlement sales. Rows without a valid business-day date are excluded, and mixed-month files are bucketed so a June certification cannot include July. If POS represents delivery-channel sales only, TG04 compares it with settlement delivery basis while pickup remains in the fee calculation.",
  },
  {
    doc: "Signed DSP Agreement",
    format: "PDF",
    source: "Executed DSP merchant agreement",
    purpose:
      "Legal contract source for commission rates, commission base, remittance logic, and other marketplace fee terms.",
  },
  {
    doc: "Bank Deposit Evidence",
    format: "PDF",
    source: "Operating account bank statement",
    purpose:
      "Monthly-final payout reconciliation evidence tying marketplace settlement payout to actual bank deposit behavior. It reuses the location-level shared bank PDF and provider-specific parsed metrics rather than requiring another upload.",
  },
];

const m03Artifacts = [
  {
    doc: "Royalty Statement / Report",
    format: "CSV or PDF, depending on franchisor source system",
    source: "Franchisor portal / royalty-reporting system",
    purpose:
      "Primary M03 source-of-truth royalty evidence. Parsed into royalty basis, royalty charged, timing, adjustments, and other governed royalty metrics used by the deterministic engine.",
  },
  {
    doc: "POS Sales Export",
    format: "CSV",
    source: "Restaurant POS / operating system",
    purpose:
      "Restaurant-side sales record used to verify royalty basis, period coverage, and cross-system agreement against the royalty source.",
  },
  {
    doc: "Signed Royalty / Franchise Agreement",
    format: "PDF",
    source: "Executed franchise or royalty agreement",
    purpose:
      "Legal contract source for royalty rate, royalty basis, exclusions, grace periods, fee carve-outs, and other governed M03 terms.",
  },
  {
    doc: "Bank Deposit / Withdrawal Evidence",
    format: "PDF",
    source: "Operating account bank statement",
    purpose:
      "Monthly-final evidence tying royalty charges or remittances to the actual account trail when bank-side validation is required.",
  },
];

const nonDocumentInputs = [
  "Selected active modules per location. The production certification API accepts exactly one module per CAAR run even when multiple modules are enabled.",
  "Selected active source vendors per location: for example Heartland or Toast for M01, DoorDash or Uber Eats for M02, and the active royalty/franchise source for M03.",
  "Schema Registry mappings: exact native source columns bound to canonical engine fields.",
  "POS source schema governance: a representative POS CSV can be uploaded to extract headers, corrected manually, validated, and sealed as the recurring Upload Data expectation.",
  "Contract Config values: governed legal terms used by the deterministic engine across M01, M02, and M03.",
  "Location ownership, team access, and certification scope resolution.",
  "Required certification month in YYYY-MM format. The UI defaults to the previous completed month, permits past/current months, rejects future months, and selects the matching stored month bucket from both M02 settlement and POS evidence.",
];

const workflowCards = [
  {
    title: "Upload Data",
    items: [
      "Evidence is location- and scope-specific, except the bank PDF, which is physically shared at location level and linked into module/provider scopes.",
      "Only the active source vendors for that location should appear.",
      "CSV readiness requires all four structural gates: upload, hash, schema, and fields.",
      "PDF readiness requires upload and hash, plus parser-derived usability where the workflow needs text-based validation.",
      "Saved uploads are persisted and replace the previous artifact for the same document slot when re-uploaded.",
      "The bank statement is location-level. One physical PDF is stored, then separately parsed and linked for all configured module/provider evidence scopes.",
      "PDF extraction reads all pages, reconstructs horizontal rows from coordinates, preserves explicit line endings, and excludes rotated scanner-control text from the reading layer. Toast M01 processor PDFs persist the Summary breakdown separately: Toast Processing Fees are the governed like-for-like comparison amount, while Interchange Fees, Network Fees, Other Adjustments, and Credit Card Balance remain informational source values in the CAAR.",
    ],
  },
  {
    title: "Schema Registry",
    items: [
      "Column mapping binds native vendor columns to canonical engine fields such as `gross_sales_amount`, `processor_markup_bps`, or `network_fee_amount`.",
      "These mappings are not cosmetic. They are how the engine knows which incoming source values correspond to the fee model it certifies.",
      "The sealed schema workspace is part of the governed certification package and is consumed by certification readiness and auditability logic.",
      "Proof Zone is the recurring monthly sample check that confirms the sealed schema still matches the live vendor export layout.",
    ],
  },
  {
    title: "Contract Config",
    items: [
      "Contract Config is the governed legal fee model used by the engine.",
      "For M01 it includes values like `markup_bps`, `txn_fee`, `monthly_fee`, card-brand rate fields, pricing model, and chargeback fee.",
      "For M02 it includes separate delivery and pickup commission rates, commission base, and marketplace remittance logic. Expected commission is reconstructed from the classified delivery and pickup bases rather than an averaged rate.",
      "Sealing the contract config creates the governed fee baseline used in certification math and in TG08 formula integrity checks.",
    ],
  },
  {
    title: "Vault / Sealing",
    items: [
      "Sealing is what turns a draft workspace into governed truth for certification.",
      "A sealed workspace represents the active column mapping, governed contract values, and proof-cycle state for a given module and vendor at a given location.",
      "Certification uses the sealed state, not just whatever happens to be visible in the editor.",
      "If a workspace is not sealed, the location may upload files, but final certification remains blocked.",
    ],
  },
  {
    title: "Certification & CAAR",
    items: [
      "The preflight requires one module, one explicit month, and one M02 provider when applicable.",
      "The progress UI exposes real client milestones and uses an indeterminate moving state while the atomic server certification transaction runs.",
      "Monthly reruns for the same location/module/provider/cadence reuse a stable CAAR identity instead of creating accidental duplicates.",
      "The CAAR separates blocking reconciliation exceptions from amber timing warnings and informational prior-period carryover notes.",
      "M01 and M02 CAARs persist a dedicated calculation-methodology record. M01 shows expected processor fee components and POS comparison; M02 shows delivery/pickup bases, rates, expected versus actual commission, and the like-for-like TG04 comparison.",
      "Certification persistence uses a bounded 30-second transaction timeout because CAAR sealing includes database writes and artifact storage.",
    ],
  },
];

const mq6 = [
  {
    name: "Data Completeness",
    weight: "10%",
    detail:
      "Structural certification gate. Required artifacts must satisfy their completeness rules. CSV artifacts require uploaded + hash + schema + fields. Monthly-final bank evidence is required for final release.",
  },
  {
    name: "Data Freshness",
    weight: "10%",
    detail:
      "Measures whether uploads are still current inside the certification freshness window. Current implementation uses a 45-day window from evaluation date.",
  },
  {
    name: "Source Authenticity",
    weight: "20%",
    detail:
      "Scores whether governed source evidence exists and is authentic enough to trust. Current production logic gives points for source statement, POS source, and bank or cadence-appropriate proof.",
  },
  {
    name: "Cross-System Reconciliation",
    weight: "25%",
    detail:
      "Heaviest trust dimension. Tests POS-to-source basis tolerance, contract-driven shadow-fee computability, and settlement-to-bank tie-out where cadence requires it.",
  },
  {
    name: "Rule Integrity",
    weight: "15%",
    detail:
      "100 only when governed contract input, governed statement evidence, and schema support are all present so deterministic rules can actually execute with integrity.",
  },
  {
    name: "Auditability",
    weight: "20%",
    detail:
      "Tests whether upload provenance, source lineage, and governed contract linkage are complete enough for traceable external review.",
  },
];

const trustGates = [
  {
    gate: "TG01",
    detail:
      "Data completeness gate. Required source fields must meet the active module threshold; missing POS evidence caps the gate in the low-confidence band.",
  },
  {
    gate: "TG02",
    detail: "Source authenticity gate. Requires the active source package and intact upload integrity evidence; partial provenance receives only partial credit.",
  },
  {
    gate: "TG03",
    detail: "Vendor profile currency gate. Requires governed contract terms and reduces the score when the active contract is expired.",
  },
  {
    gate: "TG04",
    detail: "Like-for-like reconciliation. M02 compares unique DSP orders with POS-certified DSP orders on the same month, provider, and channel scope: up to 1% passes, 1-5% is partial, and above 5% fails. R123 may fire only when both comparable counts exist; a missing side is evidence coverage, not a proven mismatch. Pickup remains included in fee testing when the POS report is delivery-only.",
  },
  {
    gate: "TG05",
    detail: "Duplicate-event gate. Scores duplicate or duplicate-like transaction incidence for the active certification period.",
  },
  {
    gate: "TG06",
    detail: "Period coverage gate. Monthly final requires all governed artifacts, including bank evidence; weekly preliminary may proceed without the final bank gate.",
  },
  {
    gate: "TG07",
    detail:
      "Fee legitimacy gate. Scores attributed variance as a percentage of reviewed fee volume. M02 uses fulfillment-aware delivery and pickup contract rates; undercharges and immaterial overcharges do not create recoverable variance.",
  },
  {
    gate: "TG08",
    detail: "KPI formula currency gate. Requires governed formula inputs for the full certification period and detects incomplete or split-period governance.",
  },
  {
    gate: "TG09",
    detail: "Audit-lineage completeness across upload provenance, governed configuration, engine execution, and certification persistence.",
  },
  {
    gate: "TG10",
    detail: "Narrative hash readiness. Requires both formula currency and audit lineage before deterministic narrative sealing.",
  },
  {
    gate: "TG11",
    detail:
      "Composite CAAR eligibility gate computed after TG01-TG10 and system health. The weighted pre-eligibility score must clear the documented release threshold.",
  },
];

const m01RuleGroups: RuleGroup[] = [
  {
    title: "Interchange / Downgrade Attribution",
    ids: ["MFR-INT-12", "MFR-INT-14", "MFR-INT-22", "MFR-INT-23"],
    detail:
      "Uses card-brand buckets, observed fee pools, and governed card-brand rate tables to attribute downgrade-style or debit-bucket fee variance.",
  },
  {
    title: "Markup & Per-Transaction Overage",
    ids: ["MFR-MRK-03", "MFR-MRK-05"],
    detail:
      "Reconstructs expected markup and per-transaction economics from the sealed contract, compares against observed statement fee behavior, and attributes excess basis-point or per-transaction variance.",
  },
  {
    title: "Billing & Monthly Fee Drift",
    ids: ["MFR-BIL-15", "MFR-BIL-16", "MFR-BIL-17", "MFR-FEE-21"],
    detail:
      "Detects unexplained billing delta, extra billing pools, monthly-fee drift, and unallocated extra fee pools beyond contractual truth.",
  },
  {
    title: "Volume / Tier / Reserve",
    ids: ["MFR-VOL-08", "MFR-VOL-09", "MFR-RES-02"],
    detail:
      "Uses tier-model assumptions, residual fee variance, and implied reserve math to attribute recoverable overage where the statement economics diverge from the governed fee model.",
  },
  {
    title: "Chargeback / Refund / Void / AVS",
    ids: ["MFR-CBK-04", "MFR-CBK-05", "MFR-RFD-01", "MFR-VOID-03", "MFR-AVS-01"],
    detail:
      "Attributes operational fee leakage tied to chargebacks, refunds, voided transactions, and service-fee pools that behave like AVS or operational add-on charges.",
  },
];

const m02RuleGroups: RuleGroup[] = [
  {
    title: "Commission Overcharge",
    ids: ["DSP-COM-04", "DSP-COM-05", "DSP-COM-06", "DSP-COM-07"],
    detail:
      "Compares actual marketplace commission with fulfillment-aware expected commission: delivery basis × delivery rate plus pickup basis × pickup rate. Like-for-like POS reconciliation does not remove pickup from fee testing.",
  },
  {
    title: "Promotion / Marketing / Refund Logic",
    ids: ["DSP-PRM-02", "DSP-PRM-03", "DSP-RFD-07", "DSP-RFD-08"],
    detail:
      "Attributes promo pools, marketing deductions, and refund-linked commission leakage that exceeds governed marketplace terms.",
  },
  {
    title: "Duplicate / Delivery / Residual Variance",
    ids: ["DSP-DUP-01", "DSP-DEL-04", "DSP-DASH-02", "DSP-VAR-11"],
    detail:
      "Handles duplicate fee events, delivery-fee pools, DoorDash-style fee leakage, and remaining unexplained marketplace variance after explicit rule attribution.",
  },
];

const advancedEngineBlocks = [
  {
    title: "Loop A",
    summary: "Current-period deterministic certification.",
    points: [
      "Builds a module-scoped artifact bundle: statement, POS, agreement, bank, and sealed contract terms.",
      "Computes metrics from source evidence and reconstructs expected fee behavior from the sealed contract.",
      "Runs deterministic rules in sequence and reduces residual variance after each fired citation.",
      "Applies the canonical module boundary before persistence so a recovery rule cannot leak into another module's CAAR.",
      "Outputs module recovery amount, MQ6 dimensions, trust gates, readiness state, and finding class.",
    ],
  },
  {
    title: "Loop B",
    summary: "Historical pattern and re-certification layer.",
    points: [
      "Consumes historical certification snapshots from previous persisted runs.",
      "Detects recurring patterns such as ascending variance trend, vendor-systemic repetition, re-certification-required jumps, and cross-module pattern behavior.",
      "Produces Loop B findings with confidence score, affected periods, CAAR eligibility, and audit-required flags.",
      "Current persisted Loop B findings are saved separately and included in the CAAR payload.",
    ],
  },
  {
    title: "Cross-Module Rollup",
    summary: "Aggregate analysis capability outside the single-module production run contract.",
    points: [
      "The engine can weight reviewed fee volume across active modules when it receives a composite module set.",
      "Tests module-weight imbalance and recovery-direction conflict.",
      "The current `/api/v1/certifications/run` contract enforces exactly one module, so each production CAAR remains independently scoped.",
      "Cross-module summaries are analytical rollups and historical context; they do not merge M01 and M02 into one production CAAR.",
    ],
  },
  {
    title: "System Health",
    summary: "Operational integrity of the certification package itself.",
    points: [
      "Persists SYS-layer events R186-R198 around hash integrity, rule-set alignment, formula integrity, audit lineage, clock integrity, and chain completeness.",
      "Fail-state health flags can reduce final trust score via penalty points.",
      "`MASTER_SYSTEM_HEALTHY` is required for clean final readiness.",
      "These events are separate from M01/M02/M03 fee rules and protect the certifiability of the overall platform output.",
    ],
  },
];

const systemHealthRules: RuleGroup[] = [
  {
    title: "Governance & Rule-Set Integrity",
    ids: ["R186", "R187", "R188", "R189", "R190"],
    detail:
      "Validates sealed governance hashes, parser staleness indicators, rule-set version lock, formula integrity, and audit-lineage completeness.",
  },
  {
    title: "Host / Chain / Runtime Integrity",
    ids: ["R191", "R192", "R193", "R194", "R195"],
    detail:
      "Validates host clock drift, input hash chain completeness, backlog threshold signals, execution latency warnings, and sequencing guarantees between Loop A and Loop B.",
  },
  {
    title: "Master Health Attestation",
    ids: ["R196", "R197", "R198"],
    detail:
      "Determines whether system-health penalties apply, persists the health audit stream, and issues the final master-system attestation used by release logic.",
  },
];

const releaseRules = [
  "Certification can run weekly preliminary or monthly final.",
  "Every request must include an explicit non-future certification month; the current date is never silently treated as the CAAR period.",
  "Each production run certifies exactly one module. M02 certifies exactly one selected delivery provider.",
  "Only monthly final can pass the complete Certified CAAR release gate.",
  "Per-module readiness currently requires score >= 85 plus strong completeness, authenticity, reconciliation, and rule-integrity conditions.",
  "CAAR readiness requires the selected module to be ready, overall trust score >= 85, TG11 PASS, and healthy system-health state.",
  "If both M01 and M02 are enabled, they are run separately and produce independent CAARs.",
  "Canonical recovery applicability is enforced before persistence and again when a CAAR is rendered: R016-R055 are M02-only, R056-R095 are M01-only, and R096-R115 are M03-only.",
  "R123 represents a measured reconciliation failure and is applicable only when both like-for-like inputs exist. Missing comparison evidence remains a TG04 coverage condition and does not become an R123 mismatch.",
  "Prior-period bank carryovers are informational notes; exact reference/amount matches with cross-month dates are timing warnings; missing references or amount mismatches remain blocking exceptions.",
];

const ruleApplicabilityRows = [
  { scope: "Shared controls", rules: "R001-R015, R116-R165, R176-R198", detail: "Applied only when their own evidence and workflow prerequisites are satisfied." },
  { scope: "M02 Delivery Fee Recovery", rules: "R016-R055", detail: "Eligible only for the selected delivery-provider certification and CAAR." },
  { scope: "M01 Merchant Fee Recovery", rules: "R056-R095", detail: "Eligible only for the processor certification and CAAR." },
  { scope: "M03 Royalty Recovery", rules: "R096-R115", detail: "Eligible only for an M03 certification and CAAR." },
  { scope: "Cross-module analysis", rules: "R166-R175", detail: "Excluded from single-module production CAARs; reserved for a genuine multi-module analytical context." },
];

const persistenceRows = [
  {
    table: "uploads_v2",
    purpose:
      "Stores persisted artifact evidence links, vendor scope, validation summary, hash, extracted metrics, object key, and supersession chain. Shared bank evidence may have multiple provider links pointing to one stored PDF object.",
  },
  {
    table: "schema_registry_v2",
    purpose:
      "Stores governance workspaces for source-column binding and proof-cycle sealing per location, module, and vendor.",
  },
  {
    table: "contract_configs_v2",
    purpose:
      "Stores governed contract terms used by the engine and their sealed vault state per location, module, and vendor.",
  },
  {
    table: "cert_runs_v2",
    purpose:
      "Stores each deterministic certification execution, cadence, trust score, upload references, schema references, and variance amount.",
  },
  {
    table: "mq6_scores_v2",
    purpose:
      "Stores dimension-level scoring evidence for each certification run.",
  },
  {
    table: "rule_citations_v2",
    purpose:
      "Stores fired deterministic rule citations with sample evidence and attributed variance.",
  },
  {
    table: "caars_v2",
    purpose:
      "Stores the governed CAAR identity, selected module/provider/month scope, canonical payload and PDF object keys, seal hash, previous-hash chain, release state, and supersession metadata.",
  },
  {
    table: "caar_reports",
    purpose:
      "Stores the business-facing CAAR summary record used by the app and management views.",
  },
  {
    table: "caar_artifacts_v2",
    purpose:
      "Stores the canonical JSON and rendered CAAR PDF artifact records, including object key, byte count, sequence, and SHA-256. The structured trust, workflow, health, and loop data lives inside the canonical payload.",
  },
  {
    table: "loop_b_findings_v2",
    purpose:
      "Stores persisted historical-pattern findings produced by Loop B.",
  },
  {
    table: "system_health_events_v2",
    purpose:
      "Stores SYS-layer runtime and governance integrity findings R186-R198 for each certification package.",
  },
  {
    table: "audit_log_v2",
    purpose:
      "Stores the application audit trail for certification and governance actions.",
  },
  {
    table: "restaurant_sentry_state",
    purpose:
      "Stores the current location-facing status rollup shown in the app: module scores, recovery display, status, and last-certified snapshot.",
  },
];

const codeMap = [
  {
    file: "src/lib/uploads/intake.ts",
    detail: "Primary intake validation, upload hashing, schema and field readiness, and metric extraction.",
  },
  {
    file: "src/lib/uploads/pdf.ts",
    detail: "PDF text extraction and document-level parser helpers used by upload persistence.",
  },
  {
    file: "src/app/api/v1/uploads/route.ts",
    detail: "Persisted upload API, shared bank evidence linking, safe replacement/removal, and scoped access enforcement.",
  },
  {
    file: "src/app/api/v1/certifications/run/route.ts",
    detail: "Production certification request contract: explicit month, exactly one module, and required M02 provider scope.",
  },
  {
    file: "src/app/api/caars/route.ts",
    detail: "CAAR list and traceability projection, including payout-to-bank exceptions, timing warnings, and prior-period notes.",
  },
  {
    file: "src/lib/mge/engine.ts",
    detail: "Deterministic module engine, M01/M02/M03 rule registry, MQ6 scoring, Trust Gates, system health, and readiness logic.",
  },
  {
    file: "src/components/sentry/caar-engine.ts",
    detail: "Location-level certification assembly: Loop B, cross-module summary, workflow state, overall trust score, and CAAR output.",
  },
  {
    file: "src/lib/certification/service.ts",
    detail: "Server execution path that loads persisted governance and uploads, runs certification, derives system health, and persists results.",
  },
  {
    file: "src/lib/caar/persistence.ts",
    detail: "Persistence of canonical CAAR payloads, artifacts, and related certification outputs.",
  },
  {
    file: "src/components/sentry/SentryApp.tsx",
    detail: "Client workflow orchestration, gating, upload UX, run-certification triggers, and location waterfall behavior.",
  },
];

const canonicalCoverageSummary = getCanonicalCoverageSummary();
const canonicalSectionCoverage = getCanonicalSectionCoverage();
const runtimeRuleCrosswalk = getRuntimeRuleCrosswalk();

function getRuntimeCrosswalkStatus(canonicalRuleIds: string[]): RuntimeCrosswalkStatus {
  const statuses = canonicalRuleIds
    .map((ruleId) => findCanonicalRule(ruleId))
    .filter((rule): rule is NonNullable<typeof rule> => Boolean(rule))
    .map(
      (rule) =>
        canonicalSectionCoverage.find((section) => section.sectionNumber === rule.sectionNumber)?.status ??
        "not_implemented",
    );

  if (statuses.includes("not_implemented")) {
    return "not_implemented";
  }
  if (statuses.includes("partially_implemented")) {
    return "partially_implemented";
  }
  return "implemented";
}

function getRuntimeCrosswalkStatusLabel(status: RuntimeCrosswalkStatus) {
  switch (status) {
    case "implemented":
      return "Live runtime";
    case "partially_implemented":
      return "Partial section";
    default:
      return "Registry only";
  }
}

function getRuntimeCrosswalkStatusClassName(status: RuntimeCrosswalkStatus) {
  switch (status) {
    case "implemented":
      return "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] text-[#00A152]";
    case "partially_implemented":
      return "border-[rgba(212,131,10,0.24)] bg-[rgba(212,131,10,0.08)] text-[#A96800]";
    default:
      return "border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] text-[var(--accent)]";
  }
}

function getCanonicalOutputDomain(ruleId: string) {
  const canonical = findCanonicalRule(ruleId);
  const clause = findCanonicalRuleClause(ruleId);
  const thenAction = clause?.thenAction?.trim() ?? "";
  const trailingDomain = thenAction.match(/\b([A-Z][A-Z0-9_/-]{2,})$/)?.[1];

  if (trailingDomain) {
    return trailingDomain;
  }

  return canonical?.sectionTitle ?? "Canonical runtime output";
}

function hasUsableClause(ruleId: string) {
  const clause = findCanonicalRuleClause(ruleId);
  if (!clause) return false;
  if (!clause.ruleName?.trim() || !clause.ifCondition?.trim() || !clause.thenAction?.trim()) {
    return false;
  }
  if (ruleId === "R001" && clause.ruleName.includes("TOTAL 198")) {
    return false;
  }
  return true;
}

function resolveDocSectionId(value: string | undefined): DocSectionId {
  const validIds = new Set<DocSectionId>([
    "system-map",
    "modules-inputs",
    "workflows",
    "engine",
    "persistence",
    "code-map",
  ]);
  return validIds.has(value as DocSectionId) ? (value as DocSectionId) : "system-map";
}

export default async function SuperAdminEnginePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const activeSectionId = resolveDocSectionId(getSearchParam(resolvedSearchParams, "section"));
  const activeSection =
    sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const persistedRuleCounts = await prisma.rule_citations_v2.groupBy({
    by: ["rule_id"],
    _sum: {
      fired_count: true,
    },
  });
  const persistedRuleCountMap = new Map(
    persistedRuleCounts.map((row) => [row.rule_id, row._sum.fired_count ?? 0]),
  );
  const runtimeCrosswalkRows = runtimeRuleCrosswalk.map((rule) => ({
    ...rule,
    status: getRuntimeCrosswalkStatus(rule.canonicalRuleIds),
    triggerCount: persistedRuleCountMap.get(rule.runtimeRuleId) ?? 0,
  }));

  return (
    <AdminShell
      currentPath="/superadmin/engine"
      eyebrow="System Documentation"
      title="Engine Documentation"
      description="Complete SuperAdmin documentation for the production certification engine, module workflows, governance sealing, scoring, persistence, and rule behavior."
    >
      <div className="space-y-6">
        <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                Live Production Reference
              </div>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.05em] text-[var(--text)]">
                FohBoh Sentry Certification Engine
              </h1>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                This page is the canonical SuperAdmin documentation for how the app currently works in production.
                It documents module inputs, governance workspaces, contract sealing, deterministic certification,
                Trust Gates, Loop B history logic, system-health rules, CAAR assembly, and database persistence.
                The audited canonical registry marks `R001-R198` as implemented. Runtime-family citation IDs are a
                separate operational crosswalk and should not be mistaken for 198 distinct citation names firing on every run.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(0,163,68,0.22)] bg-[rgba(0,163,68,0.08)] px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#087A38]">
                <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                Runtime-aligned review · August 4, 2026
              </div>
            </div>

            <div className="grid min-w-[300px] gap-3 sm:grid-cols-2">
              <StatCard value={`${canonicalCoverageSummary.canonicalRuleCount}`} label="Canonical rules in source registry" />
              <StatCard value="TG01-TG11" label="Composite trust-gate framework" />
              <StatCard value={`${canonicalCoverageSummary.directImplementedCanonicalRuleCount}`} label="Audited canonical rules implemented" />
              <StatCard value="Loop A + Loop B + SYS + M03" label="Current implemented certification layers" />
            </div>
          </div>
        </section>

        <section className="sticky top-4 z-20 rounded-[32px] border border-[var(--border)] bg-white/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Documentation Menu
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] text-[var(--text)]">
                {activeSection.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                {activeSection.description}
              </p>
            </div>
            <div className="text-sm leading-7 text-[var(--muted)]">
              One section is shown at a time so the SuperAdmin manual stays clean and easier to maintain.
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={`/superadmin/engine?section=${section.id}`}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activeSectionId === section.id
                    ? "border-[var(--text)] bg-[var(--text)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                }`}
              >
                {section.title}
              </Link>
            ))}
          </div>
        </section>

        {activeSectionId === "system-map" ? <SystemMapSection /> : null}
        {activeSectionId === "modules-inputs" ? <ModulesInputsSection /> : null}
        {activeSectionId === "workflows" ? <WorkflowsSection /> : null}
        {activeSectionId === "engine" ? (
          <DeterministicEngineSection runtimeCrosswalkRows={runtimeCrosswalkRows} />
        ) : null}
        {activeSectionId === "persistence" ? <PersistenceSection /> : null}
        {activeSectionId === "code-map" ? <CodeMapSection /> : null}
      </div>
    </AdminShell>
  );
}

function SystemMapSection() {
  return (
    <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
      <SectionHeader
        eyebrow="System Map"
        title="End-to-End Architecture"
        description="The production flow from source file intake to final persisted CAAR."
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {architectureSteps.map((item) => (
            <div key={item.step} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <div className="text-lg font-semibold text-[var(--text)]">{item.title}</div>
                  <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <HighlightCard
            tone="green"
            title="Inputs"
            lines={[
              "Location-scoped evidence uploads",
              "Vendor-specific schema workspaces",
              "Sealed contract config terms",
              "Historical certification snapshots",
              "Requested module scope for the current run",
            ]}
          />
          <HighlightCard
            tone="amber"
            title="Engine"
            lines={[
              "Metric extraction",
              "Readiness gates",
              "MQ6 scoring",
              "Trust Gates TG01-TG11",
              "Loop A rule firing",
              "Loop B historical analysis",
              "System-health evaluation",
            ]}
          />
          <HighlightCard
            tone="blue"
            title="Outputs"
            lines={[
              "Certification result per requested module",
              "Trust score and recovery amount",
              "Rule citations and evidence narrative",
              "CAAR report payload",
              "Persisted runs, MQ6, citations, Loop B, and SYS events",
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function ModulesInputsSection() {
  return (
    <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
      <SectionHeader
        eyebrow="Modules & Inputs"
        title="Every Input the Engine Uses"
        description="Document inputs are bolded and explained with their exact role in certification."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ModuleCard
          moduleId="M01"
          title="Merchant Fee Recovery"
          summary="Processor-side certification of card-processing economics against the sealed merchant agreement."
          artifacts={m01Artifacts}
        />
        <ModuleCard
          moduleId="M02"
          title="Delivery Fee Recovery"
          summary="Marketplace-side certification of DSP settlement economics against the sealed DSP agreement."
          artifacts={m02Artifacts}
        />
        <ModuleCard
          moduleId="M03"
          title="Royalty Recovery"
          summary="Royalty and franchise-fee engine support against sealed agreement and basis evidence. The audited runtime exists, but the current tenant certification UI exposes M01 and M02 selection only."
          artifacts={m03Artifacts}
        />
      </div>

      <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Non-Document Inputs
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {nonDocumentInputs.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-sm leading-7 text-[var(--muted)]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowsSection() {
  return (
    <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
      <SectionHeader
        eyebrow="Workflows"
        title="Governed Workflow Surfaces"
        description="What each workflow area does and how it contributes to certification readiness."
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {workflowCards.map((card) => (
          <div key={card.title} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-lg font-semibold text-[var(--text)]">{card.title}</div>
            <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--muted)]">
              {card.items.map((item) => (
                <div key={item}>- {item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.04)] p-5">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Important Production Rule
        </div>
        <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
          Uploads collected during onboarding are not supposed to be disposable. They are the same persisted
          evidence set used later by certification. The app should not make the user re-upload identical evidence
          just to run the certification cycle again.
        </div>
      </div>
    </section>
  );
}

function DeterministicEngineSection({
  runtimeCrosswalkRows,
}: {
  runtimeCrosswalkRows: RuntimeCrosswalkRow[];
}) {
  return (
    <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
      <SectionHeader
        eyebrow="Deterministic Engine"
        title="How Certification Is Actually Calculated"
        description="MQ6, Trust Gates, module rules, Loop B, system health, and release logic."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-lg font-semibold text-[var(--text)]">MQ6 Dimensions</div>
            <div className="mt-4 space-y-3">
              {mq6.map((item) => (
                <div key={item.name} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-[var(--text)]">{item.name}</div>
                    <div className="rounded-full border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {item.weight}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-lg font-semibold text-[var(--text)]">Release Logic</div>
            <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--muted)]">
              {releaseRules.map((item) => (
                <div key={item}>- {item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-lg font-semibold text-[var(--text)]">Rule Applicability by CAAR</div>
            <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Applicability is enforced during certification and repeated when persisted CAARs are displayed. This changes which rules may attach to a CAAR; it does not change monetary or Trust Score formulas.
            </div>
            <div className="mt-4 space-y-3">
              {ruleApplicabilityRows.map((row) => (
                <div key={row.scope} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-[var(--text)]">{row.scope}</div>
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {row.rules}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{row.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <details open className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">
              Trust Gates TG01-TG11
            </summary>
            <div className="mt-4 grid gap-3">
              {trustGates.map((item) => (
                <div key={item.gate} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                    {item.gate}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.detail}</div>
                </div>
              ))}
            </div>
          </details>

          <details open className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">
              M01 Rule Families
            </summary>
            <div className="mt-4 space-y-3">
              {m01RuleGroups.map((group) => (
                <RuleFamilyCard key={group.title} group={group} />
              ))}
            </div>
          </details>

          <details open className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">
              M02 Rule Families
            </summary>
            <div className="mt-4 space-y-3">
              {m02RuleGroups.map((group) => (
                <RuleFamilyCard key={group.title} group={group} />
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-lg font-semibold text-[var(--text)]">Canonical Registry Status</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatCard
              value={`${canonicalCoverageSummary.canonicalRuleCount}`}
              label="Canonical `R001-R198` rules"
            />
            <StatCard
              value={`${canonicalCoverageSummary.directImplementedCanonicalRuleCount}`}
              label="Direct runtime-backed canonical rules"
            />
            <StatCard
              value={`${canonicalCoverageSummary.partiallyImplementedCanonicalRuleCount}`}
              label="Grouped / partial canonical rules"
            />
            <StatCard
              value={`${canonicalCoverageSummary.registryOnlyCanonicalRuleCount}`}
              label="Registry-only canonical gaps"
            />
          </div>
          <div className="mt-4 rounded-2xl border border-[rgba(0,163,68,0.2)] bg-[rgba(0,163,68,0.05)] p-4 text-sm leading-7 text-[var(--muted)]">
            Canonical coverage and runtime citation naming are different views of the same engine. The audited registry
            reports all 198 canonical controls implemented. The runtime crosswalk below groups those controls into the
            citation families emitted by live executions; a smaller runtime-family count is not a canonical coverage gap.
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-lg font-semibold text-[var(--text)]">Section-by-Section Coverage</div>
          <div className="mt-4 space-y-3">
            {canonicalSectionCoverage.map((section) => (
              <div key={section.sectionNumber} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--text)]">
                      Section {section.sectionNumber}: {section.sectionTitle}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {section.implementedScope}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{section.notes}</div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] ${
                      section.status === "implemented"
                        ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] text-[#00A152]"
                        : section.status === "partially_implemented"
                          ? "border-[rgba(212,131,10,0.24)] bg-[rgba(212,131,10,0.08)] text-[#A96800]"
                          : "border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] text-[var(--accent)]"
                    }`}
                  >
                    {section.status.replaceAll("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {advancedEngineBlocks.map((block) => (
          <details key={block.title} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[var(--text)]">{block.title}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{block.summary}</div>
              </div>
              <span className="shrink-0 text-xs font-medium text-[var(--muted)]">Expand</span>
            </summary>
            <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--muted)]">
              {block.points.map((point) => (
                <div key={point}>- {point}</div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="text-lg font-semibold text-[var(--text)]">System-Health Rule Families</div>
        <div className="mt-4 space-y-3">
          {systemHealthRules.map((group) => (
            <RuleFamilyCard key={group.title} group={group} />
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="text-lg font-semibold text-[var(--text)]">Runtime-to-Canonical Rule Crosswalk</div>
        <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
          These rows show how the current live runtime rule families map into the canonical `R001-R198`
          architecture. Status comes from the audited canonical registry and trigger count comes from persisted
          citation history.
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[var(--border)] bg-white text-sm">
            <thead className="bg-[var(--surface)] text-left">
              <tr>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Runtime
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Module
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Current Status
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Trigger Count
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Canonical Definition
                </th>
                <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  What Current Runtime Covers
                </th>
              </tr>
            </thead>
            <tbody>
              {runtimeCrosswalkRows.map((rule) => (
                <tr key={rule.runtimeRuleId} className="align-top">
                  <td className="border-t border-[var(--border)] px-4 py-4 font-[family-name:var(--font-mono)] text-[12px] font-bold text-[var(--accent)]">
                    {rule.runtimeRuleId}
                  </td>
                  <td className="border-t border-[var(--border)] px-4 py-4 text-[var(--text)]">{rule.module}</td>
                  <td className="border-t border-[var(--border)] px-4 py-4">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] ${getRuntimeCrosswalkStatusClassName(
                        rule.status,
                      )}`}
                    >
                      {getRuntimeCrosswalkStatusLabel(rule.status)}
                    </span>
                  </td>
                  <td className="border-t border-[var(--border)] px-4 py-4 font-[family-name:var(--font-mono)] text-[12px] font-bold text-[var(--text)]">
                    {rule.triggerCount.toLocaleString()}
                  </td>
                  <td className="border-t border-[var(--border)] px-4 py-4">
                    <div className="space-y-3">
                      {rule.canonicalRuleIds.map((ruleId) => {
                        const canonical = findCanonicalRule(ruleId);
                        const clause = findCanonicalRuleClause(ruleId);
                        const usableClause = hasUsableClause(ruleId);
                        const ruleName = usableClause
                          ? clause?.ruleName ?? canonical?.ruleName ?? ruleId
                          : canonical?.ruleName ?? clause?.ruleName ?? ruleId;
                        const ifCondition = usableClause
                          ? clause?.ifCondition ?? "Not available in clause registry."
                          : "Exact IF clause is not available from the extracted clause registry for this rule.";
                        const thenAction = usableClause
                          ? clause?.thenAction ?? "Not available in clause registry."
                          : "Exact THEN action is not available from the extracted clause registry for this rule.";
                        const outputDomain = getCanonicalOutputDomain(ruleId);

                        return (
                          <div
                            key={`${rule.runtimeRuleId}:${ruleId}`}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[rgba(29,78,216,0.18)] bg-[rgba(29,78,216,0.06)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--info)]">
                                {ruleId}
                              </span>
                              <span className="text-sm font-semibold text-[var(--text)]">{ruleName}</span>
                            </div>

                            <div className="mt-3 grid gap-3">
                              <div>
                                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                                  IF Condition
                                </div>
                                <div className="mt-1 text-xs leading-6 text-[var(--muted)]">{ifCondition}</div>
                              </div>

                              <div>
                                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                                  THEN Action
                                </div>
                                <div className="mt-1 text-xs leading-6 text-[var(--muted)]">{thenAction}</div>
                              </div>

                              <div>
                                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                                  Output / Domain
                                </div>
                                <div className="mt-1 text-xs leading-6 text-[var(--muted)]">{outputDomain}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="border-t border-[var(--border)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                    {rule.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PersistenceSection() {
  return (
    <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
      <SectionHeader
        eyebrow="Persistence"
        title="What the Platform Saves"
        description="The engine is only production-safe if every governed input and certification output is persisted with traceability."
      />

      <div className="mt-6 grid gap-3">
        {persistenceRows.map((row) => (
          <div key={row.table} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              {row.table}
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{row.purpose}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CodeMapSection() {
  return (
    <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
      <SectionHeader
        eyebrow="Code & Tables"
        title="Implementation Surfaces"
        description="Primary code paths and storage surfaces that SuperAdmin should understand when auditing or extending the platform."
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          {codeMap.map((item) => (
            <div key={item.file} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--info)]">
                {item.file}
              </div>
              <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.detail}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-[rgba(29,78,216,0.18)] bg-[rgba(29,78,216,0.05)] p-5">
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--info)]">
              Current Production Scoring
            </div>
            <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--muted)]">
              <div>- Final Trust Score is derived from Trust Gates rather than a loose narrative score.</div>
              <div>- TG07 carries the selected module result in the production single-module run path; aggregate engine callers may use reviewed-fee weighting.</div>
              <div>- TG11 is the composite release gate computed from the pre-TG11 weighted gate score.</div>
              <div>- System-health penalties are applied after gate scoring.</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.04)] p-5">
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Documentation Standard Going Forward
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Any production change to uploads, governance, rules, scoring, persistence, release logic, or
              module scope should be reflected here in SuperAdmin documentation so the operational reference stays
              aligned with the live platform.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
        {eyebrow}
      </div>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] text-[var(--text)]">
        {title}
      </h2>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--muted)]">{description}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
        {value}
      </div>
      <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{label}</div>
    </div>
  );
}

function HighlightCard({
  lines,
  title,
  tone,
}: {
  lines: string[];
  title: string;
  tone: "amber" | "blue" | "green";
}) {
  const toneClasses =
    tone === "green"
      ? "border-[rgba(0,200,83,0.2)] bg-[#CFF8D1]"
      : tone === "amber"
        ? "border-[rgba(212,131,10,0.28)] bg-[#FFE8A3]"
        : "border-[rgba(29,78,216,0.24)] bg-[#BFE2FF]";

  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)] ${toneClasses}`}>
      <div className="text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
        {title}
      </div>
      <div className="mt-4 space-y-2 text-sm leading-7 text-[var(--text)]">
        {lines.map((line) => (
          <div key={line}>- {line}</div>
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  artifacts,
  moduleId,
  summary,
  title,
}: {
  artifacts: Array<{
    doc: string;
    format: string;
    purpose: string;
    source: string;
  }>;
  moduleId: "M01" | "M02" | "M03";
  summary: string;
  title: string;
}) {
  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            {moduleId}
          </div>
          <div className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">{title}</div>
          <div className="mt-3 text-sm leading-7 text-[var(--muted)]">{summary}</div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {artifacts.map((artifact) => (
          <div key={artifact.doc} className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-semibold text-[var(--text)]">
                <strong>{artifact.doc}</strong>
              </div>
              <span className="rounded-full border border-[var(--border)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {artifact.format}
              </span>
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
              <span className="font-medium text-[var(--text)]">Upstream source:</span> {artifact.source}
            </div>
            <div className="mt-1 text-sm leading-7 text-[var(--muted)]">
              <span className="font-medium text-[var(--text)]">Engine use:</span> {artifact.purpose}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleFamilyCard({ group }: { group: RuleGroup }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="text-[15px] font-semibold text-[var(--text)]">{group.title}</div>
      <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{group.detail}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {group.ids.map((id) => (
          <span
            key={id}
            className="rounded-full border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]"
          >
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}
