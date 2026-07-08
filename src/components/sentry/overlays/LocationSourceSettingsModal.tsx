"use client";

import { useMemo, useState } from "react";
import type { LocationSourceConfig } from "../types";
import { getVendorCatalog } from "../vendor-catalog";

type DraftState = {
  m01Enabled: boolean;
  m01Vendors: string[];
  m02Enabled: boolean;
  m02Vendors: string[];
};

export function LocationSourceSettingsModal({
  initialConfig,
  locationName,
  onClose,
  onSave,
}: {
  initialConfig: LocationSourceConfig;
  locationName: string;
  onClose: () => void;
  onSave: (next: DraftState) => void;
}) {
  const [draft, setDraft] = useState<DraftState>({
    m01Enabled: initialConfig.m01Enabled,
    m01Vendors: initialConfig.m01Vendors.map((vendor) => vendor.key),
    m02Enabled: initialConfig.m02Enabled,
    m02Vendors: initialConfig.m02Vendors.map((vendor) => vendor.key),
  });

  const m01Catalog = useMemo(() => getVendorCatalog("M01"), []);
  const m02Catalog = useMemo(() => getVendorCatalog("M02"), []);

  function toggleVendor(moduleId: "M01" | "M02", vendorKey: string) {
    setDraft((current) => {
      const stateKey = moduleId === "M01" ? "m01Vendors" : "m02Vendors";
      const currentValues = current[stateKey];

      return {
        ...current,
        [stateKey]: currentValues.includes(vendorKey)
          ? currentValues.filter((value) => value !== vendorKey)
          : [...currentValues, vendorKey],
      };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-[2rem] font-bold tracking-[-0.04em] text-[var(--text)]">
              Manage Active Sources
            </div>
            <div className="mt-1 text-sm leading-7 text-[var(--muted)]">
              {locationName} only shows the processor and DSP workflows selected here. Update this
              when the location adds or changes providers.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--text)]">M01</div>
                <div className="text-sm text-[var(--muted)]">Card processor fee recovery</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={draft.m01Enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, m01Enabled: event.target.checked }))
                  }
                />
                Enabled
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {m01Catalog.map((vendor) => {
                const selected = draft.m01Vendors.includes(vendor.key);
                return (
                  <button
                    key={vendor.key}
                    type="button"
                    disabled={!draft.m01Enabled}
                    onClick={() => toggleVendor("M01", vendor.key)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      selected
                        ? "border-[var(--accent)] bg-[rgba(214,48,49,0.05)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                    } ${!draft.m01Enabled ? "cursor-not-allowed opacity-50" : "hover:border-[var(--text)] hover:text-[var(--text)]"}`}
                  >
                    {vendor.name}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--text)]">M02</div>
                <div className="text-sm text-[var(--muted)]">DSP delivery fee recovery</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={draft.m02Enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, m02Enabled: event.target.checked }))
                  }
                />
                Enabled
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {m02Catalog.map((vendor) => {
                const selected = draft.m02Vendors.includes(vendor.key);
                return (
                  <button
                    key={vendor.key}
                    type="button"
                    disabled={!draft.m02Enabled}
                    onClick={() => toggleVendor("M02", vendor.key)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      selected
                        ? "border-[var(--accent)] bg-[rgba(214,48,49,0.05)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                    } ${!draft.m02Enabled ? "cursor-not-allowed opacity-50" : "hover:border-[var(--text)] hover:text-[var(--text)]"}`}
                  >
                    {vendor.name}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-6 py-5">
          <div className="text-sm text-[var(--muted)]">
            Only selected providers will appear in Upload Data and related source workflows.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="rounded-xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
            >
              Save Source Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
