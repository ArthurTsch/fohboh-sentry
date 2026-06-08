import { useMemo, useState } from "react";
import type { SchemaWorkspace } from "../types";
import { Badge, HelpTip, MetaBlock } from "../ui/primitives";

type TabId = "mappings" | "contract" | "missing" | "upload" | "vault";

export function SchemaEditorModal({
  workspace,
  onClose,
  onSave,
  onSeal,
}: {
  workspace: SchemaWorkspace;
  onClose: () => void;
  onSave: (workspace: SchemaWorkspace) => void;
  onSeal: (workspace: SchemaWorkspace) => void;
}) {
  const [draft, setDraft] = useState<SchemaWorkspace>(workspace);
  const [tab, setTab] = useState<TabId>("mappings");

  const requiredRemaining = useMemo(
    () => draft.fields.filter((field) => field.required && field.confidence !== "Verified").length,
    [draft.fields],
  );

  const verifiedFields = draft.fields.filter((field) => field.confidence === "Verified");
  const reviewFields = draft.fields.filter((field) => field.confidence === "Needs Review");
  const missingFields = draft.fields.filter((field) => field.confidence === "Missing");
  const uploadReady = requiredRemaining === 0 && reviewFields.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              Schema Editor
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {draft.account} · {draft.module} · {draft.vendor}
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

        <div className="border-b border-[var(--border)] px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "mappings" as const, label: "Column Mappings" },
              { id: "contract" as const, label: "Contract Config" },
              { id: "missing" as const, label: "Missing Fields" },
              { id: "upload" as const, label: "Upload Statement" },
              { id: "vault" as const, label: "Vault Record" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  tab === item.id
                    ? "bg-[var(--text)] text-white"
                    : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_300px]">
          <div className="min-h-0 overflow-y-auto p-6">
            {tab === "mappings" ? (
              <div className="space-y-3">
                <TabHeading
                  title="Column Mappings"
                  tipTitle="Schema Editor · Column Mappings"
                  sections={[
                    {
                      label: "What It Is",
                      text: "Editable source-column bindings used by the governed semantic model.",
                    },
                    {
                      label: "What It Does",
                      text: "These mappings determine which uploaded values drive certification logic and Trust Score outcomes.",
                    },
                    {
                      label: "Why It Matters",
                      text: "An incorrect binding changes every downstream finding until the workspace is corrected and resealed.",
                    },
                  ]}
                />
                {draft.fields.map((field, index) => (
                  <div
                    key={field.canonical}
                    className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[1fr_1fr_160px]"
                  >
                    <div>
                      <div className="font-medium">{field.canonical}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {field.required ? "Required for sealing" : "Optional field"}
                      </div>
                    </div>
                    <input
                      value={field.source}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fields: current.fields.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, source: event.target.value } : item,
                          ),
                        }))
                      }
                      className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    />
                    <select
                      value={field.confidence}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fields: current.fields.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  confidence:
                                    event.target.value as SchemaWorkspace["fields"][number]["confidence"],
                                }
                              : item,
                          ),
                        }))
                      }
                      className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option>Verified</option>
                      <option>Needs Review</option>
                      <option>Missing</option>
                    </select>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "contract" ? (
              <div className="space-y-3">
                <TabHeading
                  title="Contract Config"
                  tipTitle="Schema Editor · Contract Config"
                  sections={[
                    {
                      label: "What It Is",
                      text: "The contract-derived values used to build the legal expected-fee baseline.",
                    },
                    {
                      label: "What It Does",
                      text: "Feeds deterministic rule execution for processor markup, DSP commission, and related variance logic.",
                    },
                    {
                      label: "Why It Matters",
                      text: "If these values are wrong, the CAAR may still look complete while the recovery claim is materially wrong.",
                    },
                  ]}
                />
                {draft.contract.map((field, index) => (
                  <div key={field.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                      {field.label}
                    </div>
                    <input
                      value={field.value}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          contract: current.contract.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, value: event.target.value } : item,
                          ),
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    />
                    <input
                      value={field.source}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          contract: current.contract.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, source: event.target.value } : item,
                          ),
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "missing" ? (
              <div className="space-y-4">
                <TabHeading
                  title="Missing Fields"
                  tipTitle="Schema Editor · Missing Fields"
                  sections={[
                    {
                      label: "What It Is",
                      text: "A focused queue of fields that still block clean upload validation or sealing.",
                    },
                    {
                      label: "What It Does",
                      text: "Separates required gaps from optional cleanup so the team can triage what actually blocks release.",
                    },
                    {
                      label: "Why It Matters",
                      text: "This is the fastest way to resolve Trust Score blockers caused by mapping incompleteness.",
                    },
                  ]}
                />
                {missingFields.length > 0 ? (
                  missingFields.map((field) => (
                    <div key={field.canonical} className="rounded-2xl border border-[rgba(214,48,49,0.12)] bg-[var(--surface)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{field.canonical}</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            Current source binding: {field.source || "Not mapped"}
                          </div>
                        </div>
                        <Badge tone={field.required ? "danger" : "warning"}>
                          {field.required ? "Required gap" : "Optional gap"}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                    No missing field gaps remain in this workspace.
                  </div>
                )}
              </div>
            ) : null}

            {tab === "upload" ? (
              <div className="space-y-4">
                <TabHeading
                  title="Upload Statement"
                  tipTitle="Schema Editor · Upload Statement"
                  sections={[
                    {
                      label: "What It Is",
                      text: "A schema-readiness statement describing whether the current workspace is safe for upload intake.",
                    },
                    {
                      label: "What It Does",
                      text: "Summarizes required field completion, review volume, and release gating in operator-readable terms.",
                    },
                    {
                      label: "Why It Matters",
                      text: "It gives WGS and operators a shared pre-certification view of whether the schema is actually ready.",
                    },
                  ]}
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <UploadMetric label="Verified" value={String(verifiedFields.length)} tone="success" />
                  <UploadMetric label="Needs Review" value={String(reviewFields.length)} tone="warning" />
                  <UploadMetric label="Missing" value={String(missingFields.length)} tone="danger" />
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                        Release Gate
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        Required fields must be verified and review items cleared before this workspace is treated as release-ready.
                      </div>
                    </div>
                    <Badge tone={uploadReady ? "success" : requiredRemaining > 0 ? "danger" : "warning"}>
                      {uploadReady ? "Release Ready" : requiredRemaining > 0 ? "Blocked" : "Needs Review"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Required fields verified
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {draft.fields.filter((field) => field.required && field.confidence === "Verified").length}/
                        {draft.fields.filter((field) => field.required).length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Statement
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {uploadReady
                          ? "Current upload structure is aligned with the governed schema and may proceed into intake validation."
                          : requiredRemaining > 0
                            ? "One or more required fields are unresolved. Intake should be blocked until mapping gaps are fixed."
                            : "Core fields are present, but governance review still remains before sealing and release."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "vault" ? (
              <div className="space-y-4">
                <TabHeading
                  title="Vault Record"
                  tipTitle="Schema Editor · Vault Record"
                  sections={[
                    {
                      label: "What It Is",
                      text: "The immutable governed record representing the sealed mapping and contract state.",
                    },
                    {
                      label: "What It Does",
                      text: "Provides version, seal identity, and hash lineage for reproducible certification output.",
                    },
                    {
                      label: "Why It Matters",
                      text: "Without a credible vault record, opposing counsel can challenge rule lineage and contract truth.",
                    },
                  ]}
                />
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MetaBlock label="Version" value={draft.vault.version} />
                    <MetaBlock label="Hash" value={draft.vault.hash} />
                    <MetaBlock label="Sealed By" value={draft.vault.sealedBy} />
                    <MetaBlock label="Sealed At" value={draft.vault.sealedAt} />
                  </div>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-white p-5 text-sm leading-7 text-[var(--muted)]">
                  The vault record is the governed evidence anchor for this workspace. Sealing writes the current
                  mapping and contract state into an immutable versioned record used by certification and CAAR
                  generation.
                </div>
              </div>
            ) : null}
          </div>

          <aside className="min-h-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
              Seal Readiness
            </div>
            <div className="mt-3">
              <Badge tone={requiredRemaining === 0 ? "success" : "warning"}>
                {requiredRemaining === 0 ? "Ready to seal" : `${requiredRemaining} required field(s) pending`}
              </Badge>
            </div>
            <div className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {requiredRemaining === 0
                ? "All required mappings are verified. Contract config can be sealed into the vault record."
                : "Resolve the remaining required mappings before this workspace can become governed evidence."}
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="font-medium">Readiness summary</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <div>Verified fields: {verifiedFields.length}</div>
                <div>Review items: {reviewFields.length}</div>
                <div>Missing fields: {missingFields.length}</div>
                <div>Upload gate: {uploadReady ? "Release Ready" : "Blocked / Review"}</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="font-medium">Verification flow</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <div>1. Confirm native headers against canonical fields.</div>
                <div>2. Verify contract terms against the signed agreement.</div>
                <div>3. Resolve all amber or missing controls.</div>
                <div>4. Seal only when the workspace reflects evidentiary truth.</div>
              </div>
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-5">
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => onSeal(draft)}
            className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
            disabled={requiredRemaining > 0}
          >
            Seal Contract Config
          </button>
        </div>
      </div>
    </div>
  );
}

function TabHeading({
  sections,
  tipTitle,
  title,
}: {
  sections: { label: string; text: string }[];
  tipTitle: string;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
      <span>{title}</span>
      <HelpTip title={tipTitle} sections={sections} />
    </div>
  );
}

function UploadMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "success" | "warning" | "danger";
  value: string;
}) {
  const valueClass = {
    success: "text-[var(--success)]",
    warning: "text-[#b86a00]",
    danger: "text-[var(--accent)]",
  }[tone];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.05em] ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
