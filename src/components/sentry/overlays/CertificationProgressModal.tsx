import { AccessibleDialog } from "../ui/AccessibleDialog";

export function CertificationProgressModal({
  cadence,
  certificationMonth,
  locationName,
  moduleId,
  phase,
}: {
  cadence: "monthly_final" | "weekly_preliminary";
  certificationMonth: string;
  locationName: string;
  moduleId: "M01" | "M02";
  phase: "preparing" | "certifying" | "applying" | "refreshing";
}) {
  const phaseIndex = ["preparing", "certifying", "applying", "refreshing"].indexOf(phase);
  const phases = [
    { detail: "Locking the location, module, provider, and certification month.", label: "Prepare governed scope" },
    { detail: "Validating evidence, executing rules, calculating trust, and persisting the CAAR.", label: "Run certification engine" },
    { detail: "Applying the certified result to the active workspace.", label: "Apply certification result" },
    { detail: "Refreshing restaurants, saved CAARs, and the audit log.", label: "Synchronize workspace" },
  ];
  const activePhase = phases[phaseIndex] ?? phases[0];
  const determinateProgress = [12, 38, 82, 94][phaseIndex] ?? 12;

  return (
    <AccessibleDialog
      ariaLabel="Certification in progress"
      closeOnEscape={false}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      aria-live="polite"
      aria-label={`Running ${moduleId} certification for ${locationName}`}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="border-b border-[var(--border)] px-7 py-6">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            MGE Certification Engine
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.05em] text-[var(--text)]">
            Certifying {locationName}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {moduleId} · {cadence === "weekly_preliminary" ? "Weekly Preliminary" : "Monthly Final"} · {certificationMonth}
          </div>
        </div>

        <div className="px-7 py-8">
          <div className="flex items-center gap-5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(214,48,49,0.12)]" />
              <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text)]">{activePhase.label}</div>
              <div className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {activePhase.detail}
              </div>
            </div>
          </div>

          <div
            className="mt-7 h-2 overflow-hidden rounded-full bg-[var(--surface)]"
            role="progressbar"
            aria-label="Certification progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phase === "certifying" ? undefined : determinateProgress}
            aria-valuetext={`${activePhase.label} in progress`}
          >
            {phase === "certifying" ? (
              <div className="certification-progress-indeterminate h-full w-1/3 rounded-full bg-[var(--accent)]" />
            ) : (
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
                style={{ width: `${determinateProgress}%` }}
              />
            )}
          </div>

          <div className="mt-6 space-y-3">
            {phases.map((item, index) => {
              const done = index < phaseIndex;
              const current = index === phaseIndex;
              return (
                <div key={item.label} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      done
                        ? "bg-[var(--success)] text-white"
                        : current
                          ? "animate-pulse bg-[var(--accent)] text-white"
                          : "bg-[var(--surface)] text-[var(--muted)]"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <div>
                    <div className={current ? "font-semibold text-[var(--text)]" : "text-[var(--muted)]"}>
                      {item.label} {current ? "— in progress" : done ? "— complete" : ""}
                    </div>
                    {current ? <div className="mt-1 leading-5 text-[var(--muted)]">{item.detail}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Keep this window open · the result will appear automatically
          </div>
        </div>
      </div>
    </AccessibleDialog>
  );
}
