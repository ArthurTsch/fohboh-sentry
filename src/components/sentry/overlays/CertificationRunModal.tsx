type CertificationStep = {
  detail: string;
  done: boolean;
  label: string;
};

export function CertificationRunModal({
  cadence,
  locationName,
  onClose,
  openCaar,
  ready,
  steps,
  trustScore,
}: {
  cadence: "monthly_final" | "weekly_preliminary";
  locationName: string;
  onClose: () => void;
  openCaar: () => void;
  ready: boolean;
  steps: CertificationStep[];
  trustScore: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="border-b border-[var(--border)] px-6 py-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            MGE Certification Engine
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {locationName}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {cadence === "weekly_preliminary"
              ? "Weekly Preliminary -> Semantic Truths -> Deterministic Law -> Loop A"
              : "Monthly Final -> Semantic Truths -> Deterministic Law -> Loop A -> Certify & Lock"}
          </div>
        </div>

        <div className="space-y-3 px-6 py-6">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  step.done ? "bg-[var(--success)] text-white" : "bg-white text-[var(--muted)]"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </div>
              <div>
                <div className="font-medium">{step.label}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{step.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-sm text-[var(--muted)]">Composite Trust Score</div>
            <div className={`font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[-0.06em] ${ready ? "text-[var(--success)]" : "text-[var(--accent)]"}`}>
              {trustScore}
            </div>
            <div className="text-sm text-[var(--muted)]">
              {ready
                ? "CAAR release threshold met. Claim-pack generation is available."
                : cadence === "weekly_preliminary"
                  ? "Preliminary certification completed. Monthly Final is still required for certified release."
                  : "Evidence or reconciliation gates still block certified release."}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openCaar}
              className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
            >
              Open CAAR
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
    </div>
  );
}
