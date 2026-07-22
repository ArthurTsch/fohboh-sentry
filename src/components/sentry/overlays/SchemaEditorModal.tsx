import { useMemo, useRef, useState } from "react";
import type { IntakeState, PosSchemaGovernance, Role, SchemaWorkspace, UploadReceipt } from "../types";
import { Badge, HelpTip, MetaBlock } from "../ui/primitives";
import { getExpectedHeaders } from "@/lib/uploads/definitions";

type TabId = "mappings" | "contract" | "missing" | "posschema" | "upload" | "vault";

type ComparisonFieldDefinition = {
  description: string;
  field: string;
  required: boolean;
};

const CANONICAL_FIELD_HELP: Record<
  string,
  {
    whatDoes: string;
    whatIs: string;
    whyMatters: string;
  }
> = {
  gross_sales_amount: {
    whatDoes: "Feeds the engine with the billed card-sales base used to reconstruct expected processor fees.",
    whatIs: "The gross card-processing sales amount from the governed processor source file, typically a CSV export.",
    whyMatters: "M01 fee-overcharge calculations and Trust Score checks break if the sales base is mapped to the wrong source column.",
  },
  processor_markup_bps: {
    whatDoes: "Lets the engine compare observed fee behavior against the sealed processor markup basis points.",
    whatIs: "The markup or effective processor-bps field extracted from the governed processor source file.",
    whyMatters: "This field is used to detect markup drift, overbilling, and variance against the sealed contract configuration.",
  },
  network_fee_amount: {
    whatDoes: "Adds network-fee evidence into the fee reconstruction path when the source vendor exposes it separately.",
    whatIs: "An optional source column for pass-through network-fee amounts from the governed processor file.",
    whyMatters: "When available, it improves the accuracy of fee attribution and reduces false review flags in certification.",
  },
};

export function SchemaEditorModal({
  workspace,
  onClose,
  onSave,
  onSeal,
  onUploadGovernedArtifact,
  role,
  governedAgreementIntake,
  governedSourceIntake,
}: {
  workspace: SchemaWorkspace;
  onClose: () => void;
  onSave: (workspace: SchemaWorkspace) => void | Promise<void>;
  onSeal: (workspace: SchemaWorkspace) => void | Promise<void>;
  onUploadGovernedArtifact?: (
    workspace: SchemaWorkspace,
    artifactKind: "source" | "agreement",
    file: File,
  ) => Promise<UploadReceipt | null>;
  role: Role;
  governedAgreementIntake?: IntakeState | null;
  governedSourceIntake?: IntakeState | null;
}) {
  const [draft, setDraft] = useState<SchemaWorkspace>({
    ...workspace,
    posSchema: workspace.posSchema ?? createEmptyPosSchema(),
  });
  const [tab, setTab] = useState<TabId>("mappings");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceFileInputRef = useRef<HTMLInputElement | null>(null);
  const agreementFileInputRef = useRef<HTMLInputElement | null>(null);
  const [governedUploadState, setGovernedUploadState] = useState<{
    artifactKind: "source" | "agreement" | null;
    error: string | null;
  }>({
    artifactKind: null,
    error: null,
  });
  const canSeal = role === "WGS Manager" || role === "SuperAdmin";
  const canEditGovernanceHeaders =
    role === "Admin" || role === "SuperAdmin" || role === "WGS Manager";
  const canUploadGovernedDocuments =
    role === "Admin" || role === "SuperAdmin" || role === "WGS Manager";

  const requiredRemaining = useMemo(
    () => draft.fields.filter((field) => field.required && field.confidence !== "Verified").length,
    [draft.fields],
  );

  const verifiedFields = draft.fields.filter((field) => field.confidence === "Verified");
  const reviewFields = draft.fields.filter((field) => field.confidence === "Needs Review");
  const missingFields = draft.fields.filter((field) => field.confidence === "Missing");
  const uploadReady = requiredRemaining === 0 && reviewFields.length === 0;
  const posSchema = draft.posSchema ?? createEmptyPosSchema();
  const posSchemaValidated = posSchema.validatedHeaders.length > 0;
  const vendorKey = normalizeSchemaVendorKey(draft.vendor);
  const comparisonFieldDefinitions = useMemo(
    () => getComparisonFieldDefinitions(draft.module, vendorKey),
    [draft.module, vendorKey],
  );
  const comparisonCandidateHeaders = useMemo(
    () => uniqueHeaders([...posSchema.extractedHeaders, ...posSchema.manualHeaders]),
    [posSchema.extractedHeaders, posSchema.manualHeaders],
  );
  const comparisonBindings = useMemo(
    () => mergeHeaderBindings(comparisonFieldDefinitions, posSchema.headerBindings ?? [], comparisonCandidateHeaders),
    [comparisonCandidateHeaders, comparisonFieldDefinitions, posSchema.headerBindings],
  );
  const headerAttentionNeeded =
    !posSchemaValidated || missingFields.length > 0 || reviewFields.length > 0;
  const sourceLabel =
    draft.module === "M01" ? `${draft.vendor} processor source file` : `${draft.vendor} settlement source file`;
  const agreementLabel =
    draft.module === "M01" ? `signed ${draft.vendor} merchant agreement PDF` : `signed ${draft.vendor} DSP agreement PDF`;

  async function handleGovernedUpload(
    artifactKind: "source" | "agreement",
    file: File,
    input: HTMLInputElement,
  ) {
    if (!onUploadGovernedArtifact) {
      input.value = "";
      return;
    }

    setGovernedUploadState({
      artifactKind,
      error: null,
    });

    try {
      await onUploadGovernedArtifact(draft, artifactKind, file);
    } catch (error) {
      setGovernedUploadState({
        artifactKind: null,
        error: error instanceof Error ? error.message : "Unable to upload the governed document right now.",
      });
      input.value = "";
      return;
    }

    setGovernedUploadState({
      artifactKind: null,
      error: null,
    });
    input.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            const text = await file.text();
            const extractedHeaders = extractCsvHeaders(text);
            setDraft((current) => ({
              ...current,
              posSchema: {
                ...(current.posSchema ?? createEmptyPosSchema()),
                extractedAt: new Date().toISOString(),
                extractedHeaders,
                sourceFileName: file.name,
                status: extractedHeaders.length > 0 ? "draft" : "missing",
              },
            }));
            input.value = "";
          }}
        />
        <input
          ref={sourceFileInputRef}
          type="file"
          accept={draft.module === "M01" ? ".csv,.pdf,text/csv,application/pdf" : ".csv,text/csv"}
          className="hidden"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            await handleGovernedUpload("source", file, input);
          }}
        />
        <input
          ref={agreementFileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            await handleGovernedUpload("agreement", file, input);
          }}
        />
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
              { id: "posschema" as const, label: "Comparison Source Schema" },
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
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{field.canonical}</div>
                        {CANONICAL_FIELD_HELP[field.canonical] ? (
                          <HelpTip
                            title={`Schema Field · ${field.canonical}`}
                            sections={[
                              {
                                label: "What It Is",
                                text: CANONICAL_FIELD_HELP[field.canonical].whatIs,
                              },
                              {
                                label: "What It Does",
                                text: CANONICAL_FIELD_HELP[field.canonical].whatDoes,
                              },
                              {
                                label: "Why It Matters",
                                text: CANONICAL_FIELD_HELP[field.canonical].whyMatters,
                              },
                            ]}
                          />
                        ) : null}
                      </div>
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

            {tab === "posschema" ? (
              <div className="space-y-4">
                <TabHeading
                  title="Comparison Source Schema"
                  tipTitle="Schema Editor · Comparison Source Schema"
                  sections={[
                    {
                      label: "What It Is",
                      text: "A governed binding set between the app's comparison-source fields and the real headers exported by this vendor.",
                    },
                    {
                      label: "What It Does",
                      text: "Defines the expected live comparison-source columns used to validate recurring uploads before certification.",
                    },
                    {
                      label: "Why It Matters",
                      text: "If the vendor file shape changes and this governed binding set is stale, reconciliation can fail even when evidence is otherwise complete.",
                    },
                  ]}
                />

                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                        Governed comparison-source header map
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        Upload a representative comparison-source CSV, review the extracted headers, or type them manually.
                        Then bind the app fields below to the real vendor headers. Those bindings are sealed with the workspace and reused by Upload Data.
                      </div>
                    </div>
                    <Badge tone={posSchemaValidated ? "success" : posSchema.status === "draft" ? "warning" : "danger"}>
                      {posSchemaValidated ? "Validated" : posSchema.status === "draft" ? "Draft review" : "Missing"}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                    >
                      Upload Comparison CSV
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          posSchema: commitHeaderBindings(
                            current.posSchema ?? createEmptyPosSchema(),
                            comparisonFieldDefinitions,
                            comparisonCandidateHeaders,
                            current.posSchema?.manualHeaders ?? [],
                          ),
                        }))
                      }
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                    >
                      Validate Manual Mapping
                    </button>
                    <button
                      type="button"
                      disabled={posSchema.extractedHeaders.length === 0}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          posSchema: commitHeaderBindings(
                            current.posSchema ?? createEmptyPosSchema(),
                            comparisonFieldDefinitions,
                            comparisonCandidateHeaders,
                            current.posSchema?.extractedHeaders ?? [],
                          ),
                        }))
                      }
                      className={`rounded-lg border px-4 py-2 text-sm transition disabled:opacity-50 ${
                        posSchemaValidated
                          ? "border-[rgba(0,200,83,0.22)] bg-[rgba(0,200,83,0.08)] font-semibold text-[var(--success)]"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                      }`}
                    >
                      {posSchemaValidated ? "Extracted Mapping Validated" : "Validate Extracted Mapping"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-medium">Extracted headers from sample CSV</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {posSchema.sourceFileName
                          ? `Source file: ${posSchema.sourceFileName}`
                          : "No comparison-source sample uploaded yet."}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {posSchema.extractedHeaders.length > 0 ? (
                          posSchema.extractedHeaders.map((header) => (
                            <span
                              key={`extracted:${header}`}
                              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text)]"
                            >
                              {header}
                            </span>
                          ))
                        ) : (
                          <div className="text-sm text-[var(--muted)]">
                            Upload a representative comparison-source CSV to extract the native vendor headers automatically.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-medium">Manual header entry</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        Enter one header per line or comma-separated if extraction is incomplete or the vendor changed layout.
                      </div>
                      <textarea
                        value={posSchema.manualHeaders.join("\n")}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            posSchema: {
                              ...(current.posSchema ?? createEmptyPosSchema()),
                              manualHeaders: parseHeaderList(event.target.value),
                              status: "draft",
                            },
                          }))
                        }
                        className="mt-3 min-h-[180px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                        placeholder="Settled date&#10;Payments&#10;Payout"
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
                    <div className="font-medium">App field to vendor header binding</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      The app fields on the left are what the certification engine expects. Bind each one to the real header from the uploaded vendor file.
                    </div>
                    <div className="mt-4 space-y-3">
                      {comparisonFieldDefinitions.map((definition) => {
                        const binding = comparisonBindings.find((item) => item.appField === definition.field);
                        return (
                          <div
                            key={definition.field}
                            className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[1fr_1fr]"
                          >
                            <div>
                              <div className="font-medium text-[var(--text)]">{definition.field}</div>
                              <div className="mt-1 text-xs text-[var(--muted)]">
                                {definition.required ? "Required app field" : "Optional app field"} · {definition.description}
                              </div>
                            </div>
                            <select
                              value={binding?.sourceHeader ?? ""}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  posSchema: updatePosSchemaBinding(
                                    current.posSchema ?? createEmptyPosSchema(),
                                    definition.field,
                                    event.target.value,
                                  ),
                                }))
                              }
                              className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                            >
                              <option value="">Select vendor header...</option>
                              {comparisonCandidateHeaders.map((header) => (
                                <option key={`${definition.field}:${header}`} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
                    <div className="font-medium">Sealed binding preview</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      This is the governed comparison-source binding set that will be stored in the workspace and reused by Upload Data validation.
                    </div>
                    <div className="mt-3 space-y-2">
                      {comparisonBindings.length > 0 ? (
                        comparisonBindings.map((binding) => (
                          <div
                            key={`validated:${binding.appField}`}
                            className="grid gap-2 rounded-xl border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] px-4 py-3 text-sm md:grid-cols-[1fr_auto_1fr]"
                          >
                            <span className="font-medium text-[var(--text)]">{binding.appField}</span>
                            <span className="font-[family-name:var(--font-mono)] text-[var(--success)]">→</span>
                            <span className="font-[family-name:var(--font-mono)] text-[var(--success)]">{binding.sourceHeader}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--muted)]">
                          No validated comparison-source bindings are staged for seal yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">Governed source file</div>
                        <div className="mt-1 text-sm text-[var(--muted)]">
                          Upload the native governed source file for this workspace directly in Schema Editor. This is
                          the source document required for governance seal, separate from later recurring Upload Data.
                        </div>
                      </div>
                      <Badge tone={governedSourceIntake?.uploaded ? "success" : "warning"}>
                        {governedSourceIntake?.uploaded ? "Uploaded" : "Required for seal"}
                      </Badge>
                    </div>
                    <div className="mt-4">
                      <GovernedUploadCard
                        actionLabel={draft.module === "M01" ? "Upload Source CSV/PDF" : "Upload Settlement CSV"}
                        artifactLabel={sourceLabel}
                        busy={governedUploadState.artifactKind === "source"}
                        canUpload={canUploadGovernedDocuments && Boolean(onUploadGovernedArtifact)}
                        helperText={
                          draft.module === "M01"
                            ? "Use the exact processor export that governs this M01 workspace. CSV is preferred; original processor PDF is accepted when supported."
                            : "Use the exact settlement CSV that governs this M02 workspace."
                        }
                        intake={governedSourceIntake ?? undefined}
                        lockedText="Contact an Admin, SuperAdmin, or WGS Manager to attach the governed source file for seal."
                        onUpload={() => sourceFileInputRef.current?.click()}
                      />
                    </div>
                  </div>
                </div>
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
                <div
                  className={`rounded-3xl border p-5 ${
                    headerAttentionNeeded
                      ? "border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)]"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--text)]">
                        Governed Header Control
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {headerAttentionNeeded
                          ? "A comparison-source review is recommended before sealing. Open the Comparison Source Schema tab to update the governed header bindings when vendor columns no longer match."
                          : "The governed comparison-source header bindings are already validated for this workspace."}
                      </div>
                    </div>
                    <Badge tone={headerAttentionNeeded ? "warning" : "success"}>
                      {headerAttentionNeeded ? "Review recommended" : "Headers validated"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTab("posschema")}
                      disabled={!canEditGovernanceHeaders}
                      className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[#D8D9E0] disabled:text-[#7C8092]"
                    >
                      Change Governed Mapping
                    </button>
                    {!canEditGovernanceHeaders ? (
                      <div className="text-sm leading-6 text-[var(--muted)]">
                        Contact an Admin, SuperAdmin, or WGS Manager to update and reseal governed headers.
                      </div>
                    ) : (
                      <div className="text-sm leading-6 text-[var(--muted)]">
                        Updating bindings here changes the governed comparison-source schema used by Upload Data validation after the workspace is resealed.
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--text)]">
                        Governed Source Documents
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        Upload the governed source documents here before sealing. This keeps the seal workflow self-contained
                        and avoids routing you to Upload Data before the vault is ready.
                      </div>
                    </div>
                    <Badge
                      tone={
                        governedSourceIntake?.uploaded && governedAgreementIntake?.uploaded
                          ? "success"
                          : governedSourceIntake?.uploaded || governedAgreementIntake?.uploaded
                            ? "warning"
                            : "danger"
                      }
                    >
                      {governedSourceIntake?.uploaded && governedAgreementIntake?.uploaded
                        ? "Seal evidence ready"
                        : "Uploads required"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <GovernedUploadCard
                      actionLabel={draft.module === "M01" ? "Upload Source CSV/PDF" : "Upload Settlement CSV"}
                      artifactLabel={sourceLabel}
                      busy={governedUploadState.artifactKind === "source"}
                      canUpload={canUploadGovernedDocuments && Boolean(onUploadGovernedArtifact)}
                      helperText={
                        draft.module === "M01"
                          ? "Upload the exact processor export used to govern this M01 workspace. CSV is preferred; original processor PDF is accepted when supported."
                          : "Upload the exact DSP settlement CSV used to govern this M02 workspace."
                      }
                      intake={governedSourceIntake ?? undefined}
                      lockedText="Contact an Admin, SuperAdmin, or WGS Manager to attach the governed source file for seal."
                      onUpload={() => sourceFileInputRef.current?.click()}
                    />
                    <GovernedUploadCard
                      actionLabel="Upload Agreement PDF"
                      artifactLabel={agreementLabel}
                      busy={governedUploadState.artifactKind === "agreement"}
                      canUpload={canUploadGovernedDocuments && Boolean(onUploadGovernedArtifact)}
                      helperText="Upload the signed agreement PDF that backs the contract terms sealed into this governed workspace."
                      intake={governedAgreementIntake ?? undefined}
                      lockedText="Contact an Admin, SuperAdmin, or WGS Manager to attach the signed agreement required for seal."
                      onUpload={() => agreementFileInputRef.current?.click()}
                    />
                  </div>
                  {governedUploadState.error ? (
                    <div className="mt-4 rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm leading-6 text-[var(--accent)]">
                      {governedUploadState.error}
                    </div>
                  ) : null}
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
            {!canSeal ? (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm leading-6 text-[var(--muted)]">
                WGS-only action. Admin may prepare and save the draft, but the final seal must be completed by WGS.
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="font-medium">Readiness summary</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <div>Verified fields: {verifiedFields.length}</div>
                <div>Review items: {reviewFields.length}</div>
                <div>Missing fields: {missingFields.length}</div>
                <div className={posSchemaValidated ? "font-medium text-[var(--success)]" : undefined}>
                  Comparison schema:{" "}
                  {posSchemaValidated ? `${posSchema.validatedHeaders.length} validated headers` : "Not validated yet"}
                </div>
                <div>Upload gate: {uploadReady ? "Release Ready" : "Blocked / Review"}</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="font-medium">Verification flow</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <div>1. Confirm native headers against canonical fields.</div>
                <div className={posSchemaValidated ? "font-medium text-[var(--success)]" : undefined}>
                  2. Validate the governed comparison-source header bindings.
                </div>
                <div>3. Verify contract terms against the signed agreement.</div>
                <div>4. Resolve all amber or missing controls.</div>
                <div>5. Seal only when the workspace reflects evidentiary truth.</div>
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
          {canSeal ? (
            <button
              type="button"
              onClick={() => onSeal(draft)}
              className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:opacity-50"
              disabled={requiredRemaining > 0}
            >
              Seal Contract Config
            </button>
          ) : (
            <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">
              Waiting for WGS seal
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function createEmptyPosSchema(): PosSchemaGovernance {
  return {
    extractedHeaders: [],
    headerBindings: [],
    manualHeaders: [],
    status: "missing",
    validatedHeaders: [],
  };
}

function extractCsvHeaders(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  if (!firstLine) {
    return [];
  }

  return splitCsvLine(firstLine).map(normalizeHeaderToken).filter(Boolean);
}

function parseHeaderList(value: string) {
  return value
    .split(/[\n,]+/)
    .map(normalizeHeaderToken)
    .filter(Boolean);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeHeaderToken(value: string) {
  return value.trim().replace(/^"+|"+$/g, "").trim();
}

function normalizeSchemaVendorKey(vendor: string) {
  return vendor.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function uniqueHeaders(headers: string[]) {
  return [...new Set(headers.map((header) => header.trim()).filter(Boolean))];
}

function getComparisonFieldDefinitions(module: "M01" | "M02", vendorKey: string): ComparisonFieldDefinition[] {
  const headers = getExpectedHeaders(module === "M01" ? "m01-pos" : "m02-pos", vendorKey);
  return headers.map((field) => ({
    description: getComparisonFieldDescription(field),
    field,
    required: true,
  }));
}

function getComparisonFieldDescription(field: string) {
  const descriptions: Record<string, string> = {
    date: "Primary comparison date used by the engine for source-period alignment.",
    batch_date: "Settlement or batch-close date used for lag and payout timing checks.",
    pos_merchant_sales: "Gross merchant sales amount from the comparison-source file.",
    platform_net_sales: "Net payout or settled amount from the comparison-source file.",
    transaction_fees: "Fees shown on the comparison-source file for payout reconciliation.",
    processing_fees: "Processor fee column when the vendor exposes it separately.",
    other_merchant_fees: "Additional withholdings or other merchant fees.",
    calculated_recovery_variance: "Vendor-side variance field if the source exposes one.",
    bank_deposit_amount: "Deposit amount expected to tie to bank evidence.",
    external_ref_id:
      "Reference or payout ID used to match comparison-source payout rows against bank-deposit rows during reconciliation.",
    card_type: "Card or tender type where exposed by the source.",
    entry_method: "Entry method or transaction routing metadata.",
    interchange_rate_applied: "Applied interchange or effective rate field if exposed.",
    transaction_count: "Transaction volume field used by the engine.",
    notes: "Free-form notes or status column when the source includes it.",
    channel: "Sales channel from the source file.",
    pos_net_sales: "Net sales amount at channel level.",
    commission_variance: "Variance field between expected and observed channel economics.",
    gross_sales: "Gross sales total from the comparison-source file.",
    tenders: "Tender summary field or category field from the comparison-source file.",
    transactions: "Transaction-count field from the comparison-source file.",
  };

  return descriptions[field] ?? "Governed comparison-source field used by upload validation and certification.";
}

function getSourceHeaderAliases(field: string) {
  const aliases: Record<string, string[]> = {
    date: ["date", "settled date", "settled_date"],
    batch_date: ["batch_date", "sales period end", "sales_period_end", "batch date"],
    pos_merchant_sales: ["pos_merchant_sales", "payments", "gross_sales", "gross sales"],
    platform_net_sales: ["platform_net_sales", "payout", "net_payout", "deposit", "bank_deposit_amount"],
    transaction_fees: ["transaction_fees", "fees", "processing_fees", "fee_amount"],
    processing_fees: ["processing_fees", "fees"],
    other_merchant_fees: ["other_merchant_fees", "withholdings", "external"],
    calculated_recovery_variance: ["calculated_recovery_variance", "external", "status"],
    bank_deposit_amount: ["bank_deposit_amount", "payout", "deposit", "deposit_amount"],
    external_ref_id: [
      "external_ref_id",
      "external ref. id",
      "external ref id",
      "external_ref._id",
      "reference_id",
      "reference id",
      "deposit_id",
      "deposit id",
      "payout_id",
      "payout id",
    ],
    card_type: ["card_type", "type"],
    entry_method: ["entry_method", "type"],
    interchange_rate_applied: ["interchange_rate_applied", "rate"],
    transaction_count: ["transaction_count", "# txns", "#_txns", "transactions"],
    notes: ["notes", "status", "external ref. id", "external_ref._id"],
    channel: ["channel", "type"],
    pos_net_sales: ["pos_net_sales", "payout", "payments"],
    commission_variance: ["commission_variance", "fees", "external"],
    gross_sales: ["gross_sales", "payments"],
    tenders: ["tenders", "type", "name"],
    transactions: ["transactions", "# txns", "#_txns", "transaction_count"],
  };

  return aliases[field] ?? [field];
}

function inferHeaderBindings(definitions: ComparisonFieldDefinition[], availableHeaders: string[]) {
  const availableByNormalized = new Map(
    availableHeaders.map((header) => [header.trim().toLowerCase(), header]),
  );

  return definitions
    .map((definition) => {
      const sourceHeader = getSourceHeaderAliases(definition.field)
        .map((alias) => availableByNormalized.get(alias.trim().toLowerCase()) ?? "")
        .find(Boolean);

      if (!sourceHeader) {
        return null;
      }

      return {
        appField: definition.field,
        sourceHeader,
      };
    })
    .filter(Boolean) as NonNullable<PosSchemaGovernance["headerBindings"]>;
}

function mergeHeaderBindings(
  definitions: ComparisonFieldDefinition[],
  savedBindings: NonNullable<PosSchemaGovernance["headerBindings"]>,
  availableHeaders: string[],
) {
  const inferred = inferHeaderBindings(definitions, availableHeaders);
  const savedByField = new Map((savedBindings ?? []).map((binding) => [binding.appField, binding]));

  return definitions
    .map((definition) => {
      const saved = savedByField.get(definition.field);
      if (saved?.sourceHeader) {
        return saved;
      }
      return inferred.find((binding) => binding.appField === definition.field) ?? null;
    })
    .filter(Boolean) as NonNullable<PosSchemaGovernance["headerBindings"]>;
}

function updatePosSchemaBinding(posSchema: PosSchemaGovernance, appField: string, sourceHeader: string): PosSchemaGovernance {
  const nextBindings = [
    ...(posSchema.headerBindings ?? []).filter((binding) => binding.appField !== appField),
    ...(sourceHeader ? [{ appField, sourceHeader }] : []),
  ];

  return {
    ...posSchema,
    headerBindings: nextBindings,
    status: nextBindings.length > 0 ? "draft" : "missing",
    validatedHeaders: nextBindings.map((binding) => binding.sourceHeader),
  };
}

function commitHeaderBindings(
  posSchema: PosSchemaGovernance,
  definitions: ComparisonFieldDefinition[],
  availableHeaders: string[],
  preferredHeaders: string[],
): PosSchemaGovernance {
  const candidateHeaders = uniqueHeaders(preferredHeaders.length > 0 ? preferredHeaders : availableHeaders);
  const inferredBindings = inferHeaderBindings(definitions, candidateHeaders);

  return {
    ...posSchema,
    headerBindings: inferredBindings,
    status: inferredBindings.length > 0 ? "validated" : "missing",
    validatedHeaders: inferredBindings.map((binding) => binding.sourceHeader),
  };
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

function GovernedUploadCard({
  actionLabel,
  artifactLabel,
  busy,
  canUpload,
  helperText,
  intake,
  lockedText,
  onUpload,
}: {
  actionLabel: string;
  artifactLabel: string;
  busy: boolean;
  canUpload: boolean;
  helperText: string;
  intake?: IntakeState;
  lockedText: string;
  onUpload: () => void;
}) {
  const ready = Boolean(intake?.uploaded);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[var(--text)]">{artifactLabel}</div>
          <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{helperText}</div>
        </div>
        <Badge tone={ready ? "success" : "warning"}>{ready ? "Uploaded" : "Required"}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onUpload}
          disabled={!canUpload || busy}
          className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[#D8D9E0] disabled:text-[#7C8092]"
        >
          {busy ? "Uploading..." : actionLabel}
        </button>
        {ready ? (
          <div className="text-sm leading-6 text-[var(--muted)]">
            {intake?.fileName ?? "File uploaded"}
          </div>
        ) : (
          <div className="text-sm leading-6 text-[var(--muted)]">
            {canUpload ? "No governed file uploaded yet for this workspace." : lockedText}
          </div>
        )}
      </div>
    </div>
  );
}
