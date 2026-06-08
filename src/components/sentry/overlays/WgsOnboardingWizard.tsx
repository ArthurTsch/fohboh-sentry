import { wgsM01Vendors, wgsM02Vendors, wgsOnboardingSteps } from "../data";
import type { LocationRecord, WgsOnboardingProgress, WgsOnboardingStep, WgsVendorOption } from "../types";
import { Badge } from "../ui/primitives";

function buildEmptyChecks(step: WgsOnboardingStep) {
  return step.items?.map(() => false) ?? [];
}

function getUploadCopy(module: "M01" | "M02") {
  if (module === "M01") {
    return "Select the processor below, then upload the exact transaction-level CSV exported from the processor portal.";
  }
  return "Select each active DSP below, then upload the evidence bundle used for settlement, agreement, POS, and bank reconciliation.";
}

export function WgsOnboardingWizard({
  location,
  onChange,
  onClose,
  onComplete,
  progress,
}: {
  location: LocationRecord;
  onChange: (next: WgsOnboardingProgress) => void;
  onClose: () => void;
  onComplete: () => void;
  progress: WgsOnboardingProgress;
}) {
  const currentStep = wgsOnboardingSteps[progress.stepIndex] ?? wgsOnboardingSteps[0];
  const totalSteps = wgsOnboardingSteps.length;
  const checklistCount = Object.values(progress.checks).reduce(
    (sum, items) => sum + items.filter(Boolean).length,
    0,
  );
  const uploadCount = Object.keys(progress.uploads).length;
  const progressPercent = Math.round(((progress.stepIndex + 0.5) / totalSteps) * 100);

  function patchProgress(patch: Partial<WgsOnboardingProgress>) {
    onChange({ ...progress, ...patch });
  }

  function toggleChecklist(stepId: string, itemIndex: number) {
    const step = wgsOnboardingSteps.find((item) => item.id === stepId);
    if (!step?.items) return;
    const existing = progress.checks[stepId] ?? buildEmptyChecks(step);
    const next = existing.map((value, index) => (index === itemIndex ? !value : value));
    patchProgress({
      checks: {
        ...progress.checks,
        [stepId]: next,
      },
    });
  }

  function toggleVendor(moduleKey: "m01" | "m02", option: WgsVendorOption) {
    const existing = progress.selectedVendors[moduleKey];
    const next = existing.includes(option.key)
      ? existing.filter((value) => value !== option.key)
      : [...existing, option.key];
    patchProgress({
      selectedVendors: {
        ...progress.selectedVendors,
        [moduleKey]: next,
      },
    });
  }

  async function handleFileSelected(file: File, option: WgsVendorOption) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 12);
    const text = file.type.includes("text") || file.name.endsWith(".csv") ? await file.text() : "";
    const rows = text ? Math.max(text.split(/\r?\n/).filter(Boolean).length - 1, 0) : 0;

    patchProgress({
      uploads: {
        ...progress.uploads,
        [option.key]: {
          hash,
          module: option.module,
          name: file.name,
          rows,
          vendorName: option.name,
        },
      },
    });
  }

  function goToStep(nextIndex: number) {
    patchProgress({
      stepIndex: Math.max(0, Math.min(totalSteps - 1, nextIndex)),
    });
  }

  function renderChecklist(step: WgsOnboardingStep) {
    const stepChecks = progress.checks[step.id] ?? buildEmptyChecks(step);
    const items = step.items ?? [];
    const completed = stepChecks.filter(Boolean).length;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={completed === items.length ? "success" : "warning"}>
              {completed} / {items.length} complete
            </Badge>
            <Badge tone={completed === items.length ? "success" : "neutral"}>
              {completed === items.length ? "Step ready" : "Work in progress"}
            </Badge>
          </div>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => {
            const checked = stepChecks[index] ?? false;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => toggleChecklist(step.id, index)}
                className={`grid w-full gap-2 rounded-2xl border p-4 text-left transition ${
                  checked
                    ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.05)]"
                    : "border-[var(--border)] bg-white hover:border-[var(--text)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs ${
                      checked
                        ? "border-[var(--success)] bg-[var(--success)] text-white"
                        : "border-[var(--border)] bg-[var(--surface)] text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <div>
                    <div className="font-medium text-[var(--text)]">{item.label}</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.note}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderUploadStep(module: "M01" | "M02", selectedKeys: string[], options: WgsVendorOption[]) {
    const selectedOptions = options.filter((option) => selectedKeys.includes(option.key));
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
          {getUploadCopy(module)}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selectedKeys.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleVendor(module.toLowerCase() as "m01" | "m02", option)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active
                    ? "border-[var(--accent)] bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                }`}
              >
                {option.name}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => {
              const upload = progress.uploads[option.key];
              return (
                <label
                  key={option.key}
                  className={`block cursor-pointer rounded-3xl border-2 border-dashed p-5 transition ${
                    upload
                      ? "border-[rgba(0,200,83,0.28)] bg-[rgba(0,200,83,0.05)]"
                      : "border-[var(--border)] bg-white hover:border-[var(--accent)]"
                  }`}
                >
                  <input
                    type="file"
                    className="hidden"
                    accept={module === "M01" ? ".csv,text/csv,.txt" : ".csv,text/csv,.txt,.pdf,application/pdf"}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFileSelected(file, option);
                    }}
                  />
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-[var(--text)]">{option.name}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {module === "M01"
                          ? "Processor statement intake"
                          : "DSP evidence bundle for settlement, contract, POS, and bank proof"}
                      </div>
                    </div>
                    <Badge tone={upload ? "success" : "warning"}>{upload ? "Uploaded" : "Awaiting file"}</Badge>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {upload ? (
                      <>
                        <div>File: {upload.name}</div>
                        <div>Rows / pages: {upload.rows || "PDF bundle"}</div>
                        <div>SHA-256: {upload.hash}</div>
                      </>
                    ) : (
                      "Click to choose a file. The wizard will hash the upload and store a lightweight intake record."
                    )}
                  </div>
                </label>
              );
            })
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-10 text-center text-sm text-[var(--muted)]">
              Select at least one {module === "M01" ? "processor" : "DSP"} to begin intake.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
        <aside className="hidden w-[290px] flex-col border-r border-[var(--border)] bg-[var(--surface)] p-6 lg:flex">
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {location.name} - Onboarding
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {location.id} · {location.market}
          </div>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Step {progress.stepIndex + 1} of {totalSteps}</span>
              <span>{progressPercent}% complete</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-3 text-xs leading-5 text-[var(--muted)]">
              {checklistCount} checklist items completed · {uploadCount} intake files captured
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {wgsOnboardingSteps.map((step, index) => {
              const isDone = index < progress.stepIndex || (index === progress.stepIndex && progress.completed);
              const isActive = index === progress.stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-white text-[var(--text)] shadow-[0_8px_28px_rgba(0,0,0,0.05)]"
                      : "text-[var(--muted)] hover:bg-white/80"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      isDone
                        ? "bg-[var(--success)] text-white"
                        : isActive
                          ? "bg-[var(--accent)] text-white"
                          : "bg-white text-[var(--muted)]"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <div>
                    <div className="font-medium">{step.label}</div>
                    <div className="text-xs text-[var(--muted)]">{step.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                {currentStep.eyebrow}
              </div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                {currentStep.title}
              </div>
              <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                {currentStep.desc}
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

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {currentStep.type === "checklist" ? renderChecklist(currentStep) : null}
            {currentStep.type === "upload-m01"
              ? renderUploadStep("M01", progress.selectedVendors.m01, wgsM01Vendors)
              : null}
            {currentStep.type === "upload-m02"
              ? renderUploadStep("M02", progress.selectedVendors.m02, wgsM02Vendors)
              : null}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-5">
            <div className="text-sm text-[var(--muted)]">
              {location.status === "Onboarding"
                ? "This wizard mirrors the original WGS activation workflow from the HTML prototype."
                : "Location already exists in a non-onboarding state; the wizard is acting as a governed remediation path."}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToStep(progress.stepIndex - 1)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:opacity-40"
                disabled={progress.stepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (progress.stepIndex === totalSteps - 1) {
                    onChange({ ...progress, completed: true });
                    onComplete();
                    return;
                  }
                  goToStep(progress.stepIndex + 1);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  progress.stepIndex === totalSteps - 1
                    ? "bg-[var(--success)] hover:opacity-90"
                    : "bg-[var(--text)] hover:bg-[var(--accent)]"
                }`}
              >
                {progress.stepIndex === totalSteps - 1 ? "Complete Onboarding" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
