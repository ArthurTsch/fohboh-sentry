import { useState } from "react";
import { ActionNotice, ReadinessChecklist, WorkflowContextBar } from "../ui/workflow-ux";
import { AccessibleDialog } from "../ui/AccessibleDialog";

function getDefaultCertificationMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function formatCertificationMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "Select a month";
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function CertificationCadenceModal({
  locationId,
  locations,
  locationName,
  getMonthlyFinalBlockers,
  onChangeLocation,
  onChangeModules,
  onChangeVendor,
  onClose,
  onSubmit,
  selectedModules,
  selectedVendorKey,
  selectableModules,
  selectableVendors = [],
}: {
  locationId: string;
  locations?: { id: string; name: string }[];
  locationName: string;
  getMonthlyFinalBlockers: (certificationMonth: string, moduleId: "M01" | "M02" | undefined, vendorKey?: string) => string[];
  onChangeLocation?: (locationId: string) => void;
  onChangeModules?: (modules: Array<"M01" | "M02">) => void;
  onChangeVendor?: (vendorKey: string) => void;
  onClose: () => void;
  onSubmit: (cadence: "monthly_final" | "monthly_preliminary", certificationMonth: string) => void | Promise<void>;
  selectedModules: Array<"M01" | "M02">;
  selectedVendorKey?: string;
  selectableModules: Array<{
    blockers: string[];
    enabled: boolean;
    moduleId: "M01" | "M02";
    ready: boolean;
  }>;
  selectableVendors?: Array<{ key: string; name: string }>;
}) {
  const [certificationMonth, setCertificationMonth] = useState(getDefaultCertificationMonth);
  const requiresVendor = selectedModules[0] === "M02";
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(certificationMonth);
  const canSubmit = validMonth && selectedModules.length === 1 && (!requiresVendor || Boolean(selectedVendorKey));
  const selectedModule = selectableModules.find((module) => module.moduleId === selectedModules[0]);
  const selectedVendor = selectableVendors.find((vendor) => vendor.key === selectedVendorKey);
  const monthlyFinalBlockers = validMonth
    ? getMonthlyFinalBlockers(certificationMonth, selectedModules[0], selectedVendorKey)
    : ["Select a valid certification month."];
  const canSubmitFinal = canSubmit && monthlyFinalBlockers.length === 0;
  return (
    <AccessibleDialog onClose={onClose} aria-labelledby="certification-preflight-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="border-b border-[var(--border)] px-6 py-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Certification Cadence
          </div>
          <div id="certification-preflight-title" className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {locationName}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Choose the evidence path you want to certify before the engine runs.
          </div>
        </div>

        <div className="space-y-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-5">
          <WorkflowContextBar
            locationId={locationId}
            locationName={locationName}
            moduleId={selectedModules[0] ?? null}
            providerName={selectedVendor?.name}
            period={formatCertificationMonth(certificationMonth)}
          />
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Certification preflight
            </div>
            <div className="mt-3">
              <ReadinessChecklist
                items={[
                  {
                    detail: selectedModule?.enabled ? "The module is enabled for this location." : "Enable this module for the location.",
                    label: "Module configuration",
                    ready: Boolean(selectedModule?.enabled),
                  },
                  {
                    detail: requiresVendor
                      ? selectedVendor
                        ? `${selectedVendor.name} will be certified independently.`
                        : "Select the delivery platform for this run."
                      : "M01 uses the configured processor scope.",
                    label: "Provider scope",
                    ready: !requiresVendor || Boolean(selectedVendor),
                  },
                  {
                    detail: selectedModule?.ready
                      ? "Evidence and governance prerequisites passed."
                      : selectedModule?.blockers[0] ?? "Select one ready module.",
                    label: "Evidence and governance",
                    ready: Boolean(selectedModule?.ready),
                  },
                ]}
              />
            </div>
          </div>
          {!canSubmit ? (
            <ActionNotice title="Certification is blocked">
              {selectedModule?.blockers[0] ??
                (requiresVendor && !selectedVendor
                  ? "Select the delivery platform to continue."
                  : "Select exactly one ready module to continue.")}
            </ActionNotice>
          ) : null}
        </div>

        <div className="border-b border-[var(--border)] px-6 py-5">
          <label htmlFor="certification-month" className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Certification Month
          </label>
          <input
            id="certification-month"
            type="month"
            required
            value={certificationMonth}
            max={new Date().toISOString().slice(0, 7)}
            onChange={(event) => setCertificationMonth(event.target.value)}
            className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--text)]"
          />
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Choose the month represented by the evidence. The previous completed month is selected by default.
          </p>
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
                    onChangeModules?.([module.moduleId]);
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
          <div className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Select one module. M01 and M02 are certified independently and produce separate CAARs.
          </div>
          {requiresVendor ? (
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Delivery platform
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selectableVendors.map((vendor) => (
                  <button
                    key={vendor.key}
                    type="button"
                    onClick={() => onChangeVendor?.(vendor.key)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                      selectedVendorKey === vendor.key
                        ? "border-[var(--text)] bg-[var(--text)] text-white"
                        : "border-[var(--border)] bg-white"
                    }`}
                  >
                    {vendor.name}
                  </button>
                ))}
              </div>
              {selectableVendors.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--accent)]">
                  Configure at least one M02 delivery platform before running certification.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit("monthly_preliminary", certificationMonth)}
            className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--text)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Monthly Preliminary
            </div>
            <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              {selectedModules[0] === "M02" ? "Run with incomplete monthly evidence" : "Run before next-month evidence arrives"}
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {selectedModules[0] === "M02"
                ? "Uses the provider evidence currently available when the selected month's evidence package is incomplete. The result is explicitly preliminary and cannot clear final release."
                : "Uses the evidence currently available and clearly marks the CAAR as preliminary. For M01, use this while the following month's payout export is still unavailable."}
            </div>
          </button>

          <button
            type="button"
            disabled={!canSubmitFinal}
            onClick={() => onSubmit("monthly_final", certificationMonth)}
            className="rounded-[24px] border border-[rgba(214,48,49,0.24)] bg-[rgba(214,48,49,0.04)] p-5 text-left transition hover:border-[var(--accent)] hover:bg-white disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface)] disabled:opacity-50"
          >
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Monthly Final
            </div>
            <div className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Certified CAAR path
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {monthlyFinalBlockers.length > 0
                ? `Unavailable: ${monthlyFinalBlockers.join(" ")}`
                : "The complete month-specific evidence package is uploaded. This path can clear final CAAR release."}
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
    </AccessibleDialog>
  );
}
