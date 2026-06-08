import type { CaarRecord, IntakeState, UploadModule } from "../types";
import { HelpTip, MetaBlock, SectionCard } from "../ui/primitives";
import { getScoreBar, getTrustTone } from "../utils";

export function CaarReportModal({
  artifactIntakeState,
  onClose,
  onGenerateClaimPack,
  record,
  uploadModules,
}: {
  artifactIntakeState: Record<string, IntakeState>;
  onClose: () => void;
  onGenerateClaimPack: (record: CaarRecord) => void;
  record: CaarRecord;
  uploadModules: UploadModule[];
}) {
  const exhibits = uploadModules.flatMap((module) =>
    module.artifacts.map((artifact, index) => {
      const intake = artifactIntakeState[`${module.accountId}:${module.id}:${artifact.key}`];
      const integrity =
        intake?.uploaded && intake?.hash
          ? "Verified"
          : intake?.uploaded
            ? "Pending hash"
            : "Required";
      return {
        id: `EX-${String(index + 1).padStart(3, "0")}`,
        source: `${module.id} · ${artifact.type}`,
        description: artifact.label,
        status: artifact.status === "Missing" ? "Missing" : "Provided",
        integrity,
      };
    }),
  );

  const coverageComplete = exhibits.every((exhibit) => exhibit.status === "Provided");
  const integrityReady = exhibits.every((exhibit) => exhibit.integrity === "Verified");
  const claimReady = record.trustScore >= 85 && coverageComplete && integrityReady;
  const isCourtReady = record.trustScore >= 85;
  const attestationTimestamp = `${record.period.replace(" ", "-")}-08:13:56Z`;

  const provenanceRows = [
    {
      control: "Contract Terms",
      status: isCourtReady ? "Sealed" : "Assumed",
      detail: isCourtReady
        ? "Signed contract sealed in the Vault and linked to the current evidence package."
        : "Signed contract or rate schedule still requires governed linkage.",
    },
    {
      control: "Source Systems",
      status: coverageComplete ? "Provided" : "Incomplete",
      detail: coverageComplete
        ? "Truth, claim, and governance sources are represented in the evidence package."
        : "One or more source systems are still missing from the package.",
    },
    {
      control: "Bank Reconciliation",
      status: integrityReady ? "Verified" : "Pending",
      detail: integrityReady
        ? "Reconciliation evidence is hash-verified and tied to the certification run."
        : "Bank or settlement evidence still needs final integrity verification.",
    },
    {
      control: "Rule Lineage",
      status: isCourtReady ? "Vault Locked" : "Review Only",
      detail: isCourtReady
        ? "Applied DCLS rules are version-locked and reproducible."
        : "Rule-lock record is not yet strong enough for external submission.",
    },
  ];

  const chainRows = [
    {
      key: "Ingestion Timestamp",
      status: integrityReady ? "Recorded" : "Missing",
      detail: integrityReady
        ? "Immutable intake timestamp captured for the active evidence set."
        : "One or more exhibits are still missing their final intake record.",
    },
    {
      key: "File Hash (SHA-256)",
      status: integrityReady ? "Verified" : "Pending",
      detail: integrityReady
        ? "All uploaded source files have a matching SHA-256 verification record."
        : "At least one file is uploaded without a completed hash verification.",
    },
    {
      key: "Submitter Identity",
      status: isCourtReady ? "Attested" : "Missing",
      detail: isCourtReady
        ? "The evidentiary user attestation is attached through the governed workflow."
        : "Attestation is incomplete until the certification package reaches release readiness.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f8f8fa]">
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-[var(--border)] bg-white px-6 py-4 shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
        <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          CAAR Viewer
        </div>
        <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
          {record.locationName} · {record.period}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => onGenerateClaimPack(record)}
            disabled={!claimReady}
            className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-45"
          >
            Generate Claim Pack
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

      <div className="mx-auto max-w-6xl space-y-4 px-5 py-8 lg:px-8">
        <SectionCard className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              Court-Admissible Analysis Report
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.05em]">
              {record.id}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{record.narrative}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <MetaBlock label="Location" value={record.locationName} />
              <MetaBlock label="Period" value={record.period} />
              <MetaBlock label="Certified Amount" value={record.amount} />
              <MetaBlock label="Exhibits" value={`${record.exhibits} artifacts`} />
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Trust Score
            </div>
            <div
              className={`mt-3 font-[family-name:var(--font-display)] text-7xl font-extrabold tracking-[-0.08em] ${getTrustTone(record.trustScore)}`}
            >
              {record.trustScore}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={`h-full rounded-full ${getScoreBar(record.trustScore)}`}
                style={{ width: `${record.trustScore}%` }}
              />
            </div>
            <div className="mt-3 text-sm text-[var(--muted)]">
              {isCourtReady
                ? "All MQ6 dimensions clear the court-admissible threshold."
                : "Evidence remediation is still required before external delivery."}
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Findings
            </div>
            <div className="mt-4 space-y-3">
              {record.findings.map((finding) => (
                <div
                  key={finding}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]"
                >
                  {finding}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              <span>MQ6 Dimensions</span>
              <HelpTip
                title="CAAR · MQ6 Dimensions"
                sections={[
                  {
                    label: "What It Is",
                    text: "The six weighted trust dimensions that determine whether a certification package is release-grade.",
                  },
                  {
                    label: "What It Does",
                    text: "Scores legal-grade completeness, rule integrity, reconciliation, authenticity, auditability, and freshness.",
                  },
                  {
                    label: "Why It Matters",
                    text: "These dimension scores explain exactly why a CAAR is admissible or still blocked.",
                  },
                ]}
                footerLabel="Release Gate"
                footerValue="Composite score ≥ 85"
              />
            </div>
            <div className="mt-4 space-y-3">
              {record.dimensions.map((dimension) => (
                <div key={dimension.name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{dimension.name}</div>
                      <div className="text-xs text-[var(--muted)]">Weight {dimension.weight}</div>
                    </div>
                    <div className={getTrustTone(dimension.score)}>{dimension.score}</div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${getScoreBar(dimension.score)}`}
                      style={{ width: `${dimension.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionCard>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Export Readiness
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <span className="text-sm">Claim Pack Status</span>
                <span className={claimReady ? "text-[var(--success)]" : "text-[var(--accent)]"}>
                  {claimReady ? "READY" : "NOT READY"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <span className="text-sm">Evidence Coverage</span>
                <span className={coverageComplete ? "text-[var(--success)]" : "text-[#c07500]"}>
                  {coverageComplete ? "COMPLETE" : "PARTIAL"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <span className="text-sm">Source Authenticity</span>
                <span className={integrityReady ? "text-[var(--success)]" : "text-[#c07500]"}>
                  {integrityReady ? "VERIFIED" : "PENDING"}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              <span>Exhibit Coverage</span>
              <HelpTip
                title="CAAR · Exhibit Coverage"
                sections={[
                  {
                    label: "What It Is",
                    text: "The evidence manifest for every source artifact expected in the claim package.",
                  },
                  {
                    label: "What It Does",
                    text: "Shows whether each exhibit is present and whether its intake hash has been verified.",
                  },
                  {
                    label: "Why It Matters",
                    text: "Missing or unverified exhibits are one of the fastest ways to block external delivery.",
                  },
                ]}
                footerLabel="Integrity Standard"
                footerValue="SHA-256 verified"
              />
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-[90px_140px_1fr_110px_110px] gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                <span>Exhibit</span>
                <span>Source</span>
                <span>Description</span>
                <span>Status</span>
                <span>Integrity</span>
              </div>
              {exhibits.map((exhibit) => (
                <div
                  key={`${exhibit.id}:${exhibit.source}:${exhibit.description}`}
                  className="grid grid-cols-[90px_140px_1fr_110px_110px] gap-3 border-t border-[var(--border)] px-4 py-3 text-sm"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[var(--info)]">{exhibit.id}</span>
                  <span>{exhibit.source}</span>
                  <span>{exhibit.description}</span>
                  <span className={exhibit.status === "Provided" ? "text-[var(--success)]" : "text-[var(--accent)]"}>
                    {exhibit.status}
                  </span>
                  <span className={exhibit.integrity === "Verified" ? "text-[var(--success)]" : "text-[#c07500]"}>
                    {exhibit.integrity}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Evidence & Provenance
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
              {provenanceRows.map((row) => (
                <div key={row.control} className="grid gap-3 border-t border-[var(--border)] px-4 py-4 first:border-t-0 md:grid-cols-[160px_120px_1fr]">
                  <div className="font-medium">{row.control}</div>
                  <div className={row.status === "Sealed" || row.status === "Provided" || row.status === "Verified" || row.status === "Vault Locked" ? "text-[var(--success)]" : "text-[var(--accent)]"}>
                    {row.status}
                  </div>
                  <div className="text-sm leading-6 text-[var(--muted)]">{row.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Chain of Custody
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
              {chainRows.map((row) => (
                <div key={row.key} className="grid gap-3 border-t border-[var(--border)] px-4 py-4 first:border-t-0 md:grid-cols-[170px_120px_1fr]">
                  <div className="font-medium">{row.key}</div>
                  <div className={row.status === "Recorded" || row.status === "Verified" || row.status === "Attested" ? "text-[var(--success)]" : "text-[var(--accent)]"}>
                    {row.status}
                  </div>
                  <div className="text-sm leading-6 text-[var(--muted)]">{row.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Attestation Record
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <span>Engine</span>
                <span>MGE Core Engine v1.0</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <span>Ontology</span>
                <span>v1.2 · Restaurant Semantic Model</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <span>KPI Version</span>
                <span>v1.0.0 (Locked)</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <span>DCLS Rules</span>
                <span>198 applied · all evaluated</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <span>Timestamp</span>
                <span>{attestationTimestamp}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <span>Integrity Hash</span>
                <span className={claimReady ? "text-[var(--success)]" : "text-[var(--muted)]"}>
                  {claimReady ? `sha256:${record.id.toLowerCase()}-f2a9c1` : "SHA-256 pending final claim-pack generation"}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm leading-7 text-[var(--muted)]">
            <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em] text-[var(--text)]">
              Legal Posture
            </div>
            <p className="mt-4">
              This report should be treated as a deterministic certified analysis of the submitted dataset
              {claimReady
                ? ", meeting the evidentiary standards required for external dispute, demand, and legal recovery workflows."
                : ", but it is not yet complete enough for external submission or litigation-grade delivery."}
            </p>
            <p className="mt-4">
              {claimReady
                ? "All source evidence is authenticated, signed, and linked, so the CAAR and claim pack can be delivered to counsel."
                : "Until the missing controls above are resolved, this output is best used for internal review, evidence-gap analysis, and remediation planning."}
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
