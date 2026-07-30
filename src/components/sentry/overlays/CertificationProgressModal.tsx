export function CertificationProgressModal({
  cadence,
  locationName,
  moduleId,
}: {
  cadence: "monthly_final" | "weekly_preliminary";
  locationName: string;
  moduleId: "M01" | "M02";
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="status"
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
            {moduleId} · {cadence === "weekly_preliminary" ? "Weekly Preliminary" : "Monthly Final"}
          </div>
        </div>

        <div className="px-7 py-8">
          <div className="flex items-center gap-5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-[rgba(214,48,49,0.12)]" />
              <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text)]">Running deterministic checks</div>
              <div className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Validating governed evidence, executing rules, calculating trust dimensions, and persisting the CAAR trace.
              </div>
            </div>
          </div>

          <div className="mt-7 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
          <div className="mt-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Keep this window open · the result will appear automatically
          </div>
        </div>
      </div>
    </div>
  );
}
