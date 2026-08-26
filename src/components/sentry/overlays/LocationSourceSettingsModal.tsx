"use client";

import { useMemo, useState } from "react";
import type { LocationSourceConfig } from "../types";
import { getVendorCatalog } from "../vendor-catalog";
import { getBankCatalog } from "../bank-catalog";
import { AccessibleDialog } from "../ui/AccessibleDialog";

type DraftState = {
  bankProviderKey: string;
  m01Enabled: boolean;
  m01Vendors: string[];
  m02Enabled: boolean;
  m02Vendors: string[];
  posSystem: string;
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
  onSave: (next: DraftState) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftState>({
    bankProviderKey: initialConfig.bankProvider.key,
    m01Enabled: initialConfig.m01Enabled,
    m01Vendors: initialConfig.m01Vendors.map((vendor) => vendor.key),
    m02Enabled: initialConfig.m02Enabled,
    m02Vendors: initialConfig.m02Vendors.map((vendor) => vendor.key),
    posSystem: initialConfig.posSystem ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const m01Catalog = useMemo(() => getVendorCatalog("M01"), []);
  const m02Catalog = useMemo(() => getVendorCatalog("M02"), []);
  const bankCatalog = useMemo(() => getBankCatalog(), []);

  function toggleVendor(moduleId: "M01" | "M02", vendorKey: string) {
    setError(null);
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

  async function save() {
    if (draft.m01Enabled && draft.m01Vendors.length === 0) {
      setError("Select an M01 processor before saving.");
      return;
    }
    if (draft.m02Enabled && draft.m02Vendors.length === 0) {
      setError("Select at least one M02 delivery platform before saving.");
      return;
    }
    if (!draft.m01Enabled && !draft.m02Enabled) {
      setError("At least one certification module must remain enabled.");
      return;
    }
    if (!draft.posSystem.trim()) {
      setError("Select a POS system before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Source settings could not be saved.");
      setSaving(false);
    }
  }

  return (
    <AccessibleDialog ariaLabel={`Source settings for ${locationName}`} closeOnEscape={!saving} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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
          <section className="rounded-2xl border border-[var(--border)] p-5 lg:col-span-2">
            <div className="font-semibold text-[var(--text)]">Shared location sources</div>
            <div className="mt-1 text-sm text-[var(--muted)]">Used by every enabled module.</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid content-start gap-2 text-sm"><span>POS system</span><input value={draft.posSystem} onChange={(event) => setDraft((current) => ({ ...current, posSystem: event.target.value }))} className="rounded-xl border border-[var(--border)] px-4 py-3" /></label>
              <label className="grid content-start gap-2 text-sm"><span>Bank</span><select value={draft.bankProviderKey} onChange={(event) => setDraft((current) => ({ ...current, bankProviderKey: event.target.value }))} className="rounded-xl border border-[var(--border)] px-4 py-3">{bankCatalog.map((bank) => <option key={bank.key} value={bank.key}>{bank.name}</option>)}</select><span className="text-xs text-[var(--muted)]">Only the Prosperity Bank PDF format is supported today.</span></label>
            </div>
          </section>
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
                const unsupported = vendor.supported === false;
                return (
                  <button
                    key={vendor.key}
                    type="button"
                    disabled={!draft.m02Enabled || unsupported}
                    title={unsupported ? `${vendor.name} format is not supported yet.` : undefined}
                    onClick={() => toggleVendor("M02", vendor.key)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      selected
                        ? "border-[var(--accent)] bg-[rgba(214,48,49,0.05)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                    } ${!draft.m02Enabled || unsupported ? "cursor-not-allowed opacity-50" : "hover:border-[var(--text)] hover:text-[var(--text)]"}`}
                  >
                    {vendor.name}{unsupported ? " — Coming later" : ""}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {error ? (
          <div className="mx-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-6 py-5">
          <div className="text-sm text-[var(--muted)]">
            Only selected providers will appear in Upload Data and related source workflows.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Source Settings"}
            </button>
          </div>
        </div>
      </div>
    </AccessibleDialog>
  );
}
