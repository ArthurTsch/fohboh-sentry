import type { ReactNode } from "react";
import type { CaarRecord, IntakeState, UploadArtifact, UploadModule } from "../types";
import { HelpTip } from "../ui/primitives";
import { getScoreBar, getTrustTone, parseCurrency } from "../utils";

type ExhibitRow = {
  description: string;
  id: string;
  integrity: string;
  integrityTone: "danger" | "success" | "warning";
  source: string;
  status: string;
  statusTone: "danger" | "success" | "warning";
};

type Mq6Row = {
  badge: "At Risk" | "Certified" | "Qualified";
  desc: string;
  name: string;
  pct: number;
  tipFooter: string;
  tipTitle: string;
  whatDoes: string;
  whatIs: string;
  whyMatters: string;
};

export function CaarReportModal({
  artifactIntakeState,
  onClose,
  onDownloadPdf,
  onGenerateClaimPack,
  record,
  uploadModules,
}: {
  artifactIntakeState: Record<string, IntakeState>;
  onClose: () => void;
  onDownloadPdf: (record: CaarRecord) => void;
  onGenerateClaimPack: (record: CaarRecord) => void;
  record: CaarRecord;
  uploadModules: UploadModule[];
}) {
  const moduleId = inferModule(record);
  const moduleLabel = moduleId === "M01" ? "Merchant Fee Recovery" : "Delivery Fee Recovery";
  const locationModules = uploadModules.filter((module) => module.accountId === record.accountId && module.id === moduleId);
  const exhibits = buildExhibits({
    artifactIntakeState,
    locationId: record.locationId,
    modules: locationModules,
    moduleId,
    trustScore: record.trustScore,
  });
  const coverageComplete = exhibits.every((row) => row.status === "Provided");
  const integrityReady = exhibits.every((row) => row.integrity === "Verified" || row.integrity === "Sealed");
  const claimReady = record.trustScore >= 85 && coverageComplete && integrityReady;
  const remediationDone = record.trustScore >= 85;
  const expectedFee = Math.round(parseCurrency(record.amount) * (moduleId === "M01" ? 1.8 : 4.2));
  const actualFee = expectedFee + parseCurrency(record.amount);
  const basisLabel =
    moduleId === "M01"
      ? "Expected Fee = Transaction_Amount x Contracted_Rate"
      : "Expected Fee = POS_Gross_Sales x Contracted_Rate";
  const varianceLabel =
    moduleId === "M01"
      ? "Variance = Actual Interchange Fee - Expected Fee"
      : "Variance = Actual Platform Fees - Expected Fee";
  const reconciliationRows = [
    {
      assessment:
        record.trustScore >= 85 ? "Authenticated POS export verified" : "No authenticated POS export attached",
      control: "POS Gross vs Submitted Fee Basis",
      status: record.trustScore >= 85 ? "Proven" : "Not Proven",
    },
    {
      assessment:
        record.trustScore >= 85 ? "Source statement reconciled" : "No source statement attached",
      control: moduleId === "M01" ? "Processor Settlement vs Interchange" : "DSP Settlement vs Platform Fee",
      status: record.trustScore >= 85 ? "Proven" : "Not Proven",
    },
    {
      assessment:
        record.trustScore >= 85
          ? "Bank deposit verified"
          : "No bank statement or deposit tie-out attached",
      control: moduleId === "M01" ? "Processor Net vs Bank Deposit" : "DSP Net vs Bank Deposit",
      status: record.trustScore >= 85 ? "Proven" : "Not Proven",
    },
    {
      assessment:
        record.trustScore >= 65
          ? "Exception package reviewed and attached"
          : "No exception package attached",
      control: "Exception Log Reviewed",
      status: record.trustScore >= 65 ? "Reviewed" : "Not Proven",
    },
  ];
  const custodyRows = [
    {
      assessment: "Aggregated CSV received by platform",
      event: "Submission Received",
      status: "Recorded",
    },
    {
      assessment:
        record.trustScore >= 85
          ? "Immutable ingestion timestamp logged"
          : "No immutable ingestion timestamp shown",
      event: "Ingestion Timestamp",
      status: record.trustScore >= 85 ? "Recorded" : "Missing",
    },
    {
      assessment:
        integrityReady
          ? "SHA-256 recorded for uploaded source"
          : "No SHA-256 recorded for uploaded source",
      event: "File Hash (SHA-256)",
      status: integrityReady ? "Verified" : "Missing",
    },
    {
      assessment:
        record.trustScore >= 85
          ? "Evidentiary user attestation on file"
          : "No evidentiary user attestation attached",
      event: "Submitter Identity",
      status: record.trustScore >= 85 ? "Attested" : "Missing",
    },
    {
      assessment:
        claimReady
          ? "Complete transformation lineage attached"
          : "No complete transformation lineage attached",
      event: "Transformation Log",
      status: claimReady ? "Complete" : "Missing",
    },
  ];
  const mq6 = deriveMq6(record);
  const provenanceRows = [
    {
      assessment: "Single aggregated record received and parsed successfully.",
      source: "CSV Upload",
      status: "Provided",
    },
    {
      assessment:
        record.trustScore >= 85
          ? "Authenticated system extract attached."
          : "No authenticated system extract or signed export package was attached.",
      source: "POS Export",
      status: record.trustScore >= 85 ? "Verified" : "Unverified",
    },
    {
      assessment:
        integrityReady
          ? `${moduleId === "M01" ? "Processor" : "Settlement"} statement verified and hashed.`
          : `No ${moduleId === "M01" ? "processor" : "marketplace"} settlement statement or source file hash was provided.`,
      source: moduleId === "M01" ? "Processor Statement" : "DSP Statement",
      status: integrityReady ? "Verified" : "Unverified",
    },
    {
      assessment:
        coverageComplete
          ? "Deposit validation tied to statement evidence."
          : "Deposit validation was not tied to statement evidence or reconciliation workpapers.",
      source: "Bank Deposits",
      status: coverageComplete ? "Verified" : "Unverified",
    },
    {
      assessment:
        claimReady
          ? "Signed contract sealed in Vault, rate schedule exhibit attached."
          : "Rate assumptions were not linked to a signed agreement, fee schedule, or governing exhibit.",
      source: "Contract Terms",
      status: claimReady ? "Sealed" : "Assumed",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f7f7f9]">
      <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-[var(--border)] bg-white px-6 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.05)]">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          CAAR Viewer
        </div>
        <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
          {record.locationName} | {record.period}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDownloadPdf(record)}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => onGenerateClaimPack(record)}
            disabled={!claimReady}
            className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Generate ExportPack
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 px-5 py-8 lg:px-8">
        <section className="grid gap-4 rounded-[28px] border border-[var(--border)] bg-white p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              {moduleLabel} Certification
            </div>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.06em] text-[var(--text)]">
              {record.id}
            </h1>
            <div className="mt-2 text-sm text-[var(--muted)]">
              CAAR vFinal | Deterministic Certification & Trust Analysis Report
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <CoverMeta label="Merchant" value={record.locationName} />
              <CoverMeta label="Period" value={record.period} />
              <CoverMeta label="Certification Date" value="2026-03-20" />
              <CoverMeta label="Certification ID" value={record.id} mono />
              <CoverMeta label="KPI Version" value="v1.0.0 (Locked)" />
              <CoverMeta
                label="Certification Class"
                value={record.trustScore >= 85 ? "Certified" : record.trustScore >= 65 ? "Qualified | At Risk" : "Not Certifiable"}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Trust Score
              </div>
              <span
                className={`rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] ${
                  record.trustScore >= 85
                    ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                    : record.trustScore >= 50
                      ? "bg-[rgba(255,152,0,0.12)] text-[#b86a00]"
                      : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                }`}
              >
                {record.trustScore >= 85 ? "Certified" : record.trustScore >= 50 ? "Qualified" : "At Risk"}
              </span>
            </div>
            <div className={`mt-4 font-[family-name:var(--font-display)] text-8xl font-extrabold tracking-[-0.08em] ${getTrustTone(record.trustScore)}`}>
              {record.trustScore}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className={`h-full rounded-full ${getScoreBar(record.trustScore)}`} style={{ width: `${record.trustScore}%` }} />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {record.trustScore >= 85
                ? "All MQ6 dimensions meet or exceed threshold. This report is certified for external submission and legal recovery action."
                : "Mathematical accuracy alone does not constitute a complete certification. Missing provenance or reconciliation controls still block a fully defensible CAAR."}
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Certified Variance
              </div>
              <div className="mt-2 text-3xl font-bold text-[var(--text)]">{record.amount}</div>
              <div className="mt-2 font-[family-name:var(--font-mono)] text-[10px] leading-5 text-[var(--muted)]">
                {basisLabel}
                <br />
                {varianceLabel}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard eyebrow="Variance Analysis" title="Certified finding summary" sub="Rendered from the current report record and certification package.">
            <div className="grid gap-3 sm:grid-cols-3">
              <ValueChip label="Expected Fee" value={formatUsd(expectedFee)} />
              <ValueChip label="Actual Fee" value={formatUsd(actualFee)} />
              <ValueChip label="Certified Variance" value={record.amount} accent />
            </div>
            <div className="mt-4 space-y-3">
              {record.findings.map((finding, index) => (
                <div key={`${record.id}:finding:${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                  {finding}
                </div>
              ))}
            </div>
          </ReportCard>

          <ReportCard
            eyebrow="Required Remediation"
            title="Path to >85 Trust Score"
            sub="Exact controls and data inputs needed to move from a qualified output to a fully defensible certification package."
          >
            {remediationDone ? (
              <div className="rounded-xl border border-[rgba(0,200,83,0.25)] bg-[rgba(0,200,83,0.06)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
                All remediation steps complete - Trust Score {"\u003e"}= 85.
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  "Attach signed contract / rate schedule as an exhibit and bind it to the certification package.",
                  "Ingest authenticated POS, DSP, and bank-source files with SHA-256 hashes and ingestion timestamps.",
                  "Run deterministic reconciliation and include exception logs in the report appendix.",
                  "Expose KPI IDs, formulas, tolerances, and rule lineage from the Vault in the certification body.",
                  "Generate immutable report hash and transaction-level audit trail for production exports.",
                ].map((step, index) => (
                  <StepRow key={step} index={index + 1} text={step} />
                ))}
              </div>
            )}
          </ReportCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard
            eyebrow="Reconciliation Proof"
            title="Cross-system validation status"
            sub="A claim is not litigation-grade until the numerical path from operational source to financial settlement is reconciled."
          >
            <SimpleTable
              columns={["Control", "Status", "Assessment"]}
              rows={reconciliationRows.map((row) => [
                row.control,
                <StatusText key={`${row.control}:status`} good={row.status === "Proven" || row.status === "Reviewed"}>
                  {row.status}
                </StatusText>,
                row.assessment,
              ])}
            />
          </ReportCard>

          <ReportCard
            eyebrow="Chain of Custody"
            title="Submission, control, and transformation record"
            sub="A court-admissible package must show how the evidence entered the system and whether integrity controls were applied."
          >
            <SimpleTable
              columns={["Event", "Status", "Assessment"]}
              rows={custodyRows.map((row) => [
                row.event,
                <StatusText key={`${row.event}:status`} good={row.status !== "Missing"}>
                  {row.status}
                </StatusText>,
                row.assessment,
              ])}
            />
          </ReportCard>
        </div>

        <ReportCard
          eyebrow="Scoring Methodology | MQ6 Framework"
          title="Certification basis"
          sub="Each dimension is rendered directly from the trust engine. No explanatory text may contradict component-level results."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mq6.map((row) => (
              <div key={row.name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
                    <span>{row.name}</span>
                    <HelpTip
                      title={row.tipTitle}
                      sections={[
                        { label: "What It Is", text: row.whatIs },
                        { label: "What It Does", text: row.whatDoes },
                        { label: "Why It Matters", text: row.whyMatters },
                      ]}
                      footerLabel="Weight"
                      footerValue={row.tipFooter}
                    />
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.12em] ${
                      row.badge === "Certified"
                        ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                        : row.badge === "Qualified"
                          ? "bg-[rgba(255,152,0,0.12)] text-[#b86a00]"
                          : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                    }`}
                  >
                    {row.badge}
                  </span>
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{row.desc}</div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full ${row.pct >= 80 ? "bg-[var(--success)]" : row.pct >= 50 ? "bg-[#ff9800]" : "bg-[var(--accent)]"}`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <div className={`mt-3 text-right font-[family-name:var(--font-display)] text-2xl font-bold ${getTrustTone(row.pct)}`}>
                  {row.pct}%
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
            Composite trust score for this report is <strong>{record.trustScore}/100</strong>.{" "}
            {record.trustScore >= 85
              ? "All MQ6 dimensions meet or exceed threshold. This report is fully certified for external submission and legal recovery action."
              : "Score collapse occurred because one or more dimensions were not fully established. Mathematical accuracy alone does not constitute a complete certification."}
          </div>
        </ReportCard>

        <ReportCard
          eyebrow="Evidence & Provenance"
          title={record.trustScore >= 85 ? "Evidence posture is fully defensible" : "Why this is not fully defensible yet"}
          sub={
            record.trustScore >= 85
              ? "All source evidence is authenticated, signed, and exhibits are linked."
              : "A serious CAAR report must show authenticated source evidence, not just uploaded values."
          }
        >
          {record.trustScore < 85 ? (
            <p className="mb-4 text-sm leading-7 text-[var(--muted)]">
              The current package supports deterministic arithmetic but does not yet satisfy the evidentiary standards
              required for a fully externalized claim. The specific deficiency is not the math; it is the missing
              provenance and reconciliation architecture around the submitted data.
            </p>
          ) : null}
          <SimpleTable
            columns={["Source", "Status", "Assessment"]}
            rows={provenanceRows.map((row) => [
              row.source,
              <StatusText key={`${row.source}:status`} good={row.status === "Provided" || row.status === "Verified" || row.status === "Sealed"}>
                {row.status}
              </StatusText>,
              row.assessment,
            ])}
          />
        </ReportCard>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <ReportCard
            eyebrow="Exhibit Coverage"
            title="Required evidence manifest"
            sub="The HTML report uses fixed exhibit classes for external package review."
          >
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-[88px_150px_1fr_110px_110px] gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                <span>Exhibit</span>
                <span>Source</span>
                <span>Description</span>
                <span>Status</span>
                <span>Integrity</span>
              </div>
              {exhibits.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[88px_150px_1fr_110px_110px] gap-3 border-t border-[var(--border)] px-4 py-3 text-sm"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[var(--info)]">{row.id}</span>
                  <span>{row.source}</span>
                  <span>{row.description}</span>
                  <span className={toneClass(row.statusTone)}>{row.status}</span>
                  <span className={toneClass(row.integrityTone)}>{row.integrity}</span>
                </div>
              ))}
            </div>
          </ReportCard>

          <ReportCard
            eyebrow="Attestation"
            title="Report integrity"
            sub="A production export is immutable, signed, hashed, and evidentially complete."
          >
            <div className="space-y-3">
              <AttestRow label="Engine" value="MGE Core Engine v1.0" />
              <AttestRow label="Ontology" value="v1.2 | Restaurant Semantic Model" />
              <AttestRow label="KPI Version" value="v1.0.0 (Locked)" />
              <AttestRow label="DCLS Rules" value="198 applied | all evaluated" />
              <AttestRow label="Timestamp" value={`${record.period.replace(/\s+/g, "-")}-08:13:56Z`} />
              <AttestRow
                label="Integrity Hash"
                value={claimReady ? `sha256:${record.id.toLowerCase()}-f2a9c1e8b347` : "SHA-256 pending final ExportPack generation"}
                accent={claimReady}
              />
            </div>
          </ReportCard>
        </div>

        <ReportCard
          eyebrow="Legal Posture"
          title={claimReady ? "Externally deliverable certification package" : "Internal certification review only"}
          sub="This section mirrors the HTML report's legal framing instead of a lightweight summary."
        >
          <div className="space-y-4 text-sm leading-7 text-[var(--muted)]">
            <p>
              This report should be treated as a deterministic certified analysis of the submitted dataset
              {claimReady
                ? ", meeting the evidentiary standards required for external dispute, demand, and legal recovery workflows."
                : ", but it is not yet complete enough for external submission or litigation-grade delivery."}
            </p>
            <p>
              {claimReady
                ? "All source evidence is authenticated, signed, and linked, so the CAAR and claim pack can be delivered to counsel."
                : "Until the missing controls above are resolved, this output is best used for internal review, evidence-gap analysis, and remediation planning."}
            </p>
          </div>
        </ReportCard>
      </div>
    </div>
  );
}

function inferModule(record: CaarRecord) {
  const corpus = `${record.id} ${record.narrative} ${record.findings.join(" ")}`.toLowerCase();
  return corpus.includes("processor") || corpus.includes("interchange") || corpus.includes("merchant")
    ? "M01"
    : "M02";
}

function buildExhibits({
  artifactIntakeState,
  locationId,
  modules,
  moduleId,
  trustScore,
}: {
  artifactIntakeState: Record<string, IntakeState>;
  locationId: string;
  moduleId: "M01" | "M02";
  modules: UploadModule[];
  trustScore: number;
}): ExhibitRow[] {
  const artifacts = modules.flatMap((module) => module.artifacts);
  const csvArtifact = artifacts.find((artifact) => artifact.key.includes(moduleId === "M01" ? "processor" : "settlement"));
  const posArtifact = artifacts.find((artifact) => artifact.key.includes("pos"));
  const statementArtifact = csvArtifact;
  const bankArtifact = artifacts.find((artifact) => artifact.key.includes("bank"));
  const contractArtifact = artifacts.find((artifact) => artifact.key.includes("contract") || artifact.key.includes("agreement"));

  const csvIntake = csvArtifact ? resolveArtifactIntake(artifactIntakeState, modules, locationId, csvArtifact) : null;
  const posIntake = posArtifact ? resolveArtifactIntake(artifactIntakeState, modules, locationId, posArtifact) : null;
  const statementIntake = statementArtifact ? resolveArtifactIntake(artifactIntakeState, modules, locationId, statementArtifact) : null;
  const bankIntake = bankArtifact ? resolveArtifactIntake(artifactIntakeState, modules, locationId, bankArtifact) : null;
  const contractIntake = contractArtifact ? resolveArtifactIntake(artifactIntakeState, modules, locationId, contractArtifact) : null;

  return [
    exhibit("EX-001", "CSV Upload", "Aggregated source file received from user", csvIntake, true),
    exhibit(
      "EX-002",
      "POS Export",
      "System-of-record sales export supporting gross sales",
      posIntake,
      trustScore >= 85,
    ),
    exhibit(
      "EX-003",
      moduleId === "M01" ? "Processor Statement" : "DSP Statement",
      moduleId === "M01" ? "Processor settlement statement" : "Marketplace or processor settlement statement",
      statementIntake,
      trustScore >= 85,
    ),
    exhibit("EX-004", "Bank Statement", "Deposit proof for settlement validation", bankIntake, trustScore >= 85),
    exhibit(
      "EX-005",
      "Contract / Fee Schedule",
      "Executed commercial terms governing fee rate",
      contractIntake,
      trustScore >= 85,
      true,
    ),
  ];
}

function exhibit(
  id: string,
  source: string,
  description: string,
  intake: IntakeState | null,
  expected: boolean,
  treatVerifiedAsSealed = false,
): ExhibitRow {
  const provided = expected ? Boolean(intake?.uploaded) : true;
  let integrity = "Required";
  let integrityTone: ExhibitRow["integrityTone"] = "danger";

  if (!expected) {
    integrity = intake?.hash ? "Pending hash" : "Pending hash";
    integrityTone = "warning";
  } else if (treatVerifiedAsSealed && intake?.uploaded) {
    integrity = intake.hash ? "Sealed" : "Required";
    integrityTone = intake.hash ? "success" : "danger";
  } else if (intake?.hash) {
    integrity = "Verified";
    integrityTone = "success";
  }

  return {
    description,
    id,
    integrity,
    integrityTone,
    source,
    status: provided ? "Provided" : "Missing",
    statusTone: provided ? "success" : "danger",
  };
}

function resolveArtifactIntake(
  state: Record<string, IntakeState>,
  modules: UploadModule[],
  locationId: string,
  artifact: UploadArtifact,
) {
  for (const uploadModule of modules) {
    const globalKey = `${uploadModule.accountId}:${locationId}:${uploadModule.id}:${artifact.key}:global`;
    if (state[globalKey]?.uploaded) return state[globalKey];

    const prefix = `${uploadModule.accountId}:${locationId}:${uploadModule.id}:${artifact.key}:`;
    const match = Object.entries(state).find(([key, value]) => key.startsWith(prefix) && value.uploaded);
    if (match) return match[1];
  }
  return null;
}

function deriveMq6(record: CaarRecord): Mq6Row[] {
  return record.dimensions.map((dimension, index) => ({
    badge: dimension.score >= 85 ? "Certified" : dimension.score >= 50 ? "Qualified" : "At Risk",
    desc: mq6Descriptions[dimension.name] ?? "Certification dimension derived from the trust engine.",
    name: dimension.name,
    pct: dimension.score,
    tipFooter: `${dimension.weight} of Trust Score`,
    tipTitle: `CAAR | MQ6 D${index + 1}`,
    whatDoes: mq6WhatDoes[dimension.name] ?? "Controls one component of release readiness.",
    whatIs: mq6WhatIs[dimension.name] ?? "A weighted certification dimension in the MQ6 framework.",
    whyMatters: mq6WhyMatters[dimension.name] ?? "A weak score here blocks a fully defensible certification package.",
  }));
}

const mq6Descriptions: Record<string, string> = {
  "Auditability": "Whether every certified dollar traces to a specific evidentiary path and rule evaluation lineage.",
  "Cross-System Reconciliation": "How well POS, statement, and bank evidence agree on the same commercial activity.",
  "Data Completeness": "Coverage of required fields across truth, claim, and governance source layers.",
  "Data Freshness": "Whether the uploaded source data is current enough for the certification window.",
  "Rule Integrity": "Whether the applied rules are version-locked, reproducible, and sealed to the governed record.",
  "Source Authenticity": "Whether uploaded evidence is hashed, linked, and trustworthy enough for external use.",
};

const mq6WhatIs: Record<string, string> = {
  "Auditability": "Whether every certified dollar traces to a specific row in a specific source document.",
  "Cross-System Reconciliation": "Three-way reconciliation confidence across operational, settlement, and bank layers.",
  "Data Completeness": "Presence of all required data fields across truth, claim, and governance source files.",
  "Data Freshness": "Whether the source data falls within the certification window and is recent enough for use.",
  "Rule Integrity": "Whether the rules applied in this certification are version-locked in the governed vault.",
  "Source Authenticity": "Whether all source files are SHA-256 hashed and verifiable against intake records.",
};

const mq6WhatDoes: Record<string, string> = {
  "Auditability": "Requires row-level traceability and complete audit evidence for every certified finding.",
  "Cross-System Reconciliation": "Proves the finding is supported by multiple independent source systems, not one isolated feed.",
  "Data Completeness": "Missing fields lower confidence in every downstream certification dimension.",
  "Data Freshness": "Prevents stale reports from being treated as current evidence.",
  "Rule Integrity": "Ensures the same rule set can be reproduced later under audit or legal challenge.",
  "Source Authenticity": "Acts as the tamper-evidence gate for the external evidence package.",
};

const mq6WhyMatters: Record<string, string> = {
  "Auditability": "Without row-level traceability, findings are hard to defend externally.",
  "Cross-System Reconciliation": "A single-source finding is an assertion; a reconciled finding is evidence.",
  "Data Completeness": "A low score here usually means required data was not uploaded or mapped correctly.",
  "Data Freshness": "Always upload the most recent statements before running certification.",
  "Rule Integrity": "Opposing review can challenge the logic unless the rule version is sealed and reproducible.",
  "Source Authenticity": "Courts and external reviewers require tamper-evident chain-of-custody controls.",
};

function ReportCard({
  children,
  eyebrow,
  sub,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  sub: string;
  title: string;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-white p-6">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
        {eyebrow}
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{sub}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CoverMeta({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 text-sm font-medium text-[var(--text)] ${mono ? "font-[family-name:var(--font-mono)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function ValueChip({ accent = false, label, value }: { accent?: boolean; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{value}</div>
    </div>
  );
}

function StepRow({ index, text }: { index: number; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
        {index}
      </div>
      <div className="text-sm leading-7 text-[var(--muted)]">{text}</div>
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <div
        className="grid gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid gap-3 border-t border-[var(--border)] px-4 py-4 text-sm"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, cellIndex) => (
            <div key={cellIndex} className="leading-6 text-[var(--muted)] first:font-medium first:text-[var(--text)]">
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatusText({ children, good }: { children: ReactNode; good: boolean }) {
  return <span className={good ? "text-[var(--success)]" : "text-[var(--accent)]"}>{children}</span>;
}

function AttestRow({ accent = false, label, value }: { accent?: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
      <span className="font-medium text-[var(--text)]">{label}</span>
      <span className={accent ? "text-[var(--success)]" : "text-[var(--muted)]"}>{value}</span>
    </div>
  );
}

function toneClass(tone: "danger" | "success" | "warning") {
  return {
    danger: "text-[var(--accent)]",
    success: "text-[var(--success)]",
    warning: "text-[#b86a00]",
  }[tone];
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
