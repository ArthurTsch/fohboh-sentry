import { contractInputDefinitions } from "../data";
import type { IntakeState, UploadModule } from "../types";
import { Badge, HelpTip, SectionCard } from "../ui/primitives";

const intakeSteps = [
  { key: "uploaded", label: "Upload", detail: "Native file captured without reformatting." },
  { key: "hash", label: "Hash", detail: "SHA-256 integrity recorded for chain of custody." },
  { key: "schema", label: "Schema", detail: "Artifact structure matched to the active workspace." },
  { key: "fields", label: "Fields", detail: "Required certification fields verified." },
] as const;

export function UploadCenterView({
  contractState,
  intakeState,
  modules,
  onArtifactAction,
  onOpenChecklist,
  onOpenSchema,
}: {
  contractState: Record<string, Record<string, string>>;
  intakeState: Record<string, IntakeState>;
  modules: UploadModule[];
  onArtifactAction: (moduleId: "M01" | "M02", artifactKey: string) => void;
  onOpenChecklist: (moduleId: "M01" | "M02", artifactKey: string) => void;
  onOpenSchema: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard className="bg-[var(--surface)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              <span>Upload Data</span>
              <HelpTip
                title="Upload Data / Workflow"
                sections={[
                  {
                    label: "What It Is",
                    text: "The same evidence intake workflow launched from Location Waterfall, now exposed as a consolidated operational workspace.",
                  },
                  {
                    label: "What It Does",
                    text: "Combines file upload, manual contract entry, intake-gate progress, and schema follow-up into one guided module flow.",
                  },
                  {
                    label: "Why It Matters",
                    text: "Certification quality depends on native uploads, verified integrity, and complete contract truth. Splitting those steps across disconnected screens causes mistakes.",
                  },
                ]}
                footerLabel="Unified Flow"
                footerValue="Upload -> Hash -> Schema -> Contract -> Certify"
              />
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              This page now uses the same intake logic as the row-level upload workflow. Work module by module, finish the intake
              gates, and only then move to certification.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSchema}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Open Schema Registry
          </button>
        </div>
      </SectionCard>

      {modules.map((module) => {
        const readyCount = module.artifacts.filter((artifact) => artifact.status === "Ready").length;

        return (
          <SectionCard key={`${module.accountId}-${module.id}`} className="overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                    <span>{module.id} / {module.title}</span>
                    <HelpTip
                      title="Upload Data / Module Intake"
                      sections={[
                        {
                          label: "What It Is",
                          text: "Module-specific intake for CSV, PDF, and contract configuration artifacts needed by the certification engine.",
                        },
                        {
                          label: "What It Does",
                          text: "Lets the operator complete the same operational path as the original upload modal while keeping artifact readiness visible in one place.",
                        },
                        {
                          label: "Why It Matters",
                          text: "Weak intake and incomplete contract inputs are among the fastest ways to suppress Trust Score and block CAAR release.",
                        },
                      ]}
                      footerLabel="Module Readiness"
                      footerValue={`${readyCount} of ${module.artifacts.length} artifacts ready`}
                    />
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">{module.subtitle}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
                  <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em]">
                    Flow Rule
                  </div>
                  <div className="mt-1">Use the artifact workflow first, then review the checklist, then return to certification.</div>
                </div>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              {module.artifacts.map((artifact, index) => {
                const stateKey = `${module.accountId}:${module.id}:${artifact.key}`;
                const intake = intakeState[stateKey] ?? {
                  uploaded: false,
                  hash: false,
                  schema: false,
                  fields: false,
                };
                const values = contractState[stateKey] ?? {};
                const requiredFields =
                  artifact.type === "Manual Entry"
                    ? contractInputDefinitions[module.id].filter((field) => field.required)
                    : [];
                const completedFields = requiredFields.filter((field) => values[field.id]?.trim()).length;
                const intakeComplete = intake.uploaded && intake.hash && intake.schema && intake.fields;

                return (
                  <div
                    key={artifact.key}
                    className="border-t border-[var(--border)] p-6 first:border-t-0 lg:[&:nth-child(odd)]:border-r"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--panel-soft)] font-[family-name:var(--font-mono)] text-[11px] font-bold text-[var(--muted)]">
                            {index + 1}
                          </span>
                          <div>
                            <div className="font-medium text-[var(--text)]">{artifact.label}</div>
                            <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                              {artifact.type}
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{artifact.note}</p>
                      </div>
                      <Badge tone={artifactTone(artifact.status)}>{artifact.status}</Badge>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      {artifact.type === "Manual Entry"
                        ? contractSteps(completedFields, requiredFields.length).map((step) => (
                            <StepChip key={step.label} done={step.done} label={step.label} />
                          ))
                        : intakeSteps.map((step) => (
                            <StepChip key={step.key} done={intake[step.key]} label={step.label} />
                          ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                      {artifact.type === "Manual Entry" ? (
                        <>
                          <div className="font-medium text-[var(--text)]">Contract progress</div>
                          <div className="mt-2">
                            {completedFields} / {requiredFields.length} required fields completed
                          </div>
                          <div className="mt-2">
                            Contract Config should only be treated as ready when the required fields are complete and governance review is done.
                          </div>
                        </>
                      ) : intake.fileName ? (
                        <>
                          <div className="font-medium text-[var(--text)]">Current intake record</div>
                          <div className="mt-2">File: {intake.fileName}</div>
                          <div>Rows / pages: {intake.rows ?? "Pending"}</div>
                          <div>Hash: {intake.hashValue ?? "Pending"}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium text-[var(--text)]">Current intake record</div>
                          <div className="mt-2">{artifact.type === "PDF" ? "No source PDF uploaded yet." : "No source file uploaded yet."}</div>
                          <div className="mt-2">
                            {artifact.type === "CSV"
                              ? "Use the exact portal export. Do not open and resave in Excel. Manual entry is also available if the native file cannot be produced."
                              : "Upload the signed agreement or statement exactly as received. Manual entry is also available if source documentation must be reconstructed."}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onArtifactAction(module.id, artifact.key)}
                        className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                      >
                        {artifact.type === "Manual Entry"
                          ? "Open Contract Config"
                          : intakeComplete
                            ? "Review Upload or Manual Workflow"
                            : "Continue Upload or Manual Workflow"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenChecklist(module.id, artifact.key)}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                      >
                        View Checklist
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

function StepChip({ done, label }: { done: boolean; label: string }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-center text-[11px] font-medium ${
        done
          ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.06)] text-[var(--success)]"
          : "border-[var(--border)] bg-white text-[var(--muted)]"
      }`}
    >
      {label}
    </div>
  );
}

function contractSteps(completed: number, total: number) {
  return [
    { label: "Fields", done: completed > 0 },
    { label: "Required", done: total > 0 && completed >= Math.max(1, Math.ceil(total / 2)) },
    { label: "Verified", done: total > 0 && completed === total },
    { label: "Seal Ready", done: total > 0 && completed === total },
  ];
}

function artifactTone(status: UploadModule["artifacts"][number]["status"]) {
  if (status === "Ready") return "success";
  if (status === "Needs Review") return "warning";
  return "danger";
}
