import type { IntakeState, UploadArtifact } from "../types";
import { Badge, SectionCard } from "../ui/primitives";
import { AccessibleDialog } from "../ui/AccessibleDialog";

const checklistLabels = [
  { key: "uploaded", label: "File received", detail: "Native source file captured without reformatting." },
  { key: "hash", label: "SHA-256 verified", detail: "Integrity hash recorded for chain of custody." },
  { key: "schema", label: "Schema columns matched", detail: "Uploaded structure matches the active schema workspace." },
  { key: "fields", label: "Required fields present", detail: "All mandatory fields are present for certification use." },
] as const;

export function UploadChecklistModal({
  artifact,
  intake,
  moduleId,
  onClose,
  vendorName,
}: {
  artifact: UploadArtifact;
  intake: IntakeState;
  moduleId: "M01" | "M02";
  onClose: () => void;
  vendorName?: string;
}) {
  const complete = intake.uploaded && intake.hash && intake.schema && intake.fields;

  return (
    <AccessibleDialog ariaLabel={`Upload checklist for ${artifact.label}`} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              Artifact Checklist
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {moduleId} | {vendorName ? `${vendorName} | ` : ""}{artifact.label}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {checklistLabels.map((item) => {
              const done = intake[item.key];
              return (
                <div
                  key={item.key}
                  className={`rounded-2xl border p-4 ${
                    done
                      ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.05)]"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{item.label}</div>
                    <Badge tone={done ? "success" : "warning"}>{done ? "Complete" : "Pending"}</Badge>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</div>
                </div>
              );
            })}

            {intake.matchPct !== undefined && intake.matchPct < 60 ? (
              <div className="rounded-2xl border border-[rgba(212,131,10,0.4)] bg-[rgba(214,48,49,0.07)] p-4">
                <div className="text-sm font-semibold text-[var(--accent)]">
                  {intake.fileName ?? artifact.label} - partial schema match ({intake.matchPct}%)
                </div>
                <div className="mt-1 text-xs text-[var(--text)]">
                  {formatBytes(intake.sizeBytes ?? 0)} - {intake.rows ?? 0} rows - {intake.matchedColumns ?? 0}/
                  {intake.expectedColumns ?? 0} columns matched
                </div>
                {intake.unmatchedHeaders?.length ? (
                  <div className="mt-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--accent)]">
                    Unmatched: {intake.unmatchedHeaders.slice(0, 5).join(", ")}
                    {intake.unmatchedHeaders.length > 5 ? ` + ${intake.unmatchedHeaders.length - 5} more` : ""}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <SectionCard className="bg-[var(--surface)]">
              <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                Release Readiness
              </div>
              <div className="mt-3">
                <Badge tone={complete ? "success" : "warning"}>
                  {complete ? "Ready for certification" : "Further intake work required"}
                </Badge>
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {complete
                  ? "All intake gates are complete. This artifact can be used by the certification engine."
                  : "Advance the remaining intake gates before relying on this artifact for Trust Score or CAAR output."}
              </div>
            </SectionCard>

            <SectionCard>
              <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                Intake Status
              </div>
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {artifact.label} - intake status
                </div>
                <div className="space-y-2">
                  {checklistLabels.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          intake[item.key]
                            ? "bg-[var(--success)] shadow-[0_0_4px_rgba(34,197,94,0.5)]"
                            : "bg-[var(--border)]"
                        }`}
                      />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                <div>Vendor: {vendorName ?? intake.vendorName ?? "Not specified"}</div>
                <div>File: {intake.fileName ?? "Not uploaded"}</div>
                <div>Rows / pages: {intake.rows ?? "Pending"}</div>
                <div>Hash: {intake.hashValue ?? "Pending"}</div>
                <div>Schema match: {intake.matchPct !== undefined ? `${intake.matchPct}%` : "Pending"}</div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </AccessibleDialog>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
