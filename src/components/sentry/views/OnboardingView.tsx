import { onboardingSteps } from "../data";
import { Badge, SectionCard } from "../ui/primitives";

export function OnboardingView({
  completed,
  onToggleChecklist,
  onOpenUploads,
  onOpenSchema,
}: {
  completed: Record<string, boolean[]>;
  onToggleChecklist: (stepId: string, itemIndex: number) => void;
  onOpenUploads: () => void;
  onOpenSchema: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              Operator Onboarding Workflow
            </div>
            <div className="text-sm text-[var(--muted)]">
              Structured setup for locations, vendors, source evidence, and release readiness.
            </div>
          </div>
          <Badge tone="info">6-step flow</Badge>
        </div>
      </SectionCard>

      <div className="grid gap-4">
        {onboardingSteps.map((step, index) => (
          <SectionCard key={step.id}>
            <div className="grid gap-5 lg:grid-cols-[80px_1fr_220px] lg:items-start">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] font-[family-name:var(--font-mono)] text-sm font-bold text-white">
                {index + 1}
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                  {step.title}
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.description}</div>
                <div className="mt-4 grid gap-2">
                  {step.checklist.map((item, itemIndex) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onToggleChecklist(step.id, itemIndex)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm ${
                        completed[step.id]?.[itemIndex]
                          ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.05)]"
                          : "border-[var(--border)] bg-[var(--surface)]"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                          completed[step.id]?.[itemIndex]
                            ? "border-[var(--success)] bg-[var(--success)] text-white"
                            : "border-[var(--border)] bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onOpenUploads}
                  className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Open Upload Center
                </button>
                <button
                  type="button"
                  onClick={onOpenSchema}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Open Schema Registry
                </button>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
