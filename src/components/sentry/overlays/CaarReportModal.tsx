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
import { findCanonicalRule, findCanonicalRuleClause, getRuntimeRuleCrosswalk } from "@/lib/mge/canonical-registry";

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
  const moduleLabel =
    moduleId === "M01"
      ? "Merchant Fee Recovery"
      : moduleId === "M02"
        ? "Delivery Fee Recovery"
        : "Royalty Recovery";
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
  const evidenceRows = traceability?.evidence ?? [];
  const fieldAudit = traceability?.fieldAudit ?? [];
  const passedRuleCitations = traceability?.passedRuleCitations ?? [];
  const reconciliationExceptions = traceability?.reconciliationExceptions ?? [];
  const ruleCitations = traceability?.ruleCitations ?? [];
  const hasPersistedTraceability =
    Boolean(traceability?.certRunId) &&
    (Boolean(traceability?.ruleSetVersion) ||
      Boolean(traceability?.sealedAt) ||
      evidenceRows.length > 0 ||
      fieldAudit.length > 0 ||
      passedRuleCitations.length > 0 ||
      ruleCitations.length > 0);
  const monetaryRuleCitations = ruleCitations.filter((row) => !isZeroVarianceDisplay(row.varianceDisplay));
  const blockingRuleCitations = ruleCitations.filter((row) => isZeroVarianceDisplay(row.varianceDisplay));
  const ruleSetVersion = traceability?.ruleSetVersion ?? null;
  const certificationDate = traceability?.sealedAt ?? traceability?.certCompletedAt ?? "Not persisted";
  const unsupportedFieldAudit = fieldAudit.filter((row) => !row.supported);
  const missingEvidence = evidenceRows.filter((row) => row.status === "missing");
  const reviewEvidence = evidenceRows.filter((row) => row.status === "review");
  const remediationSteps = [
    ...reconciliationExceptions,
    ...missingEvidence.map((row) => `Upload ${row.label} and persist it for this ${moduleId} certification package.`),
    ...reviewEvidence.map((row) => `Resolve review blockers on ${row.label} before treating it as governed evidence.`),
    ...unsupportedFieldAudit.map((row) => `Backfill ${row.field} from a persisted upload, sealed config, or stored engine output.`),
  ];
  const lowDimensions = record.dimensions.filter((dimension) => dimension.score < 85);
  const traceabilityGap =
    !hasPersistedTraceability
      ? "This CAAR summary row exists, but its linked persisted certification-run traceability is incomplete or missing. Treat this report as broken lineage until the certification run, rule citations, and evidence trace are restored."
      : null;
  const claimReady =
    Boolean(traceability?.courtAdmissible ?? record.status === "Court Admissible") &&
    hasPersistedTraceability &&
    unsupportedFieldAudit.length === 0;
  const remediationDone = claimReady;
  const effectiveRemediationSteps =
    traceabilityGap
      ? [traceabilityGap]
      : remediationSteps.length > 0
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
  const weeklyPreliminary = isWeeklyPreliminaryRecord(record, ruleSetVersion);
  const preliminaryTrustScore = weeklyPreliminary ? computeDimensionCompositeScore(record) : null;
  const finalReleaseScore = weeklyPreliminary ? record.trustScore : null;
  const headlineScore = preliminaryTrustScore ?? record.trustScore;
  const headlineBadge = getScoreBandLabel(headlineScore);

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
                {weeklyPreliminary ? "Preliminary Trust Score" : "Trust Score"}
              </div>
              <span
                className={`rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] ${
                  headlineScore >= 85
                    ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                    : headlineScore >= 50
                      ? "bg-[rgba(255,152,0,0.12)] text-[#b86a00]"
                      : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                }`}
              >
                {headlineBadge}
              </span>
            </div>
            <div className={`mt-4 font-[family-name:var(--font-display)] text-8xl font-extrabold tracking-[-0.08em] ${getTrustTone(headlineScore)}`}>
              {headlineScore}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className={`h-full rounded-full ${getScoreBar(headlineScore)}`} style={{ width: `${headlineScore}%` }} />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {weeklyPreliminary
                ? "Weekly Preliminary runs expose an operational trust reading from the MQ6 dimensions while keeping the final release score separate until the monthly final gate is attempted."
                : traceabilityGap
                  ? "This CAAR headline exists, but the persisted certification-run lineage for this report is incomplete. The summary must not be treated as a defensible final record until traceability is restored."
                : claimReady
                  ? "This CAAR is backed by persisted uploads, sealed governance records, and stored rule-engine outputs."
                  : "This CAAR is not yet fully supported by persisted evidence or sealed governance records for every required field."}
            </p>
            {weeklyPreliminary ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ScoreExplainCard
                  label="Preliminary Trust Score"
                  tone={headlineScore}
                  value={headlineScore}
                  description="Operational confidence from the MQ6 dimension rollup for this weekly preliminary run."
                />
                <ScoreExplainCard
                  label="Final Release Score"
                  tone={finalReleaseScore ?? 0}
                  value={finalReleaseScore ?? 0}
                  description="Court-admissible release score. Weekly preliminary keeps this blocked until the monthly final cadence completes."
                />
              </div>
            ) : null}
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
            {traceabilityGap ? (
              <div className="mb-4 rounded-2xl border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.05)] p-4 text-sm leading-7 text-[var(--accent)]">
                {traceabilityGap}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <ValueChip label="Module" value={moduleId} />
              <ValueChip label="Rule Citations" value={hasPersistedTraceability ? String(ruleCitations.length) : "Trace missing"} />
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
            {weeklyPreliminary ? (
              <>
                Preliminary Trust Score for this weekly report is <strong>{headlineScore}/100</strong>. Final Release
                Score remains <strong>{finalReleaseScore ?? 0}/100</strong> until monthly-final bank tie-out and release
                gates are evaluated.
              </>
            ) : (
              <>
                Composite trust score for this report is <strong>{record.trustScore}/100</strong>.{" "}
                {claimReady
                  ? "The certification state is court-admissible because the persisted engine output and required evidence package are both present."
                  : "A high trust score alone is not enough. Unsupported fields, missing uploads, or review-state evidence still block a defensible certification."}
              </>
            )}
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

        {reconciliationExceptions.length > 0 ? (
          <ReportCard
            eyebrow="Reconciliation Exceptions"
            title="Persisted payout vs bank mismatches"
            sub="These exceptions come from the saved payout-export rows and saved bank-statement deposit rows used by this CAAR."
          >
            <div className="space-y-3">
              {reconciliationExceptions.map((item, index) => (
                <div
                  key={`reconciliation-exception:${index}`}
                  className="rounded-2xl border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.05)] p-4 text-sm leading-7 text-[var(--accent)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </ReportCard>
        ) : null}

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
              <AttestRow label="Monetary Rule Citations" value={String(monetaryRuleCitations.length)} />
              <AttestRow label="Blocking Rule Citations" value={String(blockingRuleCitations.length)} />
              <AttestRow label="Passed Rule Citations" value={String(passedRuleCitations.length)} />
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
          title={
            !hasPersistedTraceability
              ? "Rule-citation trace unavailable"
              : monetaryRuleCitations.length > 0
                ? "Persisted monetary rule-engine findings"
                : "No persisted monetary rule citations"
          }
          sub="Only stored rules with attributed dollar variance are shown here. Zero-dollar blocking controls are separated below."
        >
          {!hasPersistedTraceability ? (
            <div className="rounded-2xl border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.05)] p-4 text-sm leading-7 text-[var(--accent)]">
              Stored rule-citation lineage is missing for this CAAR record. The summary row exists, but the linked certification-run trace was not recovered.
            </div>
          ) : monetaryRuleCitations.length > 0 ? (
            <SimpleTable
              columns={["Rule", "Version", "Fired", "Variance", "Sample Evidence"]}
              rows={monetaryRuleCitations.map((row) => [
                <RuleCitationCell
                  key={`${row.ruleId}:${row.ruleVersion}`}
                  evidenceRows={evidenceRows}
                  rule={row}
                  moduleId={moduleId}
                  disposition="monetary_problem"
                />,
                row.ruleVersion,
                String(row.firedCount),
                <VarianceCitationCell
                  key={`${row.ruleId}:${row.ruleVersion}:variance`}
                  evidenceRows={evidenceRows}
                  rule={row}
                  moduleId={moduleId}
                  disposition="monetary_problem"
                />,
                `${row.sampleEvidenceCount} sample entries`,
              ])}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
              No persisted monetary rule citations were found for this CAAR. Dollar-attributed findings are only shown
              when the stored engine output assigns non-zero variance to a rule.
            </div>
          )}
        </ReportCard>

        <details className="rounded-[28px] border border-[var(--border)] bg-white">
          <summary className="cursor-pointer list-none px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Blocking Controls
                </div>
                <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                  Non-monetary blocking rule findings
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  Expand to inspect stored rule citations that block release or mark a control failure without assigning
                  direct dollar variance.
                </div>
              </div>
              <div className="rounded-full border border-[var(--border)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                {hasPersistedTraceability ? `${blockingRuleCitations.length} stored` : "Trace missing"}
              </div>
            </div>
          </summary>
          <div className="border-t border-[var(--border)] px-6 py-6">
            {!hasPersistedTraceability ? (
              <div className="rounded-2xl border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.05)] p-4 text-sm leading-7 text-[var(--accent)]">
                Stored blocking-control rows are unavailable because the linked certification-run lineage is missing for this CAAR.
              </div>
            ) : blockingRuleCitations.length > 0 ? (
              <SimpleTable
                columns={["Rule", "Version", "Issue", "Recorded", "Sample Evidence"]}
                rows={blockingRuleCitations.map((row) => [
                  <RuleCitationCell
                    key={`${row.ruleId}:${row.ruleVersion}:blocking`}
                    evidenceRows={evidenceRows}
                    rule={row}
                    moduleId={moduleId}
                    disposition="blocking_problem"
                  />,
                  row.ruleVersion,
                  buildBlockingIssueSummary(row, moduleId, evidenceRows),
                  String(row.firedCount),
                  `${row.sampleEvidenceCount} sample entr${row.sampleEvidenceCount === 1 ? "y" : "ies"}`,
                ])}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                No non-monetary blocking citations were persisted for this CAAR.
              </div>
            )}
          </div>
        </details>

        <details className="rounded-[28px] border border-[var(--border)] bg-white">
          <summary className="cursor-pointer list-none px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Passed Controls
                </div>
                <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                  Persisted passed rule traces
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  Expand to inspect rules that were evaluated and passed without attributed variance.
                </div>
              </div>
              <div className="rounded-full border border-[var(--border)] px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                {hasPersistedTraceability ? `${passedRuleCitations.length} stored` : "Trace missing"}
              </div>
            </div>
          </summary>
          <div className="border-t border-[var(--border)] px-6 py-6">
            {!hasPersistedTraceability ? (
              <div className="rounded-2xl border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.05)] p-4 text-sm leading-7 text-[var(--accent)]">
                Stored passed-control traces are unavailable because the linked certification-run lineage is missing for this CAAR.
              </div>
            ) : passedRuleCitations.length > 0 ? (
              <SimpleTable
                columns={["Rule", "Version", "Recorded", "Variance", "Sample Evidence"]}
                rows={passedRuleCitations.map((row) => [
                  <RuleCitationCell
                    key={`${row.ruleId}:${row.ruleVersion}:passed`}
                    evidenceRows={evidenceRows}
                    rule={row}
                    moduleId={moduleId}
                    disposition="passed"
                  />,
                  row.ruleVersion,
                  String(row.firedCount),
                  <VarianceCitationCell
                    key={`${row.ruleId}:${row.ruleVersion}:passed:variance`}
                    evidenceRows={evidenceRows}
                    rule={row}
                    moduleId={moduleId}
                    disposition="passed"
                  />,
                  `${row.sampleEvidenceCount} sample entr${row.sampleEvidenceCount === 1 ? "y" : "ies"}`,
                ])}
              />
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                No passed control-trace citations were persisted for this CAAR.
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

function RuleCitationCell({
  disposition,
  evidenceRows,
  moduleId,
  rule,
}: {
  disposition: CitationDisposition;
  evidenceRows: CaarEvidenceTrace[];
  moduleId: "M01" | "M02" | "M03";
  rule: CaarRuleCitationRow;
}) {
  const tip = describeRuleCitation(rule, moduleId, evidenceRows, disposition);

  return (
    <div className="flex items-center gap-2">
      <span>{rule.ruleId}</span>
      <HelpTip
        title={`Rule Citation · ${rule.ruleId}`}
        sections={[
          { label: "Canonical Definition", text: tip.canonicalDefinition },
          { label: "Rule", text: tip.ruleText },
          { label: "Evidence", text: tip.evidence },
        ]}
        footerLabel="Canonical Link"
        footerValue={tip.footer}
      />
    </div>
  );
}

function VarianceCitationCell({
  disposition,
  evidenceRows,
  moduleId,
  rule,
}: {
  disposition: CitationDisposition;
  evidenceRows: CaarEvidenceTrace[];
  moduleId: "M01" | "M02" | "M03";
  rule: CaarRuleCitationRow;
}) {
  const tip = describeRuleCitation(rule, moduleId, evidenceRows, disposition);

  return (
    <div className="flex items-center gap-2">
      <span>{rule.varianceDisplay}</span>
      <HelpTip
        title={`Variance Detail · ${rule.ruleId}`}
        sections={[
          { label: "Calculation", text: tip.calculation },
          { label: "Evidence", text: tip.evidence },
        ]}
        footerLabel="Sample Evidence"
        footerValue={`${rule.sampleEvidenceCount} persisted entr${rule.sampleEvidenceCount === 1 ? "y" : "ies"}`}
      />
    </div>
  );
}

function isWeeklyPreliminaryRecord(record: CaarRecord, ruleSetVersion: string | null) {
  return (
    record.period.toLowerCase().includes("weekly preliminary") ||
    (ruleSetVersion ?? "").toLowerCase().includes("weekly")
  );
}

function computeDimensionCompositeScore(record: CaarRecord) {
  const weights: Record<string, number> = {
    Auditability: 0.2,
    "Cross-System Reconciliation": 0.25,
    "Data Completeness": 0.1,
    "Data Freshness": 0.1,
    "Rule Integrity": 0.15,
    "Source Authenticity": 0.2,
  };

  const score = record.dimensions.reduce((sum, dimension) => {
    return sum + dimension.score * (weights[dimension.name] ?? 0);
  }, 0);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getScoreBandLabel(score: number) {
  if (score >= 85) return "Certified";
  if (score >= 50) return "Qualified";
  return "At Risk";
}

function ScoreExplainCard({
  description,
  label,
  tone,
  value,
}: {
  description: string;
  label: string;
  tone: number;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.06em] ${getTrustTone(tone)}`}>
        {value}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
        <div className={`h-full rounded-full ${getScoreBar(tone)}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}

function inferModule(record: CaarRecord) {
  const corpus = `${record.id} ${record.narrative} ${record.findings.join(" ")}`.toLowerCase();
  if (corpus.includes("royalty") || corpus.includes("franchise") || corpus.includes("m03")) {
    return "M03";
  }
  return corpus.includes("processor") || corpus.includes("interchange") || corpus.includes("merchant")
    ? "M01"
    : "M02";
}

function isZeroVarianceDisplay(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  return normalized === "0" || normalized === "0.00" || normalized === "(0)" || normalized === "-0" || normalized === "-0.00";
}

function buildBlockingIssueSummary(
  rule: CaarRuleCitationRow,
  moduleId: "M01" | "M02" | "M03",
  evidenceRows: CaarEvidenceTrace[],
) {
  const tip = describeRuleCitation(rule, moduleId, evidenceRows, "blocking_problem");
  const firstSample = rule.sampleEvidence[0] ?? {};
  const detail = typeof firstSample.detail === "string" ? firstSample.detail.trim() : "";

  if (detail) {
    return detail;
  }

  const conciseRule = tip.ruleText
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");

  if (conciseRule.length <= 140) {
    return conciseRule;
  }

  return `${conciseRule.slice(0, 137)}...`;
}

type RuleCitationTip = {
  canonicalDefinition: string;
  calculation: string;
  evidence: string;
  footer: string;
  ruleText: string;
};

type RuleTooltipOverride = Omit<RuleCitationTip, "canonicalDefinition">;

type CitationDisposition = "monetary_problem" | "blocking_problem" | "passed";
type CaarRuleCitationRow = NonNullable<CaarRecord["traceability"]>["ruleCitations"][number];
type RuleCitationSample = Record<string, string | number | boolean | null>;

const RUNTIME_RULE_MAP = new Map(getRuntimeRuleCrosswalk().map((row) => [row.runtimeRuleId, row]));

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

const RULE_TOOLTIP_OVERRIDES: Record<string, RuleTooltipOverride> = {
  "MFR-BIL-15": {
    ruleText:
      "Rebuild the expected M01 processor fee from the sealed pricing terms, then compare it to the observed processor fee burden on the statement.",
    calculation:
      "Expected fee is reconstructed from governed contract terms such as markup bps, fixed per-transaction fee, and recurring fees. Variance is observed statement fees minus expected governed fees.",
    evidence:
      "Uses the processor statement upload for gross sales / fee totals, the sealed contract config for pricing terms, and the governed source mapping that binds those fields into engine inputs.",
    footer: "Primary M01 fee-audit runtime rule",
  },
  "MFR-MRK-03": {
    ruleText:
      "Audit whether the processor markup basis points charged in practice exceed the sealed markup cap.",
    calculation:
      "Observed markup bps from the governed statement is compared against the sealed markup-bps term. Positive excess over the contract threshold creates attributed variance.",
    evidence:
      "Uses the processor statement field mapped to processor_markup_bps and the sealed contract-config markup term for the active vendor workspace.",
    footer: "Markup overcharge control",
  },
  "MFR-MRK-05": {
    ruleText:
      "Audit whether the processor charged a per-transaction fixed fee above the governed contract amount.",
    calculation:
      "Observed txn-fee behavior is measured against the sealed per-transaction fee. Excess fee per transaction multiplied by transaction volume yields variance.",
    evidence:
      "Uses transaction_count from governed source mapping plus the sealed contract fixed-fee term.",
    footer: "Per-transaction fee control",
  },
  "MFR-INT-12": {
    ruleText:
      "Check Visa debit fee behavior against the sealed card-brand interchange and markup truth table.",
    calculation:
      "Expected Visa debit fee is reconstructed from the sealed card-brand rate and fixed fee, then compared against the observed Visa debit fee pool.",
    evidence:
      "Uses card-brand fee and volume metrics extracted from the processor source plus the sealed card-brand pricing table in contract config.",
    footer: "Visa debit downgrade / interchange control",
  },
  "MFR-INT-14": {
    ruleText:
      "Check Mastercard debit fee behavior against the sealed card-brand interchange and markup truth table.",
    calculation:
      "Expected Mastercard debit fee is reconstructed from the sealed card-brand rate and fixed fee, then compared against the observed Mastercard debit fee pool.",
    evidence:
      "Uses card-brand fee and volume metrics extracted from the processor source plus the sealed card-brand pricing table in contract config.",
    footer: "Mastercard debit downgrade / interchange control",
  },
  "MFR-VOL-08": {
    ruleText:
      "Detect missed tier-volume discount behavior where processed volume should have qualified for a better governed rate.",
    calculation:
      "Actual governed volume is measured against the sealed tier structure. If the active tier does not reflect achieved volume, the model computes excess fee variance.",
    evidence:
      "Uses governed statement volume metrics and sealed contract tier-volume pricing terms.",
    footer: "Tier-volume drift control",
  },
  "MFR-VOL-09": {
    ruleText:
      "Detect wrong tier application or tier downgrade relative to the sealed pricing schedule.",
    calculation:
      "Expected fee under the proper sealed tier is compared against observed fee behavior to attribute variance caused by tier misapplication.",
    evidence:
      "Uses governed statement basis volume, transaction counts, and the sealed tier schedule.",
    footer: "Tier application control",
  },
  "MFR-CBK-04": {
    ruleText:
      "Detect chargeback-fee leakage beyond the sealed agreement.",
    calculation:
      "Observed chargeback-related fee burden is tested against the governed chargeback expectations and attributed where excess billing remains.",
    evidence:
      "Uses governed statement counts / fee pools and sealed chargeback-related contract terms.",
    footer: "Chargeback fee control",
  },
  "MFR-RFD-01": {
    ruleText:
      "Detect refund-processing fees or refund-linked fee leakage beyond governed expectations.",
    calculation:
      "Refund count and related fee behavior are compared to the sealed refund pricing assumptions to attribute overcharge variance.",
    evidence:
      "Uses refund counts or refund-related source metrics plus the sealed contract pricing model.",
    footer: "Refund fee control",
  },
  "MFR-FEE-21": {
    ruleText:
      "Capture residual extra-fee pools that are not justified by the sealed pricing model.",
    calculation:
      "After all known governed fee components are reconstructed, any remaining unexplained positive processor fee pool is attributed as residual variance.",
    evidence:
      "Uses the processor statement fee totals, sealed contract pricing truth, and the full reconstructed expected-fee model.",
    footer: "Residual unexplained fee control",
  },
  R123: {
    ruleText:
      "Cross-system reconciliation must clear the release band before final CAAR release is defensible.",
    calculation:
      "The engine checks whether reconciliation score reaches the release threshold. A score below threshold remains a blocking condition rather than a direct dollar variance rule.",
    evidence:
      "Uses processor source, POS export, and bank evidence as applicable to the certification cadence.",
    footer: "Canonical reconciliation threshold",
  },
  R128: {
    ruleText:
      "Fee-legitimacy gate score is evaluated from governed evidence and deterministic fee reconstruction.",
    calculation:
      "The engine resolves TG07 from the fee-legitimacy controls and uses it as a major weighted component of final release scoring.",
    evidence:
      "Uses governed processor or DSP fee evidence together with the sealed contract truth used by the trust-gate layer.",
    footer: "TG07 trust-gate checkpoint",
  },
  R129: {
    ruleText:
      "Fee-variance grade must clear the final legitimacy band before release.",
    calculation:
      "The certification checks whether TG07 clears the release threshold. If not, the CAAR remains non-releasable even when other dimensions look strong.",
    evidence:
      "Uses the persisted TG07 trust-gate result derived from source evidence and sealed pricing controls.",
    footer: "Fee legitimacy release threshold",
  },
  R135: {
    ruleText:
      "Final CAAR eligibility depends on the composite trust-gate threshold clearing the required release mark.",
    calculation:
      "TG11 is set to pass only when the weighted TG01-TG10 composite clears the eligibility threshold. Otherwise final release remains blocked.",
    evidence:
      "Uses the persisted trust-gate results computed from the certification package for the active run.",
    footer: "Final eligibility gate",
  },
};

function describeRuleCitation(
  row: CaarRuleCitationRow,
  moduleId: "M01" | "M02" | "M03",
  evidenceRows: CaarEvidenceTrace[],
  disposition: CitationDisposition,
): RuleCitationTip {
  const ruleId = row.ruleId;
  const sample = row.sampleEvidence[0] ?? {};
  const override = RULE_TOOLTIP_OVERRIDES[ruleId];
  if (override) {
    return {
      ...override,
      canonicalDefinition: [
        "Rule ID",
        ruleId,
        "",
        "Rule Name",
        override.footer,
        "",
        "IF Condition",
        "Runtime-specific override",
        "",
        "THEN Action",
        "See runtime meaning, calculation, and evidence sections.",
        "",
        "Output / Domain",
        getCanonicalOutputDomain(ruleId),
      ].join("\n"),
      calculation: buildRuleCalculation(ruleId, moduleId, sample, row.varianceDisplay, override.calculation),
      evidence: buildRuleEvidence(ruleId, moduleId, sample, evidenceRows, override.evidence),
    };
  }

  const runtimeRule = RUNTIME_RULE_MAP.get(ruleId) ?? null;
  const canonicalIds = runtimeRule?.canonicalRuleIds ?? [ruleId];
  const canonicalRules = canonicalIds
    .map((canonicalId) => findCanonicalRule(canonicalId))
    .filter((rule): rule is NonNullable<ReturnType<typeof findCanonicalRule>> => Boolean(rule));
  const canonicalSummary =
    canonicalRules.length > 0
      ? canonicalRules.map((rule) => `${rule.ruleId} ${rule.ruleName}`).join(" | ")
      : "Canonical rule metadata is not yet expanded for this runtime citation.";
  const canonicalDefinition = canonicalIds
    .map((canonicalId) => {
      const canonical = findCanonicalRule(canonicalId);
      const clause = findCanonicalRuleClause(canonicalId);
      const usableClause = hasUsableClause(canonicalId);
      const ruleName = usableClause
        ? clause?.ruleName ?? canonical?.ruleName ?? canonicalId
        : canonical?.ruleName ?? clause?.ruleName ?? canonicalId;
      const ifCondition = usableClause
        ? clause?.ifCondition ?? "Not available in clause registry."
        : "Exact IF clause is not available from the extracted clause registry for this rule.";
      const thenAction = usableClause
        ? clause?.thenAction ?? "Not available in clause registry."
        : "Exact THEN action is not available from the extracted clause registry for this rule.";
      const outputDomain = getCanonicalOutputDomain(canonicalId);

      return [
        "Rule ID",
        canonicalId,
        "",
        "Rule Name",
        ruleName,
        "",
        "IF Condition",
        ifCondition,
        "",
        "THEN Action",
        thenAction,
        "",
        "Output / Domain",
        outputDomain,
      ].join("\n");
    })
    .join("\n\n");
  const runtimeMeaning =
    runtimeRule?.note ??
    `${moduleId} certification persisted this rule because the deterministic engine found a governed condition tied to ${canonicalSummary}.`;
  const detail = typeof sample.detail === "string" && sample.detail.trim().length > 0 ? sample.detail.trim() : null;
  const outcomeLabel =
    disposition === "passed"
      ? "Passed control"
      : disposition === "blocking_problem"
        ? "Blocking control"
        : "Monetary variance control";
  const outcomeText =
    disposition === "passed"
      ? detail ?? "This control was evaluated and did not block release for this persisted CAAR run."
      : disposition === "blocking_problem"
        ? detail ?? "This control remains a non-monetary blocker for release on this persisted CAAR run."
        : detail ?? "This control attributed non-zero variance on this persisted CAAR run.";
  const whyItAppears =
    disposition === "passed"
      ? "This row is shown in Passed Controls because the rule was recorded for audit traceability and finished without attributed variance."
      : disposition === "blocking_problem"
        ? "This row is shown in Blocking Controls because it recorded a release-blocking condition without assigning direct dollar variance."
        : "This row is shown in monetary findings because the stored engine output attributed non-zero dollar variance to this rule.";

  return {
    canonicalDefinition,
    ruleText: `Current Result\n${outcomeLabel}\n${outcomeText}\n\nWhy This Row Appears\n${whyItAppears}\n\nRuntime Meaning\n${runtimeMeaning}`,
    calculation: buildRuleCalculation(ruleId, moduleId, sample, row.varianceDisplay, buildGenericCalculation(ruleId, moduleId)),
    evidence: buildRuleEvidence(ruleId, moduleId, sample, evidenceRows, buildGenericEvidence(ruleId, moduleId)),
    footer:
      canonicalRules.length > 0
        ? canonicalRules.map((rule) => `${rule.ruleId} · Section ${rule.sectionNumber}`).join(" | ")
        : "Runtime-only citation",
  };
}

function buildGenericCalculation(ruleId: string, moduleId: "M01" | "M02" | "M03") {
  if (ruleId.startsWith("MFR-") || moduleId === "M01") {
    return "The engine reconstructs expected merchant-fee behavior from the sealed contract terms and compares that governed expectation to observed processor and POS evidence. Any justified excess becomes attributed variance or a release-blocking control failure.";
  }

  if (ruleId.startsWith("DFR-") || moduleId === "M02") {
    return "The engine reconstructs expected delivery-fee and commission behavior from sealed DSP terms, then compares it against settlement, POS, and bank evidence. Any excess or mismatch becomes attributed variance or a release-blocking control failure.";
  }

  return "The deterministic engine compares governed expected behavior to persisted observed evidence and stores the rule when the condition remains materially relevant to certification.";
}

function buildGenericEvidence(ruleId: string, moduleId: "M01" | "M02" | "M03") {
  if (ruleId === "R135" || ruleId.startsWith("R12") || ruleId.startsWith("R13")) {
    return "Evidence comes from the persisted trust-gate, MQ6, and governed-state outputs stored with the certification run.";
  }

  if (moduleId === "M01") {
    return "Evidence comes from the governed processor statement, POS export, signed merchant agreement, bank evidence when required, sealed source-column bindings, and sealed contract terms.";
  }

  if (moduleId === "M03") {
    return "Evidence comes from the governed royalty statement or report, POS sales export, signed royalty or franchise agreement, bank evidence when required, sealed source bindings, and sealed royalty contract terms.";
  }

  return "Evidence comes from the governed DSP settlement export, POS summary/export, signed DSP agreement, bank deposit evidence when required, sealed schema bindings, and sealed DSP contract terms.";
}

function formatMetricValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "not stored in this citation row";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  return value;
}

function formatMoneyLike(value: string | number | boolean | null | undefined) {
  if (typeof value !== "number") return formatMetricValue(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPlainNumber(value: string | number | boolean | null | undefined) {
  if (typeof value !== "number") return formatMetricValue(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function humanizeMetricKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

function buildPersistedInputs(sample: RuleCitationSample) {
  const rows = Object.entries(sample).map(([key, value]) => `${humanizeMetricKey(key)}: ${formatMetricValue(value)}`);
  return rows.length > 0 ? rows.join("\n") : "No sample-evidence payload was stored with this citation.";
}

function buildRuleCalculation(
  ruleId: string,
  moduleId: "M01" | "M02" | "M03",
  sample: RuleCitationSample,
  varianceDisplay: string,
  fallback: string,
) {
  const detail = typeof sample.detail === "string" && sample.detail.trim().length > 0 ? sample.detail.trim() : null;

  if (ruleId === "MFR-BIL-15" || ruleId === "R083") {
    const basisAmount = typeof sample.basis_amount === "number" ? sample.basis_amount : null;
    const markupBps = typeof sample.contracted_markup_bps === "number" ? sample.contracted_markup_bps : null;
    const txnFee = typeof sample.contracted_per_txn_fee === "number" ? sample.contracted_per_txn_fee : null;
    const monthlyFee = typeof sample.contracted_monthly_fee === "number" ? sample.contracted_monthly_fee : null;
    const transactionCount = typeof sample.transaction_count === "number" ? sample.transaction_count : null;
    const markupComponent = typeof sample.expected_markup_component === "number" ? sample.expected_markup_component : null;
    const txnComponent = typeof sample.expected_txn_component === "number" ? sample.expected_txn_component : null;
    const monthlyComponent = typeof sample.expected_monthly_component === "number" ? sample.expected_monthly_component : null;
    const explicitSubstitution =
      basisAmount !== null &&
      markupBps !== null &&
      txnFee !== null &&
      monthlyFee !== null &&
      transactionCount !== null &&
      markupComponent !== null &&
      txnComponent !== null &&
      monthlyComponent !== null &&
      typeof sample.expected_fee_amount === "number"
        ? [
            "",
            "Substituted formula",
            `F_exp = (${formatMoneyLike(basisAmount)} x ${formatPlainNumber(markupBps / 100)}%) + (${formatPlainNumber(transactionCount)} x ${formatMoneyLike(txnFee)}) + ${formatMoneyLike(monthlyFee)}`,
            `= ${formatMoneyLike(markupComponent)} + ${formatMoneyLike(txnComponent)} + ${formatMoneyLike(monthlyComponent)}`,
            `= ${formatMoneyLike(sample.expected_fee_amount)}`,
            "",
            "Variance proof",
            `${formatMoneyLike(sample.actual_fee_amount)} - ${formatMoneyLike(sample.expected_fee_amount)} = ${formatMoneyLike(sample.unexplained_fee_delta)}`,
          ]
        : [];
    const missingOperandProof =
      explicitSubstitution.length === 0
        ? [
            "",
            "Stored operand status",
            `basis_amount = ${formatMoneyLike(sample.basis_amount)}`,
            `contracted_markup_bps = ${formatMetricValue(sample.contracted_markup_bps)}`,
            `contracted_per_txn_fee = ${formatMoneyLike(sample.contracted_per_txn_fee)}`,
            `contracted_monthly_fee = ${formatMoneyLike(sample.contracted_monthly_fee)}`,
            `transaction_count = ${formatPlainNumber(sample.transaction_count)}`,
            "",
            "The exact substituted proof cannot be rendered because one or more operands were not persisted on this citation row. Rerun certification after resealing the workspace so the engine stores the full fee-proof payload.",
          ]
        : [];

    return [
      "Formula",
      "Delta = max(0, F_obs - F_exp)",
      "Variance_attributed = min(Delta, residual_variance_pool)",
      "",
      "Operands",
      `F_obs (observed processor fee total from statement) = ${formatMoneyLike(sample.actual_fee_amount)}`,
      `F_exp (expected governed fee total from sealed pricing terms) = ${formatMoneyLike(sample.expected_fee_amount)}`,
      `Delta stored on citation row as unexplained_fee_delta = ${formatMoneyLike(sample.unexplained_fee_delta)}`,
      `Variance_attributed = ${varianceDisplay}`,
      ...explicitSubstitution,
      ...missingOperandProof,
      "",
      sample.actual_fee_amount === null || sample.actual_fee_amount === undefined || sample.expected_fee_amount === null || sample.expected_fee_amount === undefined
        ? "This persisted citation row stores the final variance but does not store one or more intermediate operands. The engine therefore proved the variance at run time, but this specific row cannot reproduce every operand numerically."
        : "This row contains the actual operands used by the engine for the fee-gap comparison.",
    ].join("\n");
  }

  if (ruleId === "MFR-BIL-15" || ruleId === "R083") {
    const basisAmount = typeof sample.basis_amount === "number" ? sample.basis_amount : null;
    const markupBps = typeof sample.contracted_markup_bps === "number" ? sample.contracted_markup_bps : null;
    const txnFee = typeof sample.contracted_per_txn_fee === "number" ? sample.contracted_per_txn_fee : null;
    const monthlyFee = typeof sample.contracted_monthly_fee === "number" ? sample.contracted_monthly_fee : null;
    const transactionCount = typeof sample.transaction_count === "number" ? sample.transaction_count : null;
    const markupComponent = typeof sample.expected_markup_component === "number" ? sample.expected_markup_component : null;
    const txnComponent = typeof sample.expected_txn_component === "number" ? sample.expected_txn_component : null;
    const monthlyComponent = typeof sample.expected_monthly_component === "number" ? sample.expected_monthly_component : null;
    const explicitSubstitution =
      basisAmount !== null &&
      markupBps !== null &&
      txnFee !== null &&
      monthlyFee !== null &&
      transactionCount !== null &&
      markupComponent !== null &&
      txnComponent !== null &&
      monthlyComponent !== null &&
      typeof sample.expected_fee_amount === "number"
        ? [
            "",
            "Substituted formula",
            `F_exp = (${formatMoneyLike(basisAmount)} x ${formatPlainNumber(markupBps / 100)}%) + (${formatPlainNumber(transactionCount)} x ${formatMoneyLike(txnFee)}) + ${formatMoneyLike(monthlyFee)}`,
            `= ${formatMoneyLike(markupComponent)} + ${formatMoneyLike(txnComponent)} + ${formatMoneyLike(monthlyComponent)}`,
            `= ${formatMoneyLike(sample.expected_fee_amount)}`,
            "",
            "Variance proof",
            `${formatMoneyLike(sample.actual_fee_amount)} - ${formatMoneyLike(sample.expected_fee_amount)} = ${formatMoneyLike(sample.unexplained_fee_delta)}`,
          ]
        : [];

    return [
      "Formula",
      "Δ = max(0, F_obs - F_exp)",
      "Variance_attributed = min(Δ, residual_variance_pool)",
      "",
      "Operands",
      `F_obs (observed processor fee total from statement) = ${formatMoneyLike(sample.actual_fee_amount)}`,
      `F_exp (expected governed fee total from sealed pricing terms) = ${formatMoneyLike(sample.expected_fee_amount)}`,
      `Δ stored on citation row as unexplained_fee_delta = ${formatMoneyLike(sample.unexplained_fee_delta)}`,
      `Variance_attributed = ${varianceDisplay}`,
      ...explicitSubstitution,
      "",
      sample.actual_fee_amount === null || sample.actual_fee_amount === undefined || sample.expected_fee_amount === null || sample.expected_fee_amount === undefined
        ? "This persisted citation row stores the final variance but does not store one or more intermediate operands. The engine therefore proved the variance at run time, but this specific row cannot reproduce every operand numerically."
        : "This row contains the actual operands used by the engine for the fee-gap comparison.",
    ].join("\n");
  }

  if (ruleId === "MFR-MRK-03" || ruleId === "R078" || ruleId === "R085") {
    return [
      "Formula",
      "observed_rate_bps = ((observed_fee_pool - fixed_txn_fee_pool - monthly_fee) / basis_amount) × 10,000",
      "delta_bps = observed_rate_bps - contracted_rate_bps",
      "Variance_attributed = basis_amount × delta_bps / 10,000",
      "",
      "Operands",
      `basis_amount = ${formatMoneyLike(sample.basis_amount)}`,
      `observed_rate_bps = ${formatMetricValue(sample.actual_rate_bps ?? sample.observed_rate_bps)} bps`,
      `contracted_rate_bps = ${formatMetricValue(sample.contracted_markup_bps ?? sample.contracted_rate_bps)} bps`,
      `delta_bps = ${formatMetricValue(sample.excess_rate_bps ?? sample.rate_delta_bps)} bps`,
      `Variance_attributed = ${varianceDisplay}`,
    ].join("\n");
  }

  if (ruleId === "MFR-MRK-05") {
    return [
      "Formula",
      "excess_per_txn = observed_per_txn_fee - contracted_per_txn_fee",
      "Variance_attributed = excess_per_txn × transaction_count",
      "",
      "Operands",
      `observed_per_txn_fee = ${formatMoneyLike(sample.observed_per_txn_fee)}`,
      `contracted_per_txn_fee = ${formatMoneyLike(sample.contracted_per_txn_fee)}`,
      `excess_per_txn = ${formatMoneyLike(sample.excess_per_txn_fee)}`,
      `transaction_count = ${formatMetricValue(sample.transaction_count)}`,
      `Variance_attributed = ${varianceDisplay}`,
    ].join("\n");
  }

  if (ruleId === "DSP-COM-04" || ruleId === "DSP-COM-05" || ruleId === "DSP-VAR-11") {
    return [
      "Formula",
      "observed_rate_pct = actual_commission / commission_base_amount × 100",
      "expected_commission = commission_base_amount × contracted_rate_pct / 100",
      "Variance_attributed = max(0, actual_commission - expected_commission)",
      "",
      "Operands",
      `commission_base_amount = ${formatMoneyLike(sample.commission_base_amount ?? sample.expected_commission_base ?? sample.basis_amount)}`,
      `actual_commission = ${formatMoneyLike(sample.actual_commission)}`,
      `contracted_rate_pct = ${formatMetricValue(sample.contracted_rate_pct)}%`,
      sample.observed_rate_pct !== undefined ? `Observed rate: ${formatMetricValue(sample.observed_rate_pct)}%` : null,
      sample.effective_rate_variance_pct !== undefined
        ? `Effective-rate variance: ${formatMetricValue(sample.effective_rate_variance_pct)}%`
        : null,
      sample.observed_commission_base !== undefined
        ? `Observed commission base used by source: ${formatMoneyLike(sample.observed_commission_base)}`
        : null,
      `Variance_attributed = ${varianceDisplay}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (varianceDisplay === "$0" || varianceDisplay === "$0.00") {
    return [
      detail ? `Stored outcome\n${detail}` : fallback,
      "",
      "Persisted input values",
      buildPersistedInputs(sample),
      `Variance_attributed = ${varianceDisplay}`,
    ].join("\n");
  }

  return [
    fallback,
    "",
    "Persisted input values",
    buildPersistedInputs(sample),
    `Variance_attributed = ${varianceDisplay}`,
  ].join("\n");
}

function buildRuleEvidence(
  ruleId: string,
  moduleId: "M01" | "M02" | "M03",
  sample: RuleCitationSample,
  evidenceRows: CaarEvidenceTrace[],
  fallback: string,
) {
  const processorSource = evidenceRows.find((row) =>
    row.artifactKey.includes(
      moduleId === "M01" ? "processor" : moduleId === "M02" ? "settlement" : "royalty",
    ),
  );
  const posSource = evidenceRows.find((row) => row.artifactKey.includes("pos"));
  const agreementSource = evidenceRows.find((row) => row.artifactKey.includes("agreement"));
  const bankSource = evidenceRows.find((row) => row.artifactKey.includes("bank"));

  function detectArtifactMismatch(row: CaarEvidenceTrace | undefined) {
    if (!row?.fileName) return null;
    const fileName = row.fileName.toLowerCase();
    const artifactKey = row.artifactKey.toLowerCase();

    if (artifactKey.includes("agreement") && (fileName.includes("statement") || fileName.includes("bank"))) {
      return "Warning: the file currently stored in the agreement slot looks like a statement or bank document. Verify the correct agreement PDF was uploaded.";
    }
    if (artifactKey.includes("bank") && fileName.includes("agreement")) {
      return "Warning: the file currently stored in the bank slot looks like an agreement PDF. Verify the correct bank evidence was uploaded.";
    }
    if (artifactKey.includes("processor") && fileName.includes("agreement")) {
      return "Warning: the file currently stored in the processor-source slot looks like an agreement PDF. Verify the correct processor source file was uploaded.";
    }
    if (artifactKey.includes("pos") && fileName.includes("agreement")) {
      return "Warning: the file currently stored in the POS slot looks like an agreement PDF. Verify the correct POS export was uploaded.";
    }

    return null;
  }

  function artifactLine(label: string, row: CaarEvidenceTrace | undefined, whatItSupplies: string) {
    if (!row) {
      return `${label}: no persisted upload row was linked to this CAAR for this source.`;
    }
    const mismatch = detectArtifactMismatch(row);
    const base = `${label} slot: ${row.fileName ?? row.label} (${row.trace}) -> ${whatItSupplies}`;
    return mismatch ? `${base}\n${mismatch}` : base;
  }

  const lines =
    moduleId === "M01"
      ? [
          artifactLine(
            "Processor Source Statement / PDF",
            processorSource,
            "observed fee totals, sales basis, transaction counts, and rate-side source metrics used by M01 rules",
          ),
          artifactLine(
            "Signed Merchant Agreement",
            agreementSource,
            "legal pricing terms that are sealed into contract config: markup bps, txn fee, monthly fee, chargeback fee, and related controls",
          ),
          bankSource
            ? artifactLine(
                "Bank Statement",
                bankSource,
                "deposit tie-out evidence used by reconciliation / release gates when applicable",
              )
            : null,
        ]
      : moduleId === "M02"
        ? [
          artifactLine(
            "DSP Settlement source",
            processorSource,
            "observed commission, payout, and settlement-side totals",
          ),
          artifactLine(
            "POS Export / Summary",
            posSource,
            "order counts, sales totals, and comparison-side basis metrics",
          ),
          artifactLine(
            "Signed DSP Agreement",
            agreementSource,
            "governed rate, commission-base, and payout terms sealed into contract config",
          ),
          bankSource
            ? artifactLine(
                "Bank Deposit Evidence",
                bankSource,
                "bank-side payout confirmation used by monthly final reconciliation",
              )
            : null,
        ]
        : [
          artifactLine(
            "Royalty Source Statement / Report",
            processorSource,
            "observed royalty totals, royalty basis metrics, period coverage, and adjustment-side inputs used by M03 rules",
          ),
          artifactLine(
            "POS Sales Export",
            posSource,
            "restaurant-side sales and basis evidence used to verify royalty-base correctness",
          ),
          artifactLine(
            "Signed Royalty / Franchise Agreement",
            agreementSource,
            "governed royalty rate, royalty basis, exclusions, and timing terms sealed into contract config",
          ),
          bankSource
            ? artifactLine(
                "Bank Deposit / Withdrawal Evidence",
                bankSource,
                "bank-side remittance evidence used by monthly final royalty reconciliation",
              )
            : null,
        ];

  if ("commission_base_field" in sample) {
    lines.push(`Stored commission-base field used by engine: ${formatMetricValue(sample.commission_base_field)}.`);
  }

  if (
    moduleId === "M01" &&
    (ruleId === "MFR-BIL-15" || ruleId === "R083")
  ) {
    lines.push(
      "For this fee-gap rule specifically:",
      "- actual_fee_amount comes from the processor statement fee total parsed into engine metrics.",
      "- expected_fee_amount is computed from sealed contract terms applied to governed source metrics.",
      "- unexplained_fee_delta is the residual positive gap after expected fees are subtracted from observed fees.",
    );
  }

  return [fallback, "", "Where the values came from", ...lines.filter(Boolean)].join("\n");
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
  moduleId: "M01" | "M02" | "M03";
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
  const csvArtifact = artifacts.find((artifact) =>
    artifact.key.includes(moduleId === "M01" ? "processor" : moduleId === "M02" ? "settlement" : "royalty"),
  );
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
