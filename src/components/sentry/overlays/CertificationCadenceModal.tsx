export function CertificationCadenceModal({
  locationId,
  locations,
  locationName,
  onChangeLocation,
  onChangeModules,
  onClose,
  onSubmit,
  selectedModules,
  selectableModules,
}: {
  locationId: string;
  locations?: { id: string; name: string }[];
  locationName: string;
  onChangeLocation?: (locationId: string) => void;
  onChangeModules?: (modules: Array<"M01" | "M02">) => void;
  onClose: () => void;
  onSubmit: (cadence: "monthly_final" | "weekly_preliminary") => void | Promise<void>;
  selectedModules: Array<"M01" | "M02">;
  selectableModules: Array<{
    blockers: string[];
    enabled: boolean;
    moduleId: "M01" | "M02";
    ready: boolean;
  }>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="border-b border-[var(--border)] px-6 py-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Certification Cadence
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {locationName}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Choose the evidence path you want to certify before the engine runs.
          </div>
        </div>

        {locations && locations.length > 1 ? (
          <div className="border-b border-[var(--border)] px-6 py-5">
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Restaurant
            </div>
            <select
              value={locationId}
              onChange={(event) => onChangeLocation?.(event.target.value)}
              className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.id})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="border-b border-[var(--border)] px-6 py-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Module Scope
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {selectableModules.map((module) => {
              const selected = selectedModules.includes(module.moduleId);
              const disabled = !module.enabled || !module.ready;

              return (
                <button
                  key={module.moduleId}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = selected
                      ? selectedModules.filter((item) => item !== module.moduleId)
                      : [...selectedModules, module.moduleId];
                    onChangeModules?.(next);
                  }}
                  className={`rounded-[20px] border p-4 text-left transition ${
                    disabled
                      ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface)] opacity-60"
                      : selected
                        ? "border-[var(--text)] bg-[var(--text)] text-white"
                        : "border-[var(--border)] bg-white hover:border-[var(--text)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                      {module.moduleId}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      module.enabled
                        ? module.ready
                          ? selected
                            ? "bg-white/15 text-white"
                            : "border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                          : "border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                        : "border border-[var(--border)] bg-white text-[var(--muted)]"
                    }`}>
                      {!module.enabled ? "Disabled" : module.ready ? "Ready" : "Blocked"}
                    </span>
                  </div>
                  <div className={`mt-2 text-sm leading-6 ${selected && !disabled ? "text-white/80" : "text-[var(--muted)]"}`}>
                    {!module.enabled
                      ? "This location does not have this module enabled."
                      : module.ready
                        ? `Run ${module.moduleId} independently for this certification cycle.`
                        : module.blockers[0] ?? `${module.moduleId} still has unresolved prerequisites.`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
          <button
            type="button"
            disabled={selectedModules.length === 0}
            onClick={() => onSubmit("weekly_preliminary")}
            className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--text)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Weekly Preliminary
            </div>
            <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Early detection
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Runs the current evidence package without the final bank-reconciliation gate. Use this after weekly DSP or processor exports land.
            </div>
          </button>

          <button
            type="button"
            disabled={selectedModules.length === 0}
            onClick={() => onSubmit("monthly_final")}
            className="rounded-[24px] border border-[rgba(214,48,49,0.24)] bg-[rgba(214,48,49,0.04)] p-5 text-left transition hover:border-[var(--accent)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Monthly Final
            </div>
            <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Certified CAAR path
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Requires the full evidence package, including the matching bank statement. This is the only cadence that can clear final CAAR release.
            </div>
          </button>
        </div>

        <div className="flex justify-end border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
