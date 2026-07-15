import { useRef } from "react";
import { contractInputDefinitions } from "../data";
import type { IntakeState, UploadArtifact } from "../types";

const M01_CARD_BRANDS = [
  "Visa CPS Retail",
  "Visa Rewards",
  "Visa Business",
  "MC Merit I",
  "MC Merit III",
  "Discover",
  "Amex OptBlue",
  "Debit Regulated",
  "Debit Exempt",
];

const M02_CHANNELS = [
  { label: "Delivery", field: "delivery" },
  { label: "Pickup / Carryout", field: "pickup" },
  { label: "DashPass / Plus Membership", field: "dashpass" },
  { label: "Catering / Group Orders", field: "catering" },
  { label: "In-App Sponsored Listing", field: "sponsored" },
];

const FIELD_ALIASES: Record<string, string[]> = {
  contract_type: ["pricing_model"],
  pricing_model: ["contract_type"],
  rate_dashpass: ["rate_member"],
  rate_member: ["rate_dashpass"],
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
  vendorName,
}: {
  artifact: UploadArtifact;
  contractValues: Record<string, string>;
  intake: IntakeState;
  moduleId: "M01" | "M02";
  onClose: () => void;
  onFieldChange: (fieldId: string, value: string) => void;
  onFileSelected: (file: File) => void;
  onProgressIntake: () => void;
  vendorName?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualMode = artifact.type === "Manual Entry";
  const fieldDefs = getManualFieldDefs(moduleId, artifact);
  const requiredFieldIds = getRequiredFieldIds(moduleId, artifact, fieldDefs);
  const completedRequired = requiredFieldIds.filter((fieldId) => getFieldValue(contractValues, fieldId).trim()).length;
  const manualActionLabel = getManualActionLabel(artifact);
  const progressActionLabel = getProgressActionLabel(artifact);
  const manualSaveReady = requiredFieldIds.length > 0 && completedRequired === requiredFieldIds.length;
  const ready = intake.uploaded && intake.hash && intake.schema && intake.fields;
  const workflowSteps = [
    {
      done: intake.uploaded,
      label: manualMode ? "Collect Source Truth" : "Receive Source File",
      detail: manualMode
        ? "Enter the source values or fallback facts that reconstruct this artifact for the certification period."
        : "Capture the native source file exactly as exported from the upstream system.",
    },
    {
      done: intake.hash,
      label: manualMode ? "Validate Entry Integrity" : "Verify SHA-256 Integrity",
      detail: manualMode
        ? "Confirm the manually entered record is complete enough to stand in for the source document."
        : "Record the tamper-evident integrity fingerprint used for chain-of-custody proof.",
    },
    {
      done: intake.schema,
      label: "Match Active Schema",
      detail:
        "Bind the artifact to the active workspace and confirm the data shape aligns with the governed schema model.",
    },
    {
      done: intake.fields,
      label: manualMode ? "Save and Seal Ready" : "Field Readiness",
      detail: manualMode
        ? "Required values are complete and the artifact is ready to be treated as contract or evidence input."
        : "Required certification fields are present and the artifact can move into governed review.",
    },
  ];

  const handleFieldChange = (fieldId: string, value: string) => {
    onFieldChange(fieldId, value);
    for (const alias of FIELD_ALIASES[fieldId] ?? []) {
      onFieldChange(alias, value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              {manualMode ? "Manual Intake Pipeline" : "Artifact Intake Pipeline"}
            </div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              {artifact.label}
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {moduleId} / {vendorName ? `${vendorName} / ` : ""}{artifact.type} / Source Truth {"->"} Integrity {"->"} Schema {"->"} Ready
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
              Intake Steps
            </div>
            <div className="space-y-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      step.done ? "bg-[var(--success)] text-white" : "bg-[var(--panel-soft)] text-[var(--muted)]"
                    }`}
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  <span>
                    <span className="block font-medium text-[var(--text)]">{step.label}</span>
                    <span className="mt-1 block leading-6 text-[var(--muted)]">{step.detail}</span>
                  </span>
                </div>
              ))}
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

            {!manualMode ? (
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
                  {progressActionLabel}
                </button>
              </>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto p-6">
            {manualMode ? (
              renderManualContent({
                artifact,
                moduleId,
                contractValues,
                completedRequired,
                requiredCount: requiredFieldIds.length,
                manualSaveReady,
                manualActionLabel,
                onFieldChange: handleFieldChange,
                onProgressIntake,
              })
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

        <div className="grid gap-4 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-sm text-[var(--muted)]">{manualMode ? "Manual Entry Readiness" : "Artifact Readiness"}</div>
            <div
              className={`font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[-0.06em] ${
                ready ? "text-[var(--success)]" : "text-[var(--accent)]"
              }`}
            >
              {Math.round((workflowSteps.filter((step) => step.done).length / workflowSteps.length) * 100)}
            </div>
            <div className="text-sm text-[var(--muted)]">
              {ready
                ? "All intake gates are complete. This artifact is ready for certification use."
                : manualMode
                  ? "Complete the required fields, then save from the form to create the governed manual record."
                  : "Continue the intake pipeline until all four gates are complete."}
            </div>
          </div>
          <div className="flex gap-2">
            {!manualMode ? (
              <button
                type="button"
                onClick={onProgressIntake}
                className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                {progressActionLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderManualContent({
  artifact,
  moduleId,
  contractValues,
  completedRequired,
  requiredCount,
  manualSaveReady,
  manualActionLabel,
  onFieldChange,
  onProgressIntake,
}: {
  artifact: UploadArtifact;
  moduleId: "M01" | "M02";
  contractValues: Record<string, string>;
  completedRequired: number;
  requiredCount: number;
  manualSaveReady: boolean;
  manualActionLabel: string;
  onFieldChange: (fieldId: string, value: string) => void;
  onProgressIntake: () => void;
}) {
  if (artifact.type === "Manual Entry" && moduleId === "M01") {
    return (
      <div className="space-y-4">
        <ManualHeader
          title="Contract Config"
          completedRequired={completedRequired}
          requiredCount={requiredCount}
        />
        <SchemaLegend />
        <ContractTableCard>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <FieldLabel label="Merchant ID (MID)" required />
                <td className="p-2">
                  <TextInput
                    value={getFieldValue(contractValues, "merchant_id")}
                    onChange={(value) => onFieldChange("merchant_id", value)}
                    placeholder="4890221834"
                  />
                </td>
                <FieldLabel label="Contract Effective Date" required />
                <td className="p-2">
                  <TextInput
                    type="date"
                    value={getFieldValue(contractValues, "effective_date")}
                    onChange={(value) => onFieldChange("effective_date", value)}
                  />
                </td>
              </tr>
              <tr>
                <FieldLabel label="Pricing Model" required />
                <td className="p-2">
                  <SelectInput
                    value={getFieldValue(contractValues, "contract_type")}
                    onChange={(value) => onFieldChange("contract_type", value)}
                    options={["Interchange Plus", "Tiered", "Flat Rate", "Subscription"]}
                  />
                </td>
                <FieldLabel label="Processor" />
                <td className="p-2">
                  <TextInput
                    value={getFieldValue(contractValues, "processor_name")}
                    onChange={(value) => onFieldChange("processor_name", value)}
                    placeholder="Heartland"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </ContractTableCard>

        <SectionHeader title="CONTRACTED INTERCHANGE RATES - ALL 9 CARD BRANDS" />
        <ContractTableCard>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[rgba(0,0,0,0.03)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Card Brand</th>
                <th className="px-3 py-2 text-left">Rate %</th>
                <th className="px-3 py-2 text-left">Per-Txn Fee $</th>
                <th className="px-3 py-2 text-left">Non-Qual Surcharge %</th>
              </tr>
            </thead>
            <tbody>
              {M01_CARD_BRANDS.map((brand) => {
                const fieldKey = brand.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
                return (
                  <tr key={brand} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium text-[var(--text)]">{brand}</td>
                    <td className="p-2">
                      <TextInput
                        type="number"
                        step="0.001"
                        value={getFieldValue(contractValues, `rate_${fieldKey}`)}
                        onChange={(value) => onFieldChange(`rate_${fieldKey}`, value)}
                        placeholder="0.000"
                      />
                    </td>
                    <td className="p-2">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={getFieldValue(contractValues, `txfee_${fieldKey}`)}
                        onChange={(value) => onFieldChange(`txfee_${fieldKey}`, value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-2">
                      <TextInput
                        type="number"
                        step="0.001"
                        value={getFieldValue(contractValues, `nqs_${fieldKey}`)}
                        onChange={(value) => onFieldChange(`nqs_${fieldKey}`, value)}
                        placeholder="0.000"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ContractTableCard>

        <SectionHeader title="FEES & SPECIAL TERMS" />
        <ContractTableCard>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <FieldLabel label="Monthly Statement Fee $" />
                <td className="p-2">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={getFieldValue(contractValues, "stmt_fee", "monthly_fee")}
                    onChange={(value) => onFieldChange("stmt_fee", value)}
                    placeholder="0.00"
                  />
                </td>
                <FieldLabel label="Batch Settlement Fee $" />
                <td className="p-2">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={getFieldValue(contractValues, "batch_fee")}
                    onChange={(value) => onFieldChange("batch_fee", value)}
                    placeholder="0.00"
                  />
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <FieldLabel label="Chargeback Fee $" />
                <td className="p-2">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={getFieldValue(contractValues, "chargeback_fee")}
                    onChange={(value) => onFieldChange("chargeback_fee", value)}
                    placeholder="0.00"
                  />
                </td>
                <FieldLabel label="PCI Compliance Fee $/mo" />
                <td className="p-2">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={getFieldValue(contractValues, "pci_fee")}
                    onChange={(value) => onFieldChange("pci_fee", value)}
                    placeholder="0.00"
                  />
                </td>
              </tr>
              <tr>
                <FieldLabel label="Override / Special Terms" />
                <td className="p-2" colSpan={3}>
                  <TextInput
                    value={getFieldValue(contractValues, "override_notes", "notes")}
                    onChange={(value) => onFieldChange("override_notes", value)}
                    placeholder="Non-standard terms, custom rate tiers, promotional discounts..."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </ContractTableCard>

        <SaveBar
          note="Saves to Contract Config - used as reference for all M01 certification runs"
          ready={manualSaveReady}
          label="Save to Contract Config ->"
          onClick={onProgressIntake}
        />
      </div>
    );
  }

  if (artifact.type === "Manual Entry" && moduleId === "M02") {
    return (
      <div className="space-y-4">
        <ManualHeader
          title="Contract Config"
          completedRequired={completedRequired}
          requiredCount={requiredCount}
        />
        <SchemaLegend />
        <ContractTableCard>
          <SectionHeader title="DSP AGREEMENT TERMS" embedded />
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <FieldLabel label="Agreement Effective Date" required />
                <td className="p-2">
                  <TextInput
                    type="date"
                    value={getFieldValue(contractValues, "effective_date")}
                    onChange={(value) => onFieldChange("effective_date", value)}
                  />
                </td>
                <FieldLabel label="Expiry / Renewal Date" />
                <td className="p-2">
                  <TextInput
                    type="date"
                    value={getFieldValue(contractValues, "expiry_date")}
                    onChange={(value) => onFieldChange("expiry_date", value)}
                  />
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <FieldLabel label="Restaurant UUID / Store ID" required />
                <td className="p-2">
                  <TextInput
                    value={getFieldValue(contractValues, "store_id")}
                    onChange={(value) => onFieldChange("store_id", value)}
                    placeholder="a3f9e221-..."
                  />
                </td>
                <FieldLabel label="Market / Region" />
                <td className="p-2">
                  <TextInput
                    value={getFieldValue(contractValues, "market")}
                    onChange={(value) => onFieldChange("market", value)}
                    placeholder="Dallas-Fort Worth"
                  />
                </td>
              </tr>
              <tr>
                <FieldLabel label="Commission Base Field" required />
                <td className="p-2" colSpan={3}>
                  <SelectInput
                    value={getFieldValue(contractValues, "commission_base")}
                    onChange={(value) => onFieldChange("commission_base", value)}
                    options={[
                      "platform_gross_sales",
                      "order_subtotal",
                      "restaurant_food_sales",
                      "other",
                    ]}
                    labels={{
                      platform_gross_sales: "platform_gross_sales (Uber Eats default)",
                      order_subtotal: "order_subtotal (DoorDash / Slice default)",
                      restaurant_food_sales: "restaurant_food_sales (Grubhub default)",
                      other: "Other (specify in override notes)",
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </ContractTableCard>

        <SectionHeader title="CONTRACTED COMMISSION RATES BY CHANNEL" />
        <ContractTableCard>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[rgba(0,0,0,0.03)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Channel</th>
                <th className="px-3 py-2 text-left">Contracted Rate %</th>
                <th className="px-3 py-2 text-center">Active?</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {M02_CHANNELS.map((channel) => (
                <tr key={channel.field} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium text-[var(--text)]">{channel.label}</td>
                  <td className="p-2">
                    <TextInput
                      type="number"
                      step="0.1"
                      value={getFieldValue(contractValues, `rate_${channel.field}`)}
                      onChange={(value) => onFieldChange(`rate_${channel.field}`, value)}
                      placeholder="0.0"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={getFieldValue(contractValues, `${channel.field}_active`) === "true"}
                      onChange={(event) =>
                        onFieldChange(`${channel.field}_active`, event.target.checked ? "true" : "")
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="p-2">
                    <TextInput
                      value={getFieldValue(contractValues, `${channel.field}_note`)}
                      onChange={(value) => onFieldChange(`${channel.field}_note`, value)}
                      placeholder="Optional..."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContractTableCard>

        <SectionHeader title="FEES, ADJUSTMENTS & OVERRIDES" />
        <ContractTableCard>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <FieldLabel label="Marketing Opt-In Fee %" />
                <td className="p-2">
                  <TextInput
                    type="number"
                    step="0.1"
                    value={getFieldValue(contractValues, "marketing_fee_pct")}
                    onChange={(value) => onFieldChange("marketing_fee_pct", value)}
                    placeholder="0.0"
                  />
                </td>
                <FieldLabel label="Error Charge Cap $" />
                <td className="p-2">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={getFieldValue(contractValues, "error_charge_cap")}
                    onChange={(value) => onFieldChange("error_charge_cap", value)}
                    placeholder="0.00"
                  />
                </td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <FieldLabel label="Tax Remittance by DSP?" />
                <td className="p-2">
                  <SelectInput
                    value={getFieldValue(contractValues, "tax_remit")}
                    onChange={(value) => onFieldChange("tax_remit", value)}
                    options={["yes", "no", "partial"]}
                    labels={{
                      yes: "Yes - DSP remits tax",
                      no: "No - restaurant remits",
                      partial: "Partial",
                    }}
                  />
                </td>
                <FieldLabel label="Payout Frequency" />
                <td className="p-2">
                  <SelectInput
                    value={getFieldValue(contractValues, "payout_freq")}
                    onChange={(value) => onFieldChange("payout_freq", value)}
                    options={["Weekly", "Bi-weekly", "Daily", "Monthly"]}
                  />
                </td>
              </tr>
              <tr>
                <FieldLabel label="Override / Special Terms" />
                <td className="p-2" colSpan={3}>
                  <TextInput
                    value={getFieldValue(contractValues, "override_notes")}
                    onChange={(value) => onFieldChange("override_notes", value)}
                    placeholder="Non-standard rates, side agreements, promotional discounts, DashPass exclusions..."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </ContractTableCard>

        <SaveBar
          note="Saves to Contract Config - used as reference for all M02 certification runs"
          ready={manualSaveReady}
          label="Save to Contract Config ->"
          onClick={onProgressIntake}
        />
      </div>
    );
  }

  const fieldDefs = getManualFieldDefs(moduleId, artifact);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">
          {artifact.type === "Manual Entry" ? "Contract Config" : "Manual Entry"}
        </div>
        <div className="text-sm text-[var(--muted)]">
          {completedRequired} / {requiredCount} required fields
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
                type={field.type}
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
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-3">
        <div className="text-sm text-[var(--muted)]">
          {artifact.type === "Manual Entry"
            ? "Saves to Contract Config and marks the entry for governed review."
            : "Saves this manual artifact record as the fallback source for the intake workflow."}
        </div>
        <button
          type="button"
          onClick={onProgressIntake}
          disabled={!manualSaveReady}
          className="shrink-0 rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {manualActionLabel}
        </button>
      </div>
    </>
  );
}

function ManualHeader({
  title,
  completedRequired,
  requiredCount,
}: {
  title: string;
  completedRequired: number;
  requiredCount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em]">{title}</div>
      <div className="text-sm text-[var(--muted)]">
        {completedRequired} / {requiredCount} required fields
      </div>
    </div>
  );
}

function SchemaLegend() {
  return (
    <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[rgba(0,0,0,0.02)] px-4 py-3">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          Contract Schema
        </div>
        <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Deterministic reference input
        </div>
      </div>
      <div className="flex flex-wrap gap-4 bg-[rgba(0,0,0,0.04)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
        <LegendDot color="bg-[var(--success)]" label="Matched" />
        <LegendDot color="bg-[var(--accent)]" label="Required" />
        <LegendDot color="bg-[var(--border)]" label="Optional" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ContractTableCard({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">{children}</div>;
}

function SectionHeader({ title, embedded = false }: { title: string; embedded?: boolean }) {
  return (
    <div
      className={`font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] ${
        embedded ? "border-b border-[var(--border)] bg-[rgba(0,0,0,0.02)] px-4 py-3" : "px-1 pt-1"
      }`}
    >
      {title}
    </div>
  );
}

function FieldLabel({
  label,
  required = false,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <td className="w-[28%] bg-[rgba(0,0,0,0.02)] px-3 py-2 align-top font-medium text-[var(--text)]">
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.14em] ${
            required ? "bg-[rgba(214,48,49,0.1)] text-[var(--accent)]" : "bg-[var(--surface)] text-[var(--muted)]"
          }`}
        >
          {required ? "REQ" : "OPT"}
        </span>
      </div>
    </td>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  step,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
    >
      <option value="">Select...</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function SaveBar({
  note,
  ready,
  label,
  onClick,
}: {
  note: string;
  ready: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-3">
      <div className="text-sm text-[var(--muted)]">{note}</div>
      <button
        type="button"
        onClick={onClick}
        disabled={!ready}
        className="shrink-0 rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}

function getFieldValue(values: Record<string, string>, primary: string, fallback?: string) {
  const candidates = [primary, ...(FIELD_ALIASES[primary] ?? []), ...(fallback ? [fallback] : [])];
  for (const candidate of candidates) {
    const value = values[candidate];
    if (value) return value;
  }
  return "";
}

function getRequiredFieldIds(
  moduleId: "M01" | "M02",
  artifact: UploadArtifact,
  fieldDefs: ReturnType<typeof getManualFieldDefs>,
) {
  if (artifact.type === "Manual Entry" && moduleId === "M01") {
    return ["merchant_id", "contract_type", "effective_date"];
  }

  if (artifact.type === "Manual Entry" && moduleId === "M02") {
    return ["store_id", "effective_date", "commission_base"];
  }

  return fieldDefs.filter((field) => field.required).map((field) => field.id);
}

function getManualActionLabel(artifact: UploadArtifact) {
  if (artifact.type === "Manual Entry") {
    return "Save to Contract Config";
  }

  if (artifact.key.includes("agreement") || artifact.key.includes("agr")) {
    return "Save Agreement Record";
  }

  if (artifact.key.includes("bank")) {
    return "Save Bank Record";
  }

  return "Save Manual Record";
}

function getProgressActionLabel(artifact: UploadArtifact) {
  if (artifact.key.includes("processor")) {
    return "Continue Processor Review";
  }

  if (artifact.key.includes("settlement")) {
    return "Continue Settlement Review";
  }

  if (artifact.key.includes("pos")) {
    return "Continue POS Review";
  }

  if (artifact.key.includes("agreement") || artifact.key.includes("agr")) {
    return "Continue Agreement Review";
  }

  if (artifact.key.includes("bank")) {
    return "Continue Bank Review";
  }

  return "Continue";
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
      field("acct_last4", "Account (Last 4)", "text", true, "Last four digits of the account number."),
      field("statement_period", "Statement Period", "month", true, "Period covered by the deposit evidence."),
      field(
        "total_dsp_deposits",
        "Total DSP Deposits ($)",
        "number",
        true,
        "Total matching-period deposits or settlement transfers reflected in the bank statement.",
      ),
      field(
        "recon_note",
        "Reconciliation Note",
        "textarea",
        false,
        "Explain any timing lag, split funding, reserve hold, or mismatch between payout and bank deposit.",
      ),
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
