import { useRef } from "react";
import { contractInputDefinitions } from "../data";
import type { IntakeState, IntakeStepKey, UploadArtifact } from "../types";

const intakeLabels: Record<IntakeStepKey, string> = {
  uploaded: "File received",
  hash: "SHA-256 verified",
  schema: "Schema columns matched",
  fields: "Required fields present",
};

export function ArtifactWorkflowModal({
  artifact,
  contractValues,
  intake,
  moduleId,
  onClose,
  onFieldChange,
  onFileSelected,
  onProgressIntake,
}: {
  artifact: UploadArtifact;
  contractValues: Record<string, string>;
  intake: IntakeState;
  moduleId: "M01" | "M02";
  onClose: () => void;
  onFieldChange: (fieldId: string, value: string) => void;
  onFileSelected: (file: File) => void;
  onProgressIntake: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualMode = artifact.type === "Manual Entry" || contractValues.__entry_mode === "manual";
  const fieldDefs = getManualFieldDefs(moduleId, artifact);
  const requiredFields = fieldDefs.filter((field) => field.required);
  const completedRequired = requiredFields.filter((field) => contractValues[field.id]?.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              {artifact.label}
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {moduleId} / {artifact.type}
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

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-r border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
              Intake Status
            </div>
            <div className="space-y-3">
              {(Object.keys(intakeLabels) as IntakeStepKey[]).map((step) => {
                const done = intake[step];
                return (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        done ? "bg-[var(--success)] text-white" : "bg-[var(--panel-soft)] text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span>{intakeLabels[step]}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm leading-6 text-[var(--muted)]">
              {intake.fileName ? (
                <>
                  <div>File: {intake.fileName}</div>
                  <div>Rows: {intake.rows ?? "-"}</div>
                  <div>Hash: {intake.hashValue ?? "Pending"}</div>
                </>
              ) : manualMode ? (
                "Manual entry can be used when the native export is unavailable, but the resulting record still needs validation before certification."
              ) : (
                "Files are hashed at intake before certification. Upload exact portal exports without reformatting."
              )}
            </div>

            {manualMode ? (
              <button
                type="button"
                onClick={onProgressIntake}
                className="mt-4 w-full rounded-lg bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                Validate Manual Entry
              </button>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={artifact.type === "CSV" ? ".csv,text/csv" : ".pdf,application/pdf"}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFileSelected(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 w-full rounded-lg bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Choose File
                </button>
                <button
                  type="button"
                  onClick={onProgressIntake}
                  className="mt-3 w-full rounded-lg border border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Advance Intake Checks
                </button>
              </>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-6">
            {artifact.type !== "Manual Entry" ? (
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => onFieldChange("__entry_mode", "upload")}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    !manualMode
                      ? "bg-[var(--text)] font-semibold text-white"
                      : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => onFieldChange("__entry_mode", "manual")}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    manualMode
                      ? "bg-[var(--text)] font-semibold text-white"
                      : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                  }`}
                >
                  Manual Entry
                </button>
              </div>
            ) : null}

            {manualMode ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                    {artifact.type === "Manual Entry" ? "Contract Config" : "Manual Entry"}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {completedRequired} / {requiredFields.length} required fields
                  </div>
                </div>
                <div className="space-y-4">
                  {fieldDefs.map((field) => (
                    <div key={field.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="font-medium">{field.label}</div>
                        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                          {field.required ? "Required" : "Optional"}
                        </span>
                      </div>

                      {field.type === "select" ? (
                        <select
                          value={contractValues[field.id] ?? ""}
                          onChange={(event) => onFieldChange(field.id, event.target.value)}
                          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                        >
                          <option value="">Select...</option>
                          {field.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          value={contractValues[field.id] ?? ""}
                          onChange={(event) => onFieldChange(field.id, event.target.value)}
                          className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                          placeholder={field.placeholder}
                        />
                      ) : (
                        <input
                          type={field.type === "month" ? "month" : field.type}
                          value={contractValues[field.id] ?? ""}
                          onChange={(event) => onFieldChange(field.id, event.target.value)}
                          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
                          placeholder={field.placeholder}
                        />
                      )}
                      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{field.help}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
                  Upload Guidance
                </div>
                <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
                  Upload the native source file exactly as downloaded. The original app computes an intake hash,
                  validates schema compatibility, and confirms required fields before the evidence is used.
                </div>
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="font-medium">Current Artifact Note</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{artifact.note}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getManualFieldDefs(moduleId: "M01" | "M02", artifact: UploadArtifact) {
  if (artifact.type === "Manual Entry") {
    return contractInputDefinitions[moduleId];
  }

  if (artifact.key.includes("processor")) {
    return [
      field("statement_period", "Statement Period", "month", true, "Certification month for the processor export."),
      field("processor_name", "Processor Name", "text", true, "Processor or platform this statement came from."),
      field("transaction_count", "Transaction Count", "number", true, "Total transactions represented by the manual entry."),
      field("gross_volume", "Gross Volume ($)", "number", true, "Total transaction value from the statement."),
      field("fees_total", "Total Fees ($)", "number", true, "Total processor fees for the same period."),
      field("notes", "Notes", "textarea", false, "Capture any exceptions or assumptions used during manual entry."),
    ];
  }

  if (artifact.key.includes("settlement")) {
    return [
      field("statement_period", "Statement Period", "month", true, "Settlement month for the DSP export."),
      field("dsp_name", "DSP Name", "text", true, "Delivery platform represented by this record."),
      field("order_count", "Order Count", "number", true, "Total DSP orders in the period."),
      field("gross_sales", "Gross Sales ($)", "number", true, "Platform-reported gross sales."),
      field("payout_total", "Payout Total ($)", "number", true, "Net amount remitted to the restaurant."),
      field("commission_total", "Commission Total ($)", "number", false, "Commission total if separately known."),
    ];
  }

  if (artifact.key.includes("pos")) {
    return [
      field("statement_period", "Statement Period", "month", true, "Reporting month for the POS summary."),
      field("pos_system", "POS System", "text", true, "Originating POS platform."),
      field("channel_sales", "Channel Sales ($)", "number", true, "Total delivery-channel sales for reconciliation."),
      field("order_count", "Order Count", "number", true, "Total orders in the same period."),
      field("variance_note", "Variance Note", "textarea", false, "Explain any mismatch between POS and settlement totals."),
    ];
  }

  if (artifact.key.includes("agreement") || artifact.key.includes("agr")) {
    return [
      field("counterparty", "Counterparty", "text", true, "Processor or DSP named in the signed agreement."),
      field("effective_date", "Effective Date", "date", true, "Agreement effective date."),
      field("rate_summary", "Rate Summary", "textarea", true, "Key contracted rate terms or commission schedule."),
      field("base_definition", "Commission/Base Definition", "text", false, "Source-of-truth basis for fee calculation."),
      field("notes", "Notes", "textarea", false, "Addenda or exceptions that affect contract interpretation."),
    ];
  }

  if (artifact.key.includes("bank")) {
    return [
      field("bank_name", "Bank Name", "text", true, "Bank used for the deposit record."),
      field("acct_last4", "Account Last 4", "text", true, "Last four digits of the account number."),
      field("statement_period", "Statement Period", "month", true, "Period covered by the deposit evidence."),
      field("deposit_total", "Total Deposits ($)", "number", true, "Total relevant deposits for the period."),
      field("reconciliation_note", "Reconciliation Note", "textarea", false, "Explain any timing or settlement differences."),
    ];
  }

  return [
    field("source_name", "Source Name", "text", true, "Name of the source system or document."),
    field("statement_period", "Statement Period", "month", true, "Reporting period for the manual record."),
    field("summary", "Summary", "textarea", true, "Manual reconstruction of the artifact contents."),
    field("notes", "Notes", "textarea", false, "Anything the reviewer should know about this manual fallback."),
  ];
}

function field(
  id: string,
  label: string,
  type: "text" | "number" | "date" | "email" | "textarea" | "select" | "month",
  required: boolean,
  help: string,
  options?: string[],
) {
  return {
    id,
    label,
    placeholder: "",
    required,
    help,
    type,
    options,
  };
}
