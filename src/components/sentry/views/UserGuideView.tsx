import { guidePhases } from "../data";
import { SectionCard } from "../ui/primitives";

export function UserGuideView() {
  return (
    <div className="space-y-6">
      {guidePhases.map((phase) => (
        <SectionCard key={phase.id}>
          <div className="mb-4 flex items-center gap-4 border-b border-[var(--border)] pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] font-[family-name:var(--font-mono)] text-xs font-bold text-white">
              {phase.id}
            </div>
            <div>
              <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                {phase.title}
              </div>
              <div className="text-sm text-[var(--muted)]">{phase.subtitle}</div>
            </div>
          </div>

          {phase.callout ? (
            <div className="mb-4 rounded-r-2xl border border-[rgba(214,48,49,0.18)] border-l-[3px] border-l-[var(--accent)] bg-[rgba(214,48,49,0.04)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
              {phase.callout}
            </div>
          ) : null}

          <div className="space-y-3">
            {phase.steps.map((step) => (
              <div key={step.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex gap-4">
                  <div className="font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--accent)]">
                    {step.id}
                  </div>
                  <div>
                    <div className="font-medium">{step.title}</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{step.text}</div>
                    <div className="mt-3 inline-flex rounded-full border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                      {step.where}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
