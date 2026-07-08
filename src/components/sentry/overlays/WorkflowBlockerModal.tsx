import type { LocationWorkflowAction, WorkflowRequirementStatus } from "../types";

export function WorkflowBlockerModal({
  blockers,
  locationName,
  onClose,
  onOpenDiy,
  onOpenOnboarding,
  onOpenUploads,
  primaryAction,
  primaryLabel,
  requirements,
}: {
  blockers: string[];
  locationName: string;
  onClose: () => void;
  onOpenDiy: () => void;
  onOpenOnboarding: () => void;
  onOpenUploads: () => void;
  primaryAction: LocationWorkflowAction;
  primaryLabel: string;
  requirements: WorkflowRequirementStatus[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="border-b border-[var(--border)] px-6 py-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Certification Blocked
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {locationName}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Complete the missing governed setup below before running the next certification cycle.
          </div>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="grid gap-3 md:grid-cols-3">
            {requirements.map((requirement) => (
              <div
                key={`${locationName}:requirement:${requirement.key}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-[var(--text)]">{requirement.label}</div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      requirement.status === "complete"
                        ? "border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                        : requirement.status === "action_required"
                          ? "border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                          : "border border-[var(--border)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    {requirement.status === "complete"
                      ? "Complete"
                      : requirement.status === "action_required"
                        ? "Missing"
                        : "N/A"}
                  </span>
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{requirement.detail}</div>
              </div>
            ))}
          </div>

          {blockers.map((blocker, index) => (
            <div
              key={`${locationName}:blocker:${index}:${blocker}`}
              className="rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-4 text-sm leading-6 text-[var(--muted)]"
            >
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                Blocking Requirement {index + 1}
              </div>
              <div className="mt-2 text-[var(--text)]">{blocker}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-5">
          <button
            type="button"
            onClick={() => {
              runPrimaryAction(primaryAction, { onOpenDiy, onOpenOnboarding, onOpenUploads });
              onClose();
            }}
            className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenUploads();
              onClose();
            }}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Open Upload Data
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenDiy();
              onClose();
            }}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Open DIY Access
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function runPrimaryAction(
  action: LocationWorkflowAction,
  handlers: {
    onOpenDiy: () => void;
    onOpenOnboarding: () => void;
    onOpenUploads: () => void;
  },
) {
  if (action === "onboarding") {
    handlers.onOpenOnboarding();
    return;
  }

  if (action === "diy") {
    handlers.onOpenDiy();
    return;
  }

  handlers.onOpenUploads();
}
