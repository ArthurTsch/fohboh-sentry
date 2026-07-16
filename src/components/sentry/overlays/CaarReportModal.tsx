import type { ReactNode } from "react";
import type {
  CaarEvidenceTrace,
  CaarProvenanceKind,
  CaarRecord,
  IntakeState,
  UploadArtifact,
  UploadModule,
} from "../types";
import { HelpTip } from "../ui/primitives";
import { getScoreBar, getTrustTone } from "../utils";

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
  const traceability = record.traceability;
  const moduleId = traceability?.module ?? inferModule(record);
  const moduleLabel = moduleId === "M01" ? "Merchant Fee Recovery" : "Delivery Fee Recovery";
  const locationModules = uploadModules.filter((module) => module.accountId === record.accountId && module.id === moduleId);
  const exhibits = buildExhibits({
    artifactIntakeState,
    evidence: traceability?.evidence ?? [],
    locationId: record.locationId,
    modules: locationModules,
    moduleId,
  });
  const coverageComplete = exhibits.every((row) => row.status === "Provided");
  const integrityReady = exhibits.every((row) => row.integrity === "Verified" || row.integrity === "Sealed");
  const claimReady = traceability?.courtAdmissible ?? record.status === "Court Admissible";
  const remediationDone = claimReady;
  const evidenceRows = traceability?.evidence ?? [];
  const fieldAudit = traceability?.fieldAudit ?? [];
  const ruleCitations = traceability?.ruleCitations ?? [];
  const ruleSetVersion = traceability?.ruleSetVersion ?? null;
  const certificationDate = traceability?.sealedAt ?? traceability?.certCompletedAt ?? "Not persisted";
  const unsupportedFieldAudit = fieldAudit.filter((row) => !row.supported);
  const missingEvidence = evidenceRows.filter((row) => row.status === "missing");
  const reviewEvidence = evidenceRows.filter((row) => row.status === "review");
  const remediationSteps = [
    ...missingEvidence.map((row) => `Upload ${row.label} and persist it for this ${moduleId} certification package.`),
    ...reviewEvidence.map((row) => `Resolve review blockers on ${row.label} before treating it as governed evidence.`),
    ...unsupportedFieldAudit.map((row) => `Backfill ${row.field} from a persisted upload, sealed config, or stored engine output.`),
  ];
  const lowDimensions = record.dimensions.filter((dimension) => dimension.score < 85);
  const effectiveRemediationSteps =
    remediationSteps.length > 0
      ? remediationSteps
      : !claimReady
        ? [
            lowDimensions.length > 0
              ? `Trust Score remains below release because these MQ6 dimensions are still under the final gate: ${lowDimensions
                  .map((dimension) => `${dimension.name} (${dimension.score})`)
                  .join(", ")}.`
              : "All displayed fields are backed, but the persisted certification run is still not marked court-admissible.",
            ruleCitations.length > 0
              ? `The remaining blocker comes from stored rule-engine findings. Review ${ruleCitations.length} persisted rule citation${ruleCitations.length === 1 ? "" : "s"} below and resolve the failing control path.`
              : "The run does not expose enough persisted rule-citation detail yet to explain the final release block precisely.",
          ]
        : [];
  const provenanceRows = fieldAudit.map((row) => ({
    assessment: row.trace,
    field: row.field,
    provenance: row.provenance,
    status: row.supported ? "Supported" : "Flagged",
    value: row.value,
  }));
  const evidenceTraceRows = evidenceRows.map((row) => ({
    assessment: buildEvidenceAssessment(row),
    source: row.label,
    status: row.status === "provided" ? "Provided" : row.status === "review" ? "Needs Review" : "Missing",
    trace: row.trace,
  }));
  const custodyRows = evidenceRows.map((row) => ({
    assessment: row.sha256
      ? `SHA-256 recorded${row.uploadedAt ? ` on ${formatDateLabel(row.uploadedAt)}` : ""}.`
      : "No immutable hash is persisted for this source.",
    event: row.label,
    status: row.sha256 ? "Hashed" : "Missing",
  }));
  const mq6 = deriveMq6(record);

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
              <CoverMeta label="Certification Date" value={certificationDate} />
              <CoverMeta label="Certification ID" value={record.id} mono />
              <CoverMeta label="Rule Set Version" value={ruleSetVersion ?? "Not persisted"} />
              <CoverMeta
                label="Certification Class"
                value={claimReady ? "Court Admissible" : reviewEvidence.length > 0 ? "Needs Review" : "Needs Remediation"}
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
              {claimReady
                ? "This CAAR is backed by persisted uploads, sealed governance records, and stored rule-engine outputs."
                : "This CAAR is not yet fully supported by persisted evidence or sealed governance records for every required field."}
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Traceability Summary
              </div>
              <div className="mt-2 text-3xl font-bold text-[var(--text)]">{record.amount}</div>
              <div className="mt-2 font-[family-name:var(--font-mono)] text-[10px] leading-5 text-[var(--muted)]">
                {evidenceRows.filter((row) => row.status === "provided").length} direct-upload artifacts supported
                <br />
                {fieldAudit.filter((row) => row.supported).length}/{fieldAudit.length || 1} displayed CAAR fields fully backed
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard eyebrow="Certification Output" title="Persisted result summary" sub="Only persisted engine outputs are shown here. Synthetic fee calculations were removed.">
            <div className="grid gap-3 sm:grid-cols-3">
              <ValueChip label="Module" value={moduleId} />
              <ValueChip label="Rule Citations" value={String(ruleCitations.length)} />
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
            eyebrow="Hardening Review"
            title="What still needs backing"
            sub="Anything not directly backed by uploads, sealed governance, or stored engine state is flagged here."
          >
            {remediationDone ? (
              <div className="rounded-xl border border-[rgba(0,200,83,0.25)] bg-[rgba(0,200,83,0.06)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
                All displayed CAAR conclusions are backed by persisted evidence, sealed config, or stored rule outputs.
              </div>
            ) : (
              <div className="space-y-3">
                {effectiveRemediationSteps.map((step, index) => (
                  <StepRow key={step} index={index + 1} text={step} />
                ))}
              </div>
            )}
          </ReportCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard
            eyebrow="Field Audit"
            title="Displayed CAAR fields and provenance"
            sub="Every displayed field is labeled as direct upload, sealed config, rule engine, or synthetic."
          >
            <SimpleTable
              columns={["Field", "Value", "Provenance", "Trace"]}
              rows={provenanceRows.map((row) => [
                row.field,
                row.value,
                <StatusText key={`${row.field}:provenance`} good={row.provenance !== "synthetic"}>
                  {formatProvenance(row.provenance)}
                </StatusText>,
                row.assessment,
              ])}
            />
          </ReportCard>

          <ReportCard
            eyebrow="Evidence Trace"
            title="Persisted source artifacts"
            sub="Each evidence row is tied to a persisted upload record. Review rows are not treated as fully governed."
          >
            <SimpleTable
              columns={["Artifact", "Status", "Assessment", "Trace"]}
              rows={evidenceTraceRows.map((row) => [
                row.source,
                <StatusText key={`${row.source}:status`} good={row.status === "Provided"}>
                  {row.status}
                </StatusText>,
                row.assessment,
                row.trace,
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
            {claimReady
              ? "The certification state is court-admissible because the persisted engine output and required evidence package are both present."
              : "A high trust score alone is not enough. Unsupported fields, missing uploads, or review-state evidence still block a defensible certification."}
          </div>
        </ReportCard>

        <ReportCard
          eyebrow="Evidence & Provenance"
          title={claimReady ? "Evidence posture is fully defensible" : "Why this is not fully defensible yet"}
          sub={
            claimReady
              ? "All required source evidence, sealed governance, and rule outputs are persisted and traceable."
              : "Every blocker below maps to missing or review-state persisted evidence."
          }
        >
          {!claimReady ? (
            <p className="mb-4 text-sm leading-7 text-[var(--muted)]">
              The current package may still produce deterministic arithmetic, but this report is hardened to treat only
              persisted uploads, sealed governance records, and stored rule outputs as trustworthy evidence.
            </p>
          ) : null}
          <SimpleTable
            columns={["Source", "Status", "Assessment"]}
            rows={evidenceTraceRows.map((row) => [
              row.source,
              <StatusText key={`${row.source}:status`} good={row.status === "Provided"}>
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
            sub="Only persisted attestation facts are shown. Removed synthetic hashes, timestamps, and engine labels."
          >
            <div className="space-y-3">
              <AttestRow label="Certification Run" value={traceability?.certRunId ? `cert_runs_v2#${traceability.certRunId}` : "Not linked"} />
              <AttestRow label="Rule Set Version" value={ruleSetVersion ?? "Not persisted"} />
              <AttestRow label="Certification Timestamp" value={certificationDate} />
              <AttestRow label="Rule Citations Persisted" value={String(ruleCitations.length)} />
              <AttestRow
                label="Integrity Hash"
                value={
                  evidenceRows.every((row) => row.sha256)
                    ? "Every persisted source artifact exposes SHA-256"
                    : "One or more required source artifacts are missing SHA-256 or not persisted"
                }
                accent={evidenceRows.every((row) => row.sha256)}
              />
            </div>
          </ReportCard>
        </div>

        <ReportCard
          eyebrow="Rule Citations"
          title={ruleCitations.length > 0 ? "Persisted rule-engine findings" : "No persisted rule citations"}
          sub="Only stored rule citations are shown here. If there are no citations, the UI does not invent them."
        >
          {ruleCitations.length > 0 ? (
            <SimpleTable
              columns={["Rule", "Version", "Fired", "Variance", "Sample Evidence"]}
              rows={ruleCitations.map((row) => [
                row.ruleId,
                row.ruleVersion,
                String(row.firedCount),
                row.varianceDisplay,
                `${row.sampleEvidenceCount} sample entries`,
              ])}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
              No persisted `rule_citations_v2` rows were found for this CAAR. The report therefore does not fabricate
              rule-level conclusions beyond the stored findings summary.
            </div>
          )}
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
  evidence,
  locationId,
  modules,
  moduleId,
}: {
  artifactIntakeState: Record<string, IntakeState>;
  evidence: CaarEvidenceTrace[];
  locationId: string;
  moduleId: "M01" | "M02";
  modules: UploadModule[];
}): ExhibitRow[] {
  if (evidence.length > 0) {
    return evidence.map((row, index) => ({
      description: buildEvidenceAssessment(row),
      id: `EX-${String(index + 1).padStart(3, "0")}`,
      integrity: row.sha256 ? (row.status === "provided" ? "Verified" : "Review") : "Required",
      integrityTone: row.sha256 ? (row.status === "provided" ? "success" : "warning") : "danger",
      source: row.label,
      status: row.status === "provided" ? "Provided" : row.status === "review" ? "Review" : "Missing",
      statusTone: row.status === "provided" ? "success" : row.status === "review" ? "warning" : "danger",
    }));
  }

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
      Boolean(posIntake?.uploaded),
    ),
    exhibit(
      "EX-003",
      moduleId === "M01" ? "Processor Statement" : "DSP Statement",
      moduleId === "M01" ? "Processor settlement statement" : "Marketplace or processor settlement statement",
      statementIntake,
      Boolean(statementIntake?.uploaded),
    ),
    exhibit("EX-004", "Bank Statement", "Deposit proof for settlement validation", bankIntake, Boolean(bankIntake?.uploaded)),
    exhibit(
      "EX-005",
      "Contract / Fee Schedule",
      "Executed commercial terms governing fee rate",
      contractIntake,
      Boolean(contractIntake?.uploaded),
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

function buildEvidenceAssessment(row: CaarEvidenceTrace) {
  const details: string[] = [];
  if (row.vendor) details.push(`Vendor: ${row.vendor}`);
  if (typeof row.matchPct === "number") details.push(`Schema match: ${row.matchPct}%`);
  if (typeof row.rows === "number") details.push(`Rows: ${row.rows}`);
  if (typeof row.pageCount === "number") details.push(`Pages: ${row.pageCount}`);
  if (row.notes.length > 0) details.push(row.notes[0]);
  return details.length > 0 ? details.join(" | ") : "Persisted source artifact with no extra validation note.";
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatProvenance(value: CaarProvenanceKind) {
  return {
    direct_upload: "Direct Upload",
    rule_engine: "Rule Engine",
    sealed_config: "Sealed Config",
    synthetic: "Synthetic / Unbacked",
  }[value];
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
