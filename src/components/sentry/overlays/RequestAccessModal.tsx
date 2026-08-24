import type { ReactNode } from "react";
import { useState } from "react";
import { emptyRequestAccessDraft } from "../data";
import type { RequestAccessDraft } from "../types";
import { AccessibleDialog } from "../ui/AccessibleDialog";

const locationOptions = ["1-5", "6-15", "16-50", "51-100", "100+"];
const volumeOptions = ["Under $50K", "$50K-$200K", "$200K-$1M", "$1M+"];
const dspOptions = ["DoorDash", "Uber Eats", "Grubhub", "Olo / Direct", "EZcater", "Other"];
const processorOptions = [
  "Heartland",
  "Toast",
  "Square",
  "Worldpay",
  "Chase Paymentech",
  "Other",
];

const stepLabels = [
  "ABOUT YOU",
  "YOUR RESTAURANTS",
  "SELECT MODULES",
];

export function RequestAccessModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (draft: RequestAccessDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<RequestAccessDraft>(emptyRequestAccessDraft);
  const [step, setStep] = useState(0);

  const stepOneValid =
    draft.name.trim().length > 0 && draft.email.trim().length > 0 && draft.company.trim().length > 0;
  const stepTwoValid =
    draft.locations.trim().length > 0 &&
    draft.monthlyVolume.trim().length > 0 &&
    draft.dsps.length > 0 &&
    draft.processors.length > 0;
  const canAdvance = step === 0 ? stepOneValid : step === 1 ? stepTwoValid : true;

  function updateField<K extends keyof RequestAccessDraft>(key: K, value: RequestAccessDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleArrayValue(key: "dsps" | "processors", value: string) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  }

  function selectPlan(plan: "bundle" | "m01" | "m02") {
    setDraft((current) => ({
      ...current,
      modulePlan: plan,
      modules: plan === "bundle" ? ["M01", "M02"] : plan === "m01" ? ["M01"] : ["M02"],
    }));
  }

  function handleNext() {
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    onSubmit(draft);
  }

  function handleBackOrClose() {
    if (step === 0) {
      onClose();
      return;
    }

    setStep((current) => current - 1);
  }

  return (
    <AccessibleDialog ariaLabel="Request access" closeOnEscape={step === 0} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="border-b border-[var(--border)] px-7 pb-0 pt-6">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackOrClose}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-xl text-[var(--text)] transition hover:border-[var(--text)]"
              aria-label={step === 0 ? "Close request access" : "Go back"}
            >
              {step === 0 ? "×" : "←"}
            </button>
            <div className="font-[family-name:var(--font-display)] text-[2.1rem] font-bold tracking-[-0.05em] text-[var(--text)]">
              Get Started with Sentry
            </div>
          </div>

          <div className="flex items-end gap-9 pb-1">
            {stepLabels.map((label, index) => (
              <div key={label} className="flex min-w-[84px] flex-col gap-2">
                <div className="text-[2rem] leading-none text-[var(--text)]">
                  {index < step ? "✓" : index + 1}
                </div>
                <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--muted)]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-7 py-6">
          {step === 0 ? (
            <StepAboutYou draft={draft} onChange={updateField} />
          ) : null}

          {step === 1 ? (
            <StepRestaurants
              draft={draft}
              onChange={updateField}
              onToggleArrayValue={toggleArrayValue}
            />
          ) : null}

          {step === 2 ? <StepModules draft={draft} onSelectPlan={selectPlan} /> : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-7 py-4">
          <div className="text-sm text-[var(--muted)]">{`Step ${step + 1} of 3`}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance}
              className="rounded-[10px] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#bb2a2b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === 2 ? "Submit ->" : "Next ->"}
            </button>
          </div>
        </div>
      </div>
    </AccessibleDialog>
  );
}

function StepAboutYou({
  draft,
  onChange,
}: {
  draft: RequestAccessDraft;
  onChange: <K extends keyof RequestAccessDraft>(key: K, value: RequestAccessDraft[K]) => void;
}) {
  return (
    <div>
      <p className="mb-6 text-lg leading-8 text-[var(--muted)]">
        Tell us a little about yourself. Your FohBoh WGS Advisor will use this to prepare your
        onboarding.
      </p>

      <div className="grid gap-5">
        <FieldLabel label="YOUR NAME">
          <input
            value={draft.name}
            onChange={(event) => onChange("name", event.target.value)}
            className={inputClassName}
            placeholder="Sarah Chen"
          />
        </FieldLabel>

        <FieldLabel label="EMAIL ADDRESS">
          <input
            type="email"
            value={draft.email}
            onChange={(event) => onChange("email", event.target.value)}
            className={inputClassName}
            placeholder="you@restaurant.com"
          />
        </FieldLabel>

        <FieldLabel label="PHONE (OPTIONAL)">
          <input
            type="tel"
            value={draft.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            className={inputClassName}
            placeholder="+1 (214) 555-0100"
          />
        </FieldLabel>

        <FieldLabel label="ORGANIZATION / BRAND">
          <input
            value={draft.company}
            onChange={(event) => onChange("company", event.target.value)}
            className={inputClassName}
            placeholder="Dominos NTX - Dallas Franchise Group"
          />
        </FieldLabel>
      </div>
    </div>
  );
}

function StepRestaurants({
  draft,
  onChange,
  onToggleArrayValue,
}: {
  draft: RequestAccessDraft;
  onChange: <K extends keyof RequestAccessDraft>(key: K, value: RequestAccessDraft[K]) => void;
  onToggleArrayValue: (key: "dsps" | "processors", value: string) => void;
}) {
  return (
    <div>
      <p className="mb-6 text-lg leading-8 text-[var(--muted)]">
        Help us understand your operation so we can scope your setup accurately.
      </p>

      <div className="grid gap-5">
        <FieldLabel label="APPROXIMATE NUMBER OF LOCATIONS">
          <select
            value={draft.locations}
            onChange={(event) => onChange("locations", event.target.value)}
            className={inputClassName}
          >
            <option value="">Select...</option>
            {locationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FieldLabel>

        <CheckboxGrid
          label="PRIMARY DELIVERY PLATFORMS (M02)"
          options={dspOptions}
          selected={draft.dsps}
          onToggle={(value) => onToggleArrayValue("dsps", value)}
        />

        <CheckboxGrid
          label="PRIMARY CARD PROCESSOR (M01)"
          options={processorOptions}
          selected={draft.processors}
          onToggle={(value) => onToggleArrayValue("processors", value)}
        />

        <FieldLabel label="ESTIMATED MONTHLY CARD VOLUME">
          <select
            value={draft.monthlyVolume}
            onChange={(event) => onChange("monthlyVolume", event.target.value)}
            className={inputClassName}
          >
            <option value="">Select...</option>
            {volumeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
    </div>
  );
}

function StepModules({
  draft,
  onSelectPlan,
}: {
  draft: RequestAccessDraft;
  onSelectPlan: (plan: "bundle" | "m01" | "m02") => void;
}) {
  return (
    <div>
      <p className="mb-6 text-lg leading-8 text-[var(--muted)]">
        Choose the modules you want activated. Your WGS Advisor will confirm your selection during
        onboarding.
      </p>

      <button
        type="button"
        onClick={() => onSelectPlan("bundle")}
        className={`relative mb-3 w-full rounded-[14px] border-2 px-5 py-5 text-left transition ${
          draft.modulePlan === "bundle"
            ? "border-[var(--accent)] bg-[rgba(214,48,49,0.06)]"
            : "border-[var(--border)] bg-white"
        }`}
      >
        <div className="absolute left-5 top-[-12px] rounded-full bg-[#ffb000] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-black">
          Best Value
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-[1.4rem] font-bold tracking-[-0.03em] text-[var(--text)]">
              M01 + M02 Bundle
            </div>
            <div className="text-sm text-[var(--muted)]">
              Merchant Fee Recovery + Delivery Fee Recovery
            </div>
            <div className="mt-3 text-sm text-[var(--muted)]">
              All 198 deterministic rules - Full CAAR evidence package - Certified Automated Audit & Recovery output
            </div>
          </div>
          <div className="pr-9 text-right">
            <div className="text-5xl font-bold tracking-[-0.06em] text-[var(--accent)]">
              $299<span className="text-base font-normal text-[var(--muted)]">/mo</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-[#00a844]">Save $99/mo</div>
          </div>
        </div>
        {draft.modulePlan === "bundle" ? (
          <div className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-[#ffb000] text-sm font-bold text-black">
            ✓
          </div>
        ) : null}
      </button>

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <PlanCard
          active={draft.modulePlan === "m01"}
          description="Credit card processing fee overcharge certification"
          price="$199"
          subtitle="Merchant Fee Recovery"
          title="M01 Only"
          onClick={() => onSelectPlan("m01")}
        />
        <PlanCard
          active={draft.modulePlan === "m02"}
          description="DSP commission and delivery fee overcharge certification"
          price="$199"
          subtitle="Delivery Fee Recovery"
          title="M02 Only"
          onClick={() => onSelectPlan("m02")}
        />
      </div>

      <div className="rounded-[14px] border border-dashed border-[var(--border)] px-5 py-4 opacity-60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-lg font-bold tracking-[-0.03em] text-[var(--text)]">
              M03 - Royalty Recovery
            </div>
            <div className="text-sm text-[var(--muted)]">
              Enterprise - Requires M01+M02 active {"\u003e"}= 90 days
            </div>
          </div>
          <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
            Coming Soon
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
        Pricing is per-organization, all locations included. Billed monthly after your WGS Advisor
        completes setup and seals your Contract Config.
      </p>
    </div>
  );
}

function FieldLabel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckboxGrid({
  label,
  onToggle,
  options,
  selected,
}: {
  label: string;
  onToggle: (value: string) => void;
  options: string[];
  selected: string[];
}) {
  return (
    <div className="grid gap-2">
      <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--muted)]">
        {label}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-[8px] border px-4 py-3 text-base transition ${
                active
                  ? "border-[var(--accent)] bg-[rgba(214,48,49,0.05)] text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(option)}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PlanCard({
  active,
  description,
  onClick,
  price,
  subtitle,
  title,
}: {
  active: boolean;
  description: string;
  onClick: () => void;
  price: string;
  subtitle: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border px-5 py-5 text-left transition ${
        active
          ? "border-[var(--accent)] bg-[rgba(214,48,49,0.06)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="mb-1 text-[1.35rem] font-bold tracking-[-0.03em] text-[var(--text)]">{title}</div>
      <div className="mb-4 text-sm text-[var(--muted)]">{subtitle}</div>
      <div className="text-base leading-7 text-[var(--text)]">{description}</div>
      <div className="mt-5 text-4xl font-bold tracking-[-0.05em] text-[var(--text)]">
        {price}
        <span className="text-base font-normal text-[var(--muted)]">/mo</span>
      </div>
    </button>
  );
}
const inputClassName =
  "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-base text-[var(--text)] outline-none transition focus:border-[var(--text)]";
