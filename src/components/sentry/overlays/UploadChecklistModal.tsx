import type { IntakeState, UploadArtifact } from "../types";
import { Badge, SectionCard } from "../ui/primitives";

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
}: {
  artifact: UploadArtifact;
  intake: IntakeState;
  moduleId: "M01" | "M02";
  onClose: () => void;
}) {
  const complete = intake.uploaded && intake.hash && intake.schema && intake.fields;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              Artifact Checklist
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {moduleId} · {artifact.label}
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

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
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
                Intake Record
              </div>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <div>File: {intake.fileName ?? "Not uploaded"}</div>
                <div>Rows / pages: {intake.rows ?? "Pending"}</div>
                <div>Hash: {intake.hashValue ?? "Pending"}</div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
