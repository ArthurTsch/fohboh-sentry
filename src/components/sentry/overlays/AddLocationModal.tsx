import { useMemo, useState } from "react";
import type { AddLocationDraft } from "../types";
import { HelpTip } from "../ui/primitives";
import { AccessibleDialog } from "../ui/AccessibleDialog";
import { getBankCatalog } from "../bank-catalog";
import { getVendorCatalog } from "../vendor-catalog";

const dspOptions = getVendorCatalog("M02").filter((vendor) => ["doordash", "ubereats", "grubhub", "slice"].includes(vendor.key));
const bankOptions = getBankCatalog();
const processorOptions = ["Heartland", "Toast", "Square", "Worldpay", "Chase Paymentech", "Other"];
const posOptions = ["Toast", "Square", "Heartland", "Worldpay", "Chase Paymentech", "Other"];
const stepHelp: {
  footerLabel: string;
  footerValue: string;
  sections: { label: string; text: string }[];
  title: string;
}[] = [
  {
    footerLabel: "Lead time",
    footerValue: "WGS contacts you within 1 business day",
    sections: [
      {
        label: "What It Is",
        text: "Basic identifying information about the new restaurant location.",
      },
      {
        label: "What It Does",
        text: "This data pre-fills the WGS onboarding package sent to your advisor and becomes the source-of-truth used by Upload Data, DIY Access, and certification workflows.",
      },
      {
        label: "Why It Matters",
        text: "The location name entered here will appear on all future CAARs and in the Activity Log.",
      },
    ],
    title: "Add Location / Step 1",
  },
  {
    footerLabel: "Required",
    footerValue: "Module activation only",
    sections: [
      {
        label: "What It Is",
        text: "Select which Sentry modules to activate, then configure only the POS, processor, DSP, and bank sources relevant to those modules.",
      },
      {
        label: "What It Does",
        text: "Module selection determines which saved sources must upload evidence, which Schema Registry entries WGS will configure, and which certification workflows are enabled.",
      },
      {
        label: "Why It Matters",
        text: "Activating M01 or M02 without the correct saved sources means onboarding and uploads will be blocked until those sources are configured.",
      },
    ],
    title: "Add Location / Step 2",
  },
  {
    footerLabel: "Critical Doc",
    footerValue: "Signed agreement with contracted rates",
    sections: [
      {
        label: "What It Is",
        text: "Confirmation of what your WGS Advisor will need from you to complete onboarding: signed agreements, terminal serial numbers, statement exports.",
      },
      {
        label: "What It Does",
        text: "Review the checklist and gather the required documents before your WGS onboarding call. Missing documents delay the timeline.",
      },
      {
        label: "Why It Matters",
        text: "Certification cannot begin until Contract Config is sealed. Contract Config cannot be sealed without the signed agreement. Bring it to the onboarding call.",
      },
    ],
    title: "Add Location / Step 3",
  },
];

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
    if (step === 2) {
      if (!draft.m01 && !draft.m02) return;
      if (!draft.posSystem.trim() || !draft.bankProviderKey.trim()) return;
      if (draft.m01 && !draft.processor.trim()) return;
      if (draft.m02 && draft.dsps.length === 0) return;
    }
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
    <AccessibleDialog ariaLabel="Add location" onClose={onClose} closeOnEscape={step === 1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="border-b border-[var(--border)] px-6 pb-0 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-[family-name:var(--font-display)] text-[2rem] font-bold tracking-[-0.04em]">
                Add New Location
              </div>
              <div className="mt-1 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                This starts the onboarding journey for the new location. A WGS Manager will be notified
                to configure Contract Config and seal the Schema Registry before the first certification
                run.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-lg leading-none text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              ×
            </button>
          </div>

          <div className="flex gap-4">
            {[
              "1 · Location Details",
              "2 · Modules & Data",
              "3 · Onboarding Checklist",
            ].map((label, index) => {
              const active = step === index + 1;
              const help = stepHelp[index];

              return (
                <div
                  key={label}
                  className={`flex items-center gap-1 border-b-2 px-4 pb-3 text-sm ${
                    active
                      ? "border-b-[var(--accent)] font-semibold text-[var(--accent)]"
                      : "border-b-transparent text-[var(--muted)]"
                  }`}
                >
                  <span>{label}</span>
                  <HelpTip
                    title={help.title}
                    sections={help.sections}
                    footerLabel={help.footerLabel}
                    footerValue={help.footerValue}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Location Name *
                </span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                  placeholder="e.g. Dominos - Irving Las Colinas"
                />
              </label>
              <label className="grid gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Street Address
                </span>
                <input
                  value={draft.address}
                  onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                  placeholder="e.g. 3400 W. Airport Freeway, Irving TX 75062"
                />
              </label>
              <div className="grid gap-4">
                <label className="grid gap-2 md:max-w-[calc(50%-0.5rem)]">
                  <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">
                    Internal Location ID (Optional)
                  </span>
                  <input
                    value={draft.locId}
                    onChange={(event) => setDraft((current) => ({ ...current, locId: event.target.value }))}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                    placeholder="e.g. NTXDAL-004"
                  />
                </label>
              </div>
              <div className="rounded-[10px] border border-[rgba(212,131,10,0.5)] border-l-4 border-l-[#ff9800] bg-[#2A1500] px-4 py-4">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                  ⚠ Before Proceeding
                </div>
                <div className="mt-2 text-sm leading-7 text-[#C4924A]">
                  Have the following ready for this location: signed processor agreement (M01),
                  signed DSP merchant agreements (M02), terminal serial numbers, and DSP merchant
                  portal credentials. Contract Config cannot be sealed without the signed agreements.
                </div>
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
              {(draft.m01 || draft.m02) ? (
                <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="font-semibold">Shared location sources</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">Used by every enabled certification module.</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="grid content-start gap-2">
                      <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">POS system</span>
                      <select value={draft.posSystem} onChange={(event) => setDraft((current) => ({ ...current, posSystem: event.target.value }))} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                        {posOptions.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="grid content-start gap-2">
                      <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Bank</span>
                      <select value={draft.bankProviderKey} onChange={(event) => setDraft((current) => ({ ...current, bankProviderKey: event.target.value }))} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                        {bankOptions.map((bank) => <option key={bank.key} value={bank.key}>{bank.name}</option>)}
                      </select>
                      <span className="text-xs text-[var(--muted)]">Currently supported PDF format: Prosperity Bank statements only.</span>
                    </label>
                  </div>
                </section>
              ) : null}
              {draft.m01 ? (
                <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="font-semibold">M01 sources</div>
                  <label className="mt-4 grid gap-2 md:max-w-[calc(50%-0.5rem)]">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Card processor</span>
                    <select value={draft.processor} onChange={(event) => setDraft((current) => ({ ...current, processor: event.target.value }))} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                      {processorOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                </section>
              ) : null}
              {draft.m02 ? (
                <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="font-semibold">M02 delivery platforms</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {dspOptions.map((dsp) => {
                      const selected = draft.dsps.includes(dsp.name);
                      const disabled = dsp.supported === false;
                      return (
                        <button key={dsp.key} type="button" disabled={disabled} title={disabled ? `${dsp.name} format is not supported yet.` : undefined} onClick={() => setDraft((current) => ({ ...current, dsps: selected ? current.dsps.filter((item) => item !== dsp.name) : [...current.dsps, dsp.name] }))} className={`rounded-full border px-3 py-2 text-sm ${disabled ? "cursor-not-allowed border-[var(--border)] bg-gray-100 text-gray-400" : selected ? "border-[var(--accent)] bg-[rgba(214,48,49,0.04)] text-[var(--accent)]" : "border-[var(--border)] bg-white text-[var(--muted)]"}`}>
                          {dsp.name}{disabled ? " — Coming later" : ""}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Saved Active Sources
                </div>
                <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  POS: <span className="font-semibold text-[var(--text)]">{draft.posSystem}</span>{" / "}
                  Bank: <span className="font-semibold text-[var(--text)]">{bankOptions.find((bank) => bank.key === draft.bankProviderKey)?.name}</span>
                  {draft.m01 ? <>{" / "}Processor: <span className="font-semibold text-[var(--text)]">{draft.processor}</span></> : null}
                  {draft.m02 ? <>{" / "}DSPs: <span className="font-semibold text-[var(--text)]">{draft.dsps.join(", ")}</span></> : null}
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  These source selections are defined in Location Details and will be used by Upload Data, DIY Access, and onboarding. Change them there or later through Manage Sources.
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.05)] p-4">
                <div className="font-semibold text-[var(--success)]">{draft.name || "New location"} ready to onboard</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  POS: {draft.posSystem} / Bank: {bankOptions.find((bank) => bank.key === draft.bankProviderKey)?.name}
                  {draft.m01 ? ` / Processor: ${draft.processor}` : ""}
                  {draft.m02 ? ` / DSPs: ${draft.dsps.join(", ")}` : ""}
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
          <div className="text-sm text-[var(--muted)]">{`Step ${step} of 3`}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              disabled={step === 1}
              className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#bb2a2b]"
            >
              {step === 3 ? "Start Onboarding →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </AccessibleDialog>
  );
}
