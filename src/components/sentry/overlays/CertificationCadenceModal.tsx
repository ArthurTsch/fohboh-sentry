export function CertificationCadenceModal({
  locationId,
  locations,
  locationName,
  onChangeLocation,
  onClose,
  onSubmit,
}: {
  locationId: string;
  locations?: { id: string; name: string }[];
  locationName: string;
  onChangeLocation?: (locationId: string) => void;
  onClose: () => void;
  onSubmit: (cadence: "monthly_final" | "weekly_preliminary") => void | Promise<void>;
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

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onSubmit("weekly_preliminary")}
            className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--text)] hover:bg-white"
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
            onClick={() => onSubmit("monthly_final")}
            className="rounded-[24px] border border-[rgba(214,48,49,0.24)] bg-[rgba(214,48,49,0.04)] p-5 text-left transition hover:border-[var(--accent)] hover:bg-white"
          >
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Monthly Final
            </div>
            <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Court-admissible path
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
