import Link from "next/link";
import type { Metadata } from "next";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";

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
      "The app receives raw evidence per location and per module. CSV uploads are hashed, parsed, schema-checked, and reduced into numeric metrics. PDF uploads are hashed, text-extracted when possible, and validated for workflow readiness.",
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
      "A certification run is blocked until the location is actually certifiable for the requested module set: onboarding complete, required uploads present, active schema sealed, active contract config sealed, and module scope resolved for the location.",
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
      "The resulting CAAR includes trust score, recovery amount, findings, narrative, rule citations, cross-module and Loop B summaries, workflow state, and persistence into certification, CAAR, citation, audit, and system-health tables.",
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
      "Monthly-final deposit reconciliation evidence tying processor payouts to the actual bank deposit trail.",
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
      "Primary M02 source-of-truth settlement evidence. Parsed into basisAmount, feeAmount, payoutAmount, commission values, tax remittance, promo and marketing pools, and order-channel metrics.",
  },
  {
    doc: "POS Summary by Channel",
    format: "CSV",
    source: "Restaurant POS / operating system",
    purpose:
      "Restaurant-side channel summary used to reconcile marketplace sales and commission base against the DSP settlement source. The governed workspace now supports a sealed POS source-schema step where a representative sample export is uploaded, headers are extracted or entered manually, and the validated header set is sealed for recurring upload validation.",
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
      "Monthly-final payout reconciliation evidence tying marketplace settlement payout to actual bank deposit behavior.",
  },
];

const nonDocumentInputs = [
  "Selected active modules per location: M01, M02, or both. Certification now runs per selected module even when both are enabled.",
  "Selected active source vendors per location: for example Heartland or Toast for M01, DoorDash or Uber Eats for M02.",
  "Schema Registry mappings: exact native source columns bound to canonical engine fields.",
  "POS source schema governance: a representative POS CSV can be uploaded to extract headers, corrected manually, validated, and sealed as the recurring Upload Data expectation.",
  "Contract Config values: governed legal terms used by the deterministic engine.",
  "Location ownership, team access, and certification scope resolution.",
];

const workflowCards = [
  {
    title: "Upload Data",
    items: [
      "Evidence is location-specific and module-specific.",
      "Only the active source vendors for that location should appear.",
      "CSV readiness requires all four structural gates: upload, hash, schema, and fields.",
      "PDF readiness requires upload and hash, plus parser-derived usability where the workflow needs text-based validation.",
      "Saved uploads are persisted and replace the previous artifact for the same document slot when re-uploaded.",
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
      "For M02 it includes commission rates, commission base, and marketplace remittance logic.",
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
      "Module coverage and certification package completeness. Penalizes locations where configured active modules do not all produce a governed certification package.",
  },
  {
    gate: "TG02",
    detail: "Freshness and timing confidence across the active certification package.",
  },
  {
    gate: "TG03",
    detail: "Authenticity and documentary trust of the evidence package.",
  },
  {
    gate: "TG04",
    detail: "Governed structural integrity of the certification package.",
  },
  {
    gate: "TG05",
    detail: "Contract and source coherence within the current certification context.",
  },
  {
    gate: "TG06",
    detail: "Governed schema and field-binding readiness.",
  },
  {
    gate: "TG07",
    detail:
      "Fee legitimacy and reconciliation gate. In multi-module runs it is weighted by reviewed fee volume across active modules.",
  },
  {
    gate: "TG08",
    detail: "Formula and contract integrity gate for the active certified period.",
  },
  {
    gate: "TG09",
    detail: "Audit-lineage completeness across uploads, governance, certification, and persistence.",
  },
  {
    gate: "TG10",
    detail: "Narrative and certifiable output readiness based on governed evidence quality.",
  },
  {
    gate: "TG11",
    detail:
      "Composite CAAR eligibility gate. Current implementation converts the pre-TG11 weighted gate score into a final PASS / FAIL release gate.",
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
      "Compares actual marketplace commission against expected commission on the resolved governed contract base and rate model.",
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
    summary: "Location-wide aggregation across active modules.",
    points: [
      "Weights reviewed fee volume across active modules.",
      "Tests module-weight imbalance and recovery-direction conflict.",
      "Builds aggregate recovery and cross-module narrative used by the final CAAR.",
      "Feeds workflow/manual-review decisions when modules disagree or are structurally imbalanced.",
    ],
  },
  {
    title: "System Health",
    summary: "Operational integrity of the certification package itself.",
    points: [
      "Persists SYS-layer events R186-R198 around hash integrity, rule-set alignment, formula integrity, audit lineage, clock integrity, and chain completeness.",
      "Fail-state health flags can reduce final trust score via penalty points.",
      "`MASTER_SYSTEM_HEALTHY` is required for clean final readiness.",
      "These events are separate from M01/M02 fee rules and protect the certifiability of the overall platform output.",
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
  "Only monthly final can become fully release-ready and court-admissible.",
  "Per-module readiness currently requires score >= 85 plus strong completeness, authenticity, reconciliation, and rule-integrity conditions.",
  "Overall CAAR readiness requires every active requested module to be ready, overall trust score >= 85, and healthy system-health state.",
  "If both modules are enabled, they can still be run separately. The app should only evaluate the requested enabled modules for that certification cycle.",
];

const persistenceRows = [
  {
    table: "uploads_v2",
    purpose:
      "Stores persisted artifact uploads, vendor scope, validation summary, hash, extracted text state, and supersession chain.",
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
    table: "caar_reports",
    purpose:
      "Stores the business-facing CAAR summary record used by the app and management views.",
  },
  {
    table: "caar_artifacts_v2",
    purpose:
      "Stores canonical CAAR payload blocks such as trust gates, workflow, system health, loop summaries, and recovery detail.",
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
    file: "src/lib/mge/engine.ts",
    detail: "Deterministic module engine, M01/M02 rule registry, MQ6 scoring, Trust Gates, system health, and readiness logic.",
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
              </p>
            </div>

            <div className="grid min-w-[300px] gap-3 sm:grid-cols-2">
              <StatCard value="M01 + M02" label="Active certification modules" />
              <StatCard value="TG01-TG11" label="Composite trust-gate framework" />
              <StatCard value="R186-R198" label="System-health rule family" />
              <StatCard value="Loop A + Loop B" label="Current implemented certification layers" />
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
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
        {activeSectionId === "engine" ? <DeterministicEngineSection /> : null}
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

function DeterministicEngineSection() {
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
              <div>- TG07 is special because multi-module runs weight it by reviewed fee volume.</div>
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
  moduleId: "M01" | "M02";
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
