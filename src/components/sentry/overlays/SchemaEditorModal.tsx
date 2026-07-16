import { useMemo, useRef, useState } from "react";
import type { IntakeState, PosSchemaGovernance, Role, SchemaWorkspace, UploadReceipt } from "../types";
import { Badge, HelpTip, MetaBlock } from "../ui/primitives";

type TabId = "mappings" | "contract" | "missing" | "posschema" | "upload" | "vault";

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
              { id: "posschema" as const, label: "POS Source Schema" },
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

            {tab === "posschema" ? (
              <div className="space-y-4">
                <TabHeading
                  title="POS Source Schema"
                  tipTitle="Schema Editor · POS Source Schema"
                  sections={[
                    {
                      label: "What It Is",
                      text: "A governed sample POS export header set for this location, module, and vendor.",
                    },
                    {
                      label: "What It Does",
                      text: "Defines the expected live POS export columns used to validate recurring POS uploads before certification.",
                    },
                    {
                      label: "Why It Matters",
                      text: "If the POS file shape changes and this governed header set is stale, reconciliation can fail even when evidence is otherwise complete.",
                    },
                  ]}
                />

                <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                        Governed POS header set
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        Upload a representative POS CSV export, review the extracted headers, or type them manually.
                        When validated, these headers are sealed with the workspace and reused by Upload Data.
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
                      Upload POS Example CSV
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          posSchema: {
                            ...(current.posSchema ?? createEmptyPosSchema()),
                            status: current.posSchema?.manualHeaders?.length ? "validated" : "missing",
                            validatedHeaders: [...(current.posSchema?.manualHeaders ?? [])],
                          },
                        }))
                      }
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                    >
                      Validate Manual Headers
                    </button>
                    <button
                      type="button"
                      disabled={posSchema.extractedHeaders.length === 0}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          posSchema: {
                            ...(current.posSchema ?? createEmptyPosSchema()),
                            status: current.posSchema?.extractedHeaders?.length ? "validated" : "missing",
                            validatedHeaders: [...(current.posSchema?.extractedHeaders ?? [])],
                          },
                        }))
                      }
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:opacity-50"
                    >
                      Validate Extracted Headers
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-medium">Extracted headers from sample CSV</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {posSchema.sourceFileName
                          ? `Source file: ${posSchema.sourceFileName}`
                          : "No sample POS export uploaded yet."}
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
                            Upload a representative POS export CSV to extract the native headers automatically.
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
                        placeholder="date&#10;batch_date&#10;pos_merchant_sales"
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
                    <div className="font-medium">Sealed header set preview</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      This is the POS header set that will be stored in the governed workspace and reused by Upload Data validation.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {posSchema.validatedHeaders.length > 0 ? (
                        posSchema.validatedHeaders.map((header) => (
                          <span
                            key={`validated:${header}`}
                            className="rounded-full border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--success)]"
                          >
                            {header}
                          </span>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--muted)]">
                          No validated POS headers are staged for seal yet.
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
                          ? "A header review is recommended before sealing. Open the POS Source Schema tab to update the governed header set when source columns no longer match."
                          : "The governed POS header set is already validated for this workspace."}
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
                      Change Governed Headers
                    </button>
                    {!canEditGovernanceHeaders ? (
                      <div className="text-sm leading-6 text-[var(--muted)]">
                        Contact an Admin, SuperAdmin, or WGS Manager to update and reseal governed headers.
                      </div>
                    ) : (
                      <div className="text-sm leading-6 text-[var(--muted)]">
                        Updating headers here changes the governed POS schema used by Upload Data validation after the workspace is resealed.
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
                <div>POS schema: {posSchemaValidated ? `${posSchema.validatedHeaders.length} validated headers` : "Not validated yet"}</div>
                <div>Upload gate: {uploadReady ? "Release Ready" : "Blocked / Review"}</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="font-medium">Verification flow</div>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <div>1. Confirm native headers against canonical fields.</div>
                <div>2. Validate the governed POS sample header set.</div>
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
