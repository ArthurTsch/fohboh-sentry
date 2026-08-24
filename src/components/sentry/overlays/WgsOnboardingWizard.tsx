import { wgsOnboardingSteps } from "../data";
import type { LocationRecord, WgsOnboardingProgress, WgsOnboardingStep } from "../types";
import { Badge } from "../ui/primitives";
import { AccessibleDialog } from "../ui/AccessibleDialog";

function buildEmptyChecks(step: WgsOnboardingStep) {
  return step.items?.map(() => false) ?? [];
}

function getActiveModules(location: LocationRecord) {
  return location.modules
    .map((module) => module.label)
    .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");
}

function buildVisibleOnboardingSteps(location: LocationRecord) {
  const activeModules = getActiveModules(location);
  const steps = wgsOnboardingSteps
    .filter((step) => {
      if (step.type === "upload-m01" || step.type === "upload-m02") return false;
      return true;
    })
    .map((step) => {
      if (step.type !== "checklist" || !step.items?.length) {
        return step;
      }

      const filteredItems = step.items.filter((item) => {
        const label = item.label.toUpperCase();
        if (label.includes("M01")) return activeModules.includes("M01");
        if (label.includes("M02")) return activeModules.includes("M02");
        return true;
      });

      return {
        ...step,
        items: filteredItems,
      };
    });

  return steps.map((step, index) => ({
    ...step,
    eyebrow: step.eyebrow.replace(/Step \d+ of \d+/i, `Step ${index + 1} of ${steps.length}`),
  }));
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
  const visibleSteps = buildVisibleOnboardingSteps(location);
  const safeStepIndex = Math.max(0, Math.min(progress.stepIndex, Math.max(visibleSteps.length - 1, 0)));
  const currentStep = visibleSteps[safeStepIndex] ?? visibleSteps[0];
  const totalSteps = visibleSteps.length;
  const visibleChecklistStats = visibleSteps.slice(0, safeStepIndex + 1).reduce(
    (stats, step) => {
      const items = step.items ?? [];
      const checks = progress.checks[step.id] ?? buildEmptyChecks(step);
      return {
        completed: stats.completed + checks.slice(0, items.length).filter(Boolean).length,
        total: stats.total + items.length,
      };
    },
    { completed: 0, total: 0 },
  );
  const checklistCount = visibleChecklistStats.completed;
  const currentStepItems = currentStep?.items ?? [];
  const currentStepChecks = currentStep
    ? progress.checks[currentStep.id] ?? buildEmptyChecks(currentStep)
    : [];
  const currentStepFraction =
    currentStepItems.length > 0
      ? currentStepChecks.slice(0, currentStepItems.length).filter(Boolean).length /
        currentStepItems.length
      : 0;
  const progressPercent = progress.completed
    ? 100
    : Math.round(((safeStepIndex + currentStepFraction) / Math.max(totalSteps, 1)) * 100);

  function patchProgress(patch: Partial<WgsOnboardingProgress>) {
    onChange({ ...progress, ...patch });
  }

  function toggleChecklist(stepId: string, itemIndex: number) {
    const step = visibleSteps.find((item) => item.id === stepId);
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

  return (
    <AccessibleDialog ariaLabel={`Onboarding ${location.name}`} closeOnEscape={false} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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
              {checklistCount} checklist items completed
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {visibleSteps.map((step, index) => {
              const isDone = index < safeStepIndex || (index === safeStepIndex && progress.completed);
              const isActive = index === safeStepIndex;
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
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-5">
            <div className="text-sm text-[var(--muted)]">
              {location.status === "Onboarding"
                ? "This wizard covers setup and governance only. Real certification evidence must be uploaded later in Upload Data."
                : "Location already exists in a non-onboarding state; this wizard is acting as a governed remediation path. Real evidence still belongs in Upload Data."}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToStep(progress.stepIndex - 1)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:opacity-40"
                disabled={safeStepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (safeStepIndex === totalSteps - 1) {
                    onChange({ ...progress, completed: true });
                    onComplete();
                    return;
                  }
                  goToStep(safeStepIndex + 1);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  safeStepIndex === totalSteps - 1
                    ? "bg-[var(--success)] hover:opacity-90"
                    : "bg-[var(--text)] hover:bg-[var(--accent)]"
                }`}
              >
                {safeStepIndex === totalSteps - 1 ? "Complete Onboarding" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AccessibleDialog>
  );
}
