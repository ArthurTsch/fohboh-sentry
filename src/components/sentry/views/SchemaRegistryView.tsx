import type { SchemaWorkspace } from "../types";
import { Badge, HelpTip, MetaBlock, SectionCard } from "../ui/primitives";

export function SchemaRegistryView({
  onEditWorkspace,
  onSealWorkspace,
  workspaces,
}: {
  onEditWorkspace: (workspace: SchemaWorkspace) => void;
  onSealWorkspace: (workspace: SchemaWorkspace) => void;
  workspaces: SchemaWorkspace[];
}) {
  return (
    <div className="space-y-6">
      {workspaces.map((workspace) => {
        const verified = workspace.fields.filter((field) => field.confidence === "Verified");
        const review = workspace.fields.filter((field) => field.confidence === "Needs Review");
        const missing = workspace.fields.filter((field) => field.confidence === "Missing");
        const requiredFields = workspace.fields.filter((field) => field.required);
        const requiredMissing = requiredFields.filter((field) => field.confidence !== "Verified");
        const uploadReady = requiredMissing.length === 0 && review.length === 0;

        return (
          <SectionCard key={`${workspace.account}-${workspace.vendor}-${workspace.module}`}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                  {workspace.account} · {workspace.module} · {workspace.vendor}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  Column mappings, contract config, missing fields, and release readiness for the active source schema.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEditWorkspace(workspace)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Edit Schema
                </button>
                <button
                  type="button"
                  onClick={() => onSealWorkspace(workspace)}
                  className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Seal Contract Config
                </button>
              </div>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-4">
              <StatCard label="Verified Fields" value={String(verified.length)} tone="success" />
              <StatCard label="Needs Review" value={String(review.length)} tone="warning" />
              <StatCard label="Missing Fields" value={String(missing.length)} tone="danger" />
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Upload Statement
                </div>
                <div className="mt-3">
                  <Badge tone={uploadReady ? "success" : requiredMissing.length > 0 ? "danger" : "warning"}>
                    {uploadReady ? "Release Ready" : requiredMissing.length > 0 ? "Blocked" : "Needs Review"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <PanelTitle
                    title="Column Mappings"
                    tipTitle="Schema Registry · Column Mappings"
                    sections={[
                      {
                        label: "What It Is",
                        text: "Canonical field bindings between vendor-native exports and the governed semantic model.",
                      },
                      {
                        label: "What It Does",
                        text: "Controls how uploaded data is interpreted before certification, scoring, and CAAR generation.",
                      },
                      {
                        label: "Why It Matters",
                        text: "A wrong source column distorts every certified figure across the entire reporting period.",
                      },
                    ]}
                    footerLabel="Approval Required"
                    footerValue="WGS or Admin review before seal"
                  />
                  <div className="space-y-3">
                    {workspace.fields.map((field) => (
                      <div
                        key={field.canonical}
                        className="grid gap-3 rounded-xl border border-[var(--border)] bg-white p-3 md:grid-cols-[1fr_1fr_120px]"
                      >
                        <div>
                          <div className="font-medium">{field.canonical}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {field.required ? "Required field" : "Optional field"}
                          </div>
                        </div>
                        <div className="font-[family-name:var(--font-mono)] text-sm text-[var(--info)]">
                          {field.source}
                        </div>
                        <div className="md:text-right">
                          <Badge
                            tone={
                              field.confidence === "Verified"
                                ? "success"
                                : field.confidence === "Needs Review"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {field.confidence}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <PanelTitle
                    title="Contract Config"
                    tipTitle="Schema Registry · Contract Config"
                    sections={[
                      {
                        label: "What It Is",
                        text: "The governed rate inputs keyed from signed processor or DSP agreements.",
                      },
                      {
                        label: "What It Does",
                        text: "Provides the deterministic legal baseline used to compute expected fees and variance.",
                      },
                      {
                        label: "Why It Matters",
                        text: "Certification is not legally defensible if the contract layer is incomplete or sourced from the wrong document.",
                      },
                    ]}
                    footerLabel="Evidence Source"
                    footerValue="Signed agreement or addendum"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    {workspace.contract.map((field) => (
                      <div key={field.label} className="rounded-xl border border-[var(--border)] bg-white p-4">
                        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {field.label}
                        </div>
                        <div className="mt-2 text-lg font-semibold">{field.value}</div>
                        <div className="mt-1 text-sm text-[var(--muted)]">Source: {field.source}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="mb-4 font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                    Missing Fields
                  </div>
                  <div className="space-y-3">
                    {missing.length > 0 ? (
                      missing.map((field) => (
                        <div key={field.canonical} className="rounded-xl border border-[rgba(214,48,49,0.12)] bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{field.canonical}</div>
                              <div className="mt-1 text-sm text-[var(--muted)]">
                                Source column: {field.source || "Not mapped"}
                              </div>
                            </div>
                            <Badge tone={field.required ? "danger" : "warning"}>
                              {field.required ? "Required gap" : "Optional gap"}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">
                        No missing fields remain in this workspace.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <SectionCard className="bg-[var(--surface)]">
                  <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                    Vault Record
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <MetaBlock label="Version" value={workspace.vault.version} />
                    <MetaBlock label="Sealed By" value={workspace.vault.sealedBy} />
                    <MetaBlock label="Sealed At" value={workspace.vault.sealedAt} />
                    <MetaBlock label="Hash" value={workspace.vault.hash} />
                  </div>
                </SectionCard>

                <SectionCard className="bg-[var(--surface)]">
                  <PanelTitle
                    title="Upload Statement"
                    tipTitle="Schema Registry · Upload Statement"
                    sections={[
                      {
                        label: "What It Is",
                        text: "A release-readiness summary based on required field coverage and mapping confidence.",
                      },
                      {
                        label: "What It Does",
                        text: "Shows whether the current workspace is safe to use for upload validation and certification.",
                      },
                      {
                        label: "Why It Matters",
                        text: "This is the quickest place to catch blocked uploads before they contaminate downstream scoring.",
                      },
                    ]}
                    footerLabel="Gate"
                    footerValue="Required fields must be verified"
                  />
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                      <span>Required fields verified</span>
                      <span className={requiredMissing.length === 0 ? "text-[var(--success)]" : "text-[var(--accent)]"}>
                        {requiredFields.length - requiredMissing.length}/{requiredFields.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                      <span>Optional review items</span>
                      <span className={review.length === 0 ? "text-[var(--success)]" : "text-[#b86a00]"}>
                        {review.length}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm leading-6 text-[var(--muted)]">
                      {uploadReady
                        ? "The active workspace is ready for upload validation, intake reconciliation, and downstream certification."
                        : requiredMissing.length > 0
                          ? "One or more required canonical fields are unresolved. Upload validation should be treated as blocked until these are fixed."
                          : "The workspace is structurally complete, but one or more fields still require governance review before sealing."}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                    Verification Flow
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                    <p>1. Confirm native CSV headers match the mapped source columns.</p>
                    <p>2. Verify contract terms against the signed agreement and bank statement context.</p>
                    <p>3. Resolve all missing or amber mappings before sealing.</p>
                    <p>4. Seal only after governance review, because the vault state becomes evidentiary truth.</p>
                  </div>
                </SectionCard>
              </div>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

function StatCard({
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

function PanelTitle({
  footerLabel,
  footerValue,
  sections,
  tipTitle,
  title,
}: {
  footerLabel?: string;
  footerValue?: string;
  sections: { label: string; text: string }[];
  tipTitle: string;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
      <span>{title}</span>
      <HelpTip title={tipTitle} sections={sections} footerLabel={footerLabel} footerValue={footerValue} />
    </div>
  );
}
