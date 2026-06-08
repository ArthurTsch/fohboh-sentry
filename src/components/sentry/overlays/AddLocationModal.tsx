import { useMemo, useState } from "react";
import type { AddLocationDraft } from "../types";

const dspOptions = ["DoorDash", "Uber Eats", "Grubhub", "Slice"];
const processorOptions = ["Heartland", "Toast", "Square", "Worldpay", "Chase Paymentech", "Other"];
const posOptions = ["Toast", "Square", "Heartland", "Worldpay", "Chase Paymentech", "Other"];

export function AddLocationModal({
  initialDraft,
  onClose,
  onSubmit,
}: {
  initialDraft: AddLocationDraft;
  onClose: () => void;
  onSubmit: (draft: AddLocationDraft) => void;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<AddLocationDraft>(initialDraft);

  const plan = useMemo(() => {
    const items: string[] = [];
    if (draft.m01) {
      items.push(
        `Collect signed ${draft.processor} agreement and processor statements.`,
        "Verify M01 schema mappings and key contract terms with dual review.",
        "Seal Contract Config and run the first M01 certification cycle.",
      );
    }
    if (draft.m02) {
      items.push(
        `Collect settlement exports and signed agreements for ${draft.dsps.join(", ") || "selected DSPs"}.`,
        "Verify commission base mappings, delivery rates, and bank reconciliation evidence.",
        "Seal M02 schema state and run the first M02 certification cycle.",
      );
    }
    return items;
  }, [draft]);

  function next() {
    if (step === 1 && !draft.name.trim()) return;
    if (step === 2 && !draft.m01 && !draft.m02) return;
    if (step === 3) {
      onSubmit(draft);
      return;
    }
    setStep((current) => current + 1);
  }

  function back() {
    setStep((current) => Math.max(1, current - 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              Add Location
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">Step {step} of 3</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-3 border-b border-[var(--border)] bg-[var(--surface)]">
          {["Location", "Modules", "Onboarding"].map((label, index) => (
            <div
              key={label}
              className={`px-4 py-3 text-center font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] ${
                step === index + 1 ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Location Name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                  placeholder="e.g. Dominos - Irving Las Colinas"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Street Address</span>
                <input
                  value={draft.address}
                  onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Internal Location ID</span>
                  <input
                    value={draft.locId}
                    onChange={(event) => setDraft((current) => ({ ...current, locId: event.target.value }))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">POS System</span>
                  <select
                    value={draft.posSystem}
                    onChange={(event) => setDraft((current) => ({ ...current, posSystem: event.target.value }))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                  >
                    {posOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, m01: !current.m01 }))}
                  className={`rounded-2xl border p-4 text-left ${
                    draft.m01 ? "border-[var(--accent)] bg-[rgba(214,48,49,0.04)]" : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="font-semibold">M01 - Merchant Fee Recovery</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Processor interchange and markup variance workflow.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, m02: !current.m02 }))}
                  className={`rounded-2xl border p-4 text-left ${
                    draft.m02 ? "border-[var(--accent)] bg-[rgba(214,48,49,0.04)]" : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="font-semibold">M02 - Delivery Fee Recovery</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    DSP commission and reconciliation workflow.
                  </div>
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Card Processor</span>
                  <select
                    value={draft.processor}
                    onChange={(event) => setDraft((current) => ({ ...current, processor: event.target.value }))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                  >
                    {processorOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-2">
                  <span className="text-sm font-medium">DSP Platforms</span>
                  <div className="flex flex-wrap gap-2">
                    {dspOptions.map((dsp) => {
                      const selected = draft.dsps.includes(dsp);
                      return (
                        <button
                          key={dsp}
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              dsps: current.dsps.includes(dsp)
                                ? current.dsps.filter((item) => item !== dsp)
                                : [...current.dsps, dsp],
                            }))
                          }
                          className={`rounded-full border px-3 py-2 text-sm ${
                            selected ? "border-[var(--accent)] bg-[rgba(214,48,49,0.04)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                          }`}
                        >
                          {dsp}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.05)] p-4">
                <div className="font-semibold text-[var(--success)]">{draft.name || "New location"} ready to onboard</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  POS: {draft.posSystem} · Processor: {draft.processor} · DSPs: {draft.dsps.join(", ") || "None"}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Onboarding Plan
                </div>
                <div className="space-y-2">
                  {plan.map((item, index) => (
                    <div key={item} className="flex gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                      <span className="font-[family-name:var(--font-mono)] text-[var(--accent)]">{index + 1}.</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-5">
          <button
            type="button"
            onClick={back}
            className={`rounded-lg border border-[var(--border)] px-4 py-2 text-sm ${step === 1 ? "invisible" : "text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"}`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            {step === 3 ? "Start Onboarding" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
