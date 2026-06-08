import { useState } from "react";
import { emptyRequestAccessDraft } from "../data";
import type { RequestAccessDraft } from "../types";

export function RequestAccessModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (draft: RequestAccessDraft) => void;
}) {
  const [draft, setDraft] = useState<RequestAccessDraft>(emptyRequestAccessDraft);

  function toggleModule(moduleId: "M01" | "M02" | "M03") {
    setDraft((current) => ({
      ...current,
      modules: current.modules.includes(moduleId)
        ? current.modules.filter((item) => item !== moduleId)
        : [...current.modules, moduleId],
    }));
  }

  const valid = draft.company.trim() && draft.email.trim() && draft.modules.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              Request Access
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              Submit a new operator access request for WGS review.
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

        <div className="grid gap-4 p-6">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Organisation</span>
            <input
              value={draft.company}
              onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              placeholder="Dominos NTX - Dallas"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Primary contact email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              placeholder="ops@restaurant.com"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Number of locations</span>
            <input
              value={draft.locations}
              onChange={(event) => setDraft((current) => ({ ...current, locations: event.target.value }))}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
            />
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Requested modules</span>
            <div className="flex flex-wrap gap-2">
              {(["M01", "M02", "M03"] as const).map((moduleId) => {
                const active = draft.modules.includes(moduleId);
                return (
                  <button
                    key={moduleId}
                    type="button"
                    onClick={() => toggleModule(moduleId)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? "border-[var(--accent)] bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    {moduleId}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              className="min-h-28 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              placeholder="Share DSPs, processor details, or onboarding timing requirements."
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-6 py-5">
          <div className="text-xs text-[var(--muted)]">WGS review target: one business day.</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() => onSubmit(draft)}
              className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
            >
              Submit Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
