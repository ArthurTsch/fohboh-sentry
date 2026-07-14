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

const engineLayers = [
  {
    step: "1",
    title: "Evidence Intake",
    text:
      "Raw CSV and PDF uploads are hashed, typed, parsed, and converted into normalized upload metrics such as basisAmount, feeAmount, payoutAmount, depositAmount, transactionCount, card-brand buckets, and reconciliation values.",
    refs: [
      "src/lib/uploads/intake.ts",
      "src/lib/uploads/pdf.ts",
      "src/components/sentry/caar-engine.ts",
    ],
  },
  {
    step: "2",
    title: "Certification Gates",
    text:
      "The platform blocks certification until the location is actually certifiable: onboarding completed, governed workspace sealed, and all required module evidence present for the active location.",
    refs: [
      "src/components/sentry/SentryApp.tsx",
      "deriveLocationWorkflowState(...)",
    ],
  },
  {
    step: "3",
    title: "Module Bundle Build",
    text:
      "The run assembles module-scoped artifacts: statement, POS, agreement, bank evidence, and the sealed/manual contract-config values for the active source. Only active location vendors are included.",
    refs: [
      "src/lib/mge/engine.ts",
      "runDeterministicModuleEngine(...)",
    ],
  },
  {
    step: "4",
    title: "MQ6 Readiness Scoring",
    text:
      "Each module is scored across Data Completeness, Data Freshness, Source Authenticity, Cross-System Reconciliation, Rule Integrity, and Auditability. These become the weighted Trust Score inputs.",
    refs: [
      "src/lib/mge/engine.ts",
      "src/components/sentry/caar-engine.ts",
    ],
  },
  {
    step: "5",
    title: "Deterministic Rule Execution",
    text:
      "The MGE reconstructs expected fee behavior from contract truth, compares it to observed statement metrics, and fires module-specific rule citations with sample evidence and attributed variance.",
    refs: [
      "src/lib/mge/engine.ts",
      "M01_RULES / M02_RULES",
    ],
  },
  {
    step: "6",
    title: "CAAR Output",
    text:
      "Module findings are merged into a Trust Score, recovery amount, narrative, exhibits, status, and final CAAR record. Monthly final cadence requires ready evidence and Trust Score >= 85 for court-admissible release.",
    refs: [
      "src/components/sentry/caar-engine.ts",
      "buildCertificationResult(...)",
    ],
  },
];

const m01Inputs = [
  "POS System: restaurant-side operating system used for cross-system reconciliation",
  "Card Processing Provider: M01 source-of-truth processor workflow and schema family",
  "**Processor Statement** (CSV preferred, PDF accepted for supported machine-readable statements): processor-side transaction and fee evidence",
  "**POS Export** (CSV): restaurant-side comparison source",
  "**Signed Merchant Agreement** (PDF): legal pricing source of truth",
  "**Bank Statement** (PDF): external reconciliation deposit evidence",
  "Schema Registry: canonical field mapping for the selected processor",
  "Contract Config: markup, transaction fee, pricing model, effective date, and fee terms",
  "**Proof Zone Sample** (CSV): monthly schema verification sample for the same vendor layout",
];

const m02Inputs = [
  "DSP selection per location: DoorDash, Uber Eats, Grubhub, Slice, or other configured sources",
  "**Settlement Statement** (CSV): order-level marketplace evidence",
  "**POS Summary by Channel** (CSV): restaurant-side cross-check for marketplace totals",
  "**Signed DSP Agreement** (PDF): commission and fee term source of truth",
  "**Bank Statement** (PDF): deposit tie-out for D3 reconciliation",
  "Schema Registry: commission-base field mapping by active DSP",
  "Contract Config: commission base, rate, remittance logic, and store identity controls",
];

const m01Rules = [
  "Expected M01 fee baseline = basisAmount * (markup_bps / 10000) + transactionCount * txn_fee + monthly_fee",
  "Observed fee delta = actual processor fees - expected contractual fees",
  "Deterministic overcharge rules then allocate residual variance into rule citations such as downgrade, markup, billing, reserve, AVS, and chargeback classes",
  "Current implemented M01 rule family examples: MFR-INT-12, MFR-INT-14, MFR-INT-22, MFR-INT-23, MFR-BIL-15, MFR-MRK-03, MFR-MRK-05, MFR-VOL-08, MFR-VOL-09, MFR-BIL-16, MFR-BIL-17, MFR-CBK-04, MFR-CBK-05, MFR-RES-02, MFR-AVS-01",
];

const engineStepDetails = [
  {
    title: "Step 1: Resolve module-scoped artifacts",
    body: [
      "The engine resolves five working artifacts per active module: statement, POS, agreement, bank, and contract.",
      "For M01, `statement` means the processor statement. For M02, `statement` means the DSP settlement export.",
      "The selected active location vendor determines which module artifacts are used in the run.",
    ],
  },
  {
    title: "Step 2: Score structural readiness",
    body: [
      "Data Completeness checks whether required artifacts satisfy their structural gate.",
      "CSV artifacts must satisfy `uploaded + hash + schema + fields`.",
      "PDF agreement and bank artifacts must at minimum satisfy the upload/hash gate, with bank evidence enforced in monthly-final cadence.",
      "Manual contract artifacts must contain at least three meaningful governed fields.",
    ],
  },
  {
    title: "Step 3: Score freshness and source authenticity",
    body: [
      "Data Freshness counts uploaded artifacts that are within a 45-day freshness window from the evaluation date.",
      "Source Authenticity awards points for signed agreement evidence, POS source verification, and either bank proof or weekly preliminary source evidence depending on cadence.",
      "Monthly final runs require real bank evidence; weekly preliminary runs defer that final bank gate.",
    ],
  },
  {
    title: "Step 4: Score reconciliation and rule integrity",
    body: [
      "Cross-System Reconciliation checks POS-to-source basis tolerance, whether a contract-driven shadow fee can be computed, and whether settlement-to-bank tie-out clears tolerance.",
      "Rule Integrity is 100 only when governed contract input, statement evidence, and schema support are all present.",
      "Auditability scores upload provenance, POS/source lineage, and governed contract linkage.",
    ],
  },
  {
    title: "Step 5: Compute expected fees and recovery pool",
    body: [
      "M01 expected fees are reconstructed from contract truth: basisAmount * markup + per-transaction fee + monthly fee.",
      "M02 expected recovery is computed from contract commission rate and resolved commission base against actual settlement commission.",
      "The resulting positive delta becomes the recovery pool that Loop A rules can attribute.",
    ],
  },
  {
    title: "Step 6: Run Loop A deterministic rules",
    body: [
      "Rules are sorted by rule id and executed one-by-one against the module context.",
      "Each rule can emit a rule citation with fired count, variance amount, rule version, and sample evidence.",
      "Residual variance is reduced after each fired rule so later rules only attribute the remaining unexplained amount.",
    ],
  },
  {
    title: "Step 7: Classify findings and build CAAR output",
    body: [
      "Finding class becomes BREACH_OVERCHARGE, BREACH_UNDERCHARGE, NO_FINDING, or INCONCLUSIVE depending on rule citations and evidence completeness.",
      "The module score and MQ6 dimension scores flow into the overall Trust Score.",
      "The CAAR layer builds the narrative, findings, exhibit count, status, recovery amount, and persisted report record.",
    ],
  },
];

const mq6Details = [
  {
    name: "Data Completeness",
    weight: "10%",
    detail:
      "Required artifact gate. Score = satisfied required artifacts / total required artifacts. CSV requires uploaded+hash+schema+fields; bank is required for monthly-final cadence.",
  },
  {
    name: "Data Freshness",
    weight: "10%",
    detail:
      "Freshness gate. Score = uploaded artifacts within 45 days / all uploaded artifacts for the module.",
  },
  {
    name: "Source Authenticity",
    weight: "20%",
    detail:
      "Agreement + POS source + bank/weekly source evidence. Current scoring adds 34 for signed agreement, 33 for POS verification, and 33 for bank or cadence-appropriate source proof.",
  },
  {
    name: "Cross-System Reconciliation",
    weight: "25%",
    detail:
      "Checks POS-to-source basis tolerance, contract-driven shadow fee computability, and settlement-to-bank tie-out tolerance. This is the heaviest single CAAR dimension.",
  },
  {
    name: "Rule Integrity",
    weight: "15%",
    detail:
      "100 only when statement evidence, contract values, and schema support are present. Degrades sharply when governed inputs are incomplete.",
  },
  {
    name: "Auditability",
    weight: "20%",
    detail:
      "Scores whether upload provenance, POS/source lineage, and governed contract linkage are complete and reviewable.",
  },
];

const releaseRules = [
  "Module ready = monthly_final cadence AND module score >= release thresholds across integrity dimensions",
  "Current module-ready gate requires: overall module score >= 85, Rule Integrity = 100, Data Completeness >= 80, Source Authenticity >= 80, and Cross-System Reconciliation >= 85",
  "Overall CAAR ready = every active module is ready AND overall Trust Score >= 85",
  "Weekly preliminary runs intentionally defer the final bank tie-out and are therefore operational, not court-admissible",
];

const m01RuleExamples = [
  "Card downgrade / interchange attribution: evaluates Visa debit and Mastercard debit fee buckets against contracted rate tables (`MFR-INT-12`, `MFR-INT-14`)",
  "Markup overage detection: compares observed effective bps against contracted markup (`MFR-MRK-03`)",
  "Per-transaction fee overage: compares observed per-transaction fee against contracted txn fee (`MFR-MRK-05`)",
  "Unexplained billing delta: compares total observed fees to the full expected contractual total (`MFR-BIL-15`)",
  "Volume-tier and reserve style logic: attributes excess based on tier-model residuals and reserve behavior (`MFR-VOL-*`, `MFR-RES-02`)",
  "Chargeback / AVS style logic: attributes variance to chargeback fee patterns and service-fee pools where applicable (`MFR-CBK-*`, `MFR-AVS-01`)",
];

const m02RuleExamples = [
  "Commission overcharge detection compares actual marketplace commission to expected commission from the configured contract rate and commission base (`DSP-COM-04`, `DSP-COM-06`, `DSP-COM-07`)",
  "Commission-base mismatch rules compare settlement basis versus POS basis to detect understated or mis-mapped commission-base fields (`DSP-COM-05`)",
  "Promotion and marketing rules attribute variance from sponsored listings, promo pools, and marketing deductions (`DSP-PRM-02`, `DSP-PRM-03`)",
  "Refund and duplicate-charge rules attribute variance from refunded orders and duplicated fee events (`DSP-RFD-07`, `DSP-RFD-08`, `DSP-DUP-01`)",
  "Residual variance and delivery-fee rules attribute unexplained remaining marketplace deductions and delivery-fee pools (`DSP-VAR-11`, `DSP-DEL-04`, `DSP-DASH-02`)",
];

const scoreFormula = [
  "Trust Score = weighted average of the six MQ6 dimensions",
  "Weights: Data Completeness 10%, Data Freshness 10%, Source Authenticity 20%, Cross-System Reconciliation 25%, Rule Integrity 15%, Auditability 20%",
  "Overall CAAR dimension values are averaged across active modules, then weighted into the final Trust Score",
  "Status mapping: `Court Admissible` when ready, otherwise `Needs Remediation`; location status becomes `Certified`, `At Risk`, or `Onboarding` depending on score and readiness",
];

const caarCalculationDetails = [
  "Per-module score is computed first inside `runDeterministicModuleEngine(...)` from the weighted MQ6 dimensions.",
  "Per-module recovery value is computed next: M01 uses observed processor fees minus expected contractual fees; M02 uses actual marketplace commission minus expected commission on the resolved base.",
  "Loop A then attributes the positive recovery pool into deterministic rule citations. Each citation reduces the residual variance before the next rule executes.",
  "The final CAAR Trust Score averages each MQ6 dimension across all active modules for the location, then re-applies the same production weights.",
  "The final CAAR recovery amount is the sum of active-module recovery values after deterministic analysis.",
];

const outputBlocks = [
  "Module artifact coverage and module readiness",
  "MQ6 dimension detail with PASS / PARTIAL / FAIL badges",
  "Trust Score and overall release status",
  "Recovery value and rule citations with sample evidence",
  "Location status update: Onboarding / At Risk / Certified",
  "Persisted CAAR record for SuperAdmin review and client delivery",
];

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

  return (
    <AdminShell
      currentPath="/superadmin/engine"
      eyebrow="System Documentation"
      title="Engine"
      description="Detailed SuperAdmin reference for how inputs become deterministic certification findings and final CAAR outputs."
    >
      <div className="space-y-6">
        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.05em] text-[var(--text)]">
            FohBoh Sentry Engine Scheme
          </div>
          <div className="mt-3 max-w-4xl text-sm leading-7 text-[var(--muted)]">
            This scheme describes the actual implemented certification pipeline in the current codebase: source evidence,
            validation, governance gates, deterministic engine execution, and CAAR generation.
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <div className="rounded-[24px] border border-[rgba(214,48,49,0.18)] bg-[#FFF5C9] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)]">
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Detailed Pipeline
              </div>
              <div className="mt-4 space-y-4">
                {engineLayers.map((layer) => (
                  <details
                    key={layer.step}
                    className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white/70 p-4"
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white">
                        {layer.step}
                      </div>
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                        <div className="text-[15px] font-semibold text-[var(--text)]">{layer.title}</div>
                        <span className="shrink-0 text-xs font-medium text-[var(--muted)]">Expand</span>
                      </div>
                    </summary>
                    <div className="mt-3 pl-10">
                      <div className="text-sm leading-7 text-[var(--muted)]">{layer.text}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {layer.refs.map((ref) => (
                          <span
                            key={ref}
                            className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]"
                          >
                            {ref}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-[rgba(0,200,83,0.2)] bg-[#CFF8D1] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                  Inputs
                </div>
                <details className="mt-4 rounded-2xl border border-[rgba(0,0,0,0.1)] bg-white/65 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--success)]">
                      M01
                    </div>
                    <span className="text-xs font-medium text-[var(--muted)]">Expand</span>
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text)]">
                    {m01Inputs.map((item) => (
                      <li key={item}>
                        • <RichInputLine text={item} />
                      </li>
                    ))}
                  </ul>
                </details>
                <details className="mt-4 rounded-2xl border border-[rgba(0,0,0,0.1)] bg-white/65 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--success)]">
                      M02
                    </div>
                    <span className="text-xs font-medium text-[var(--muted)]">Expand</span>
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text)]">
                    {m02Inputs.map((item) => (
                      <li key={item}>
                        • <RichInputLine text={item} />
                      </li>
                    ))}
                  </ul>
                </details>
              </div>

              <div className="flex justify-center">
                <div className="h-10 w-px bg-[rgba(0,0,0,0.18)]" />
              </div>

              <div className="rounded-[24px] border border-[rgba(212,131,10,0.32)] bg-[#FFE8A3] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                  Engine
                </div>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--text)]">
                  <div>• upload parsing and metric extraction</div>
                  <div>• governance and evidence gating</div>
                  <div>• contract baseline reconstruction</div>
                  <div>• deterministic rule citation firing</div>
                  <div>• MQ6 dimension scoring</div>
                  <div>• Trust Score and readiness synthesis</div>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="h-10 w-px bg-[rgba(0,0,0,0.18)]" />
              </div>

              <div className="rounded-[24px] border border-[rgba(29,78,216,0.24)] bg-[#BFE2FF] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                  Output: CAAR
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--text)]">
                  {outputBlocks.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              M01 Deterministic Logic
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Merchant Fee Recovery Engine
            </h2>
            <div className="mt-4 space-y-3">
              {m01Rules.map((item, index) => (
                <div key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text)]">{index + 1}. </span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              Code Map
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Main Implementation Files
            </h2>
            <div className="mt-4 space-y-3">
              {[
                [
                  "src/lib/uploads/intake.ts",
                  "File-level intake validation, upload readiness, CSV metric extraction",
                ],
                [
                  "src/lib/uploads/pdf.ts",
                  "Machine-readable PDF extraction and processor/bank metric parsing",
                ],
                [
                  "src/lib/mge/engine.ts",
                  "Deterministic module engine, rule citations, MQ6 scoring, M01 and M02 rule logic",
                ],
                [
                  "src/components/sentry/caar-engine.ts",
                  "Certification result assembly, Trust Score weighting, CAAR record output",
                ],
                [
                  "src/components/sentry/SentryApp.tsx",
                  "Workflow gates, upload orchestration, active-source scoping, run-certification integration",
                ],
                [
                  "src/app/api/v1/certifications/run",
                  "Server-side certification persistence entry point",
                ],
                [
                  "src/app/api/v1/governance/workspaces/route.ts",
                  "Governance workspace persistence and normalized sealed workspace loading",
                ],
              ].map(([file, detail]) => (
                <div key={file} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--info)]">
                    {file}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{detail}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Step-By-Step Engine
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
            What Happens During Certification
          </h2>
          <div className="mt-5 space-y-4">
            {engineStepDetails.map((step) => (
              <div key={step.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="text-[15px] font-semibold text-[var(--text)]">{step.title}</div>
                <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--muted)]">
                  {step.body.map((line) => (
                    <div key={line}>• {line}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              MQ6 Scoring
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              How The Trust Score Is Built
            </h2>
            <div className="mt-5 space-y-3">
              {mq6Details.map((item) => (
                <div key={item.name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[15px] font-semibold text-[var(--text)]">{item.name}</div>
                    <div className="rounded-full border border-[rgba(214,48,49,0.14)] bg-[rgba(214,48,49,0.06)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {item.weight}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.detail}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-[rgba(29,78,216,0.16)] bg-[rgba(29,78,216,0.05)] p-4">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--info)]">
                Trust Score Formula
              </div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--muted)]">
                {scoreFormula.map((line) => (
                  <div key={line}>• {line}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              Release Gates
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              What Is Actually Tested
            </h2>
            <div className="mt-5 space-y-3">
              {releaseRules.map((line) => (
                <div key={line} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                  • {line}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            CAAR Math
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
            How The Final CAAR Is Calculated
          </h2>
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-[rgba(29,78,216,0.16)] bg-[rgba(29,78,216,0.05)] p-5">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--info)]">
                Production Formula
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                <div>
                  <span className="font-semibold text-[var(--text)]">Module Score</span> = weighted MQ6 average
                </div>
                <div>
                  <span className="font-semibold text-[var(--text)]">M01 Recovery</span> = max(0, actual processor
                  fees - expected contractual fees)
                </div>
                <div>
                  <span className="font-semibold text-[var(--text)]">M02 Recovery</span> = max(0, actual marketplace
                  commission - expected commission on resolved contract base)
                </div>
                <div>
                  <span className="font-semibold text-[var(--text)]">CAAR Trust Score</span> = weighted average of
                  the module-averaged MQ6 dimensions
                </div>
                <div>
                  <span className="font-semibold text-[var(--text)]">CAAR Recovery Amount</span> = sum of active-module
                  recovery values
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {caarCalculationDetails.map((line) => (
                <div
                  key={line}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]"
                >
                  - {line}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              M01 Rules
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Current Merchant Fee Rule Families
            </h2>
            <div className="mt-5 space-y-3">
              {m01RuleExamples.map((line) => (
                <div key={line} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                  • {line}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              M02 Rules
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Current Delivery Fee Rule Families
            </h2>
            <div className="mt-5 space-y-3">
              {m02RuleExamples.map((line) => (
                <div key={line} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                  • {line}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

function RichInputLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}
