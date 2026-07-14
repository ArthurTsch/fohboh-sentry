import { wgsM01Vendors, wgsM02Vendors, wgsOnboardingSteps } from "../data";
import type { LocationRecord, WgsOnboardingProgress, WgsOnboardingStep, WgsVendorOption } from "../types";
import { Badge } from "../ui/primitives";

function buildEmptyChecks(step: WgsOnboardingStep) {
  return step.items?.map(() => false) ?? [];
}

function getUploadCopy(module: "M01" | "M02") {
  if (module === "M01") {
    return "Upload the exact transaction-level CSV exported from the saved processor configured for this location.";
  }
  return "Upload the required source files for each saved active DSP configured for this location: settlement CSV, POS summary CSV, signed DSP agreement PDF, and bank statement PDF.";
}

function getActiveModules(location: LocationRecord) {
  return location.modules
    .map((module) => module.label)
    .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");
}

function buildVisibleOnboardingSteps(location: LocationRecord) {
  const activeModules = getActiveModules(location);
  const steps = wgsOnboardingSteps
    .filter((step) => {
      if (step.type === "upload-m01") return activeModules.includes("M01");
      if (step.type === "upload-m02") return activeModules.includes("M02");
      return true;
    })
    .map((step) => {
      if (step.type !== "checklist" || !step.items?.length) {
        return step;
      }

      const filteredItems = step.items.filter((item) => {
        const label = item.label.toUpperCase();
        if (label.includes("M01")) return activeModules.includes("M01");
        if (label.includes("M02")) return activeModules.includes("M02");
        return true;
      });

      return {
        ...step,
        items: filteredItems,
      };
    });

  return steps.map((step, index) => ({
    ...step,
    eyebrow: step.eyebrow.replace(/Step \d+ of \d+/i, `Step ${index + 1} of ${steps.length}`),
  }));
}

function downloadOnboardingTemplate(option: WgsVendorOption, module: "M01" | "M02") {
  if (typeof window === "undefined") return;
  const templates: Record<string, string> = {
    heartland:
      "trans_date,trans_id,card_type,trans_amount,fee_amount,disc_rate,disc_amount,auth_code,terminal_id,batch_id,card_number_last4,trans_type",
    chase:
      "transaction_date,transaction_id,card_type,transaction_amount,disc_rate,disc_amount,interchange_fee,service_fee,authorization_number,mid",
    worldpay:
      "txn_date,txn_id,card_brand,txn_amount,disc_rate,disc_amount,interchange_amount,assessment,terminal_id,batch_number,auth_number",
    square:
      "date,transaction_id,amount,fee,net_total,card_brand,pan_suffix,device_name,location_name,description,refund_id,dispute_id",
    toast:
      "date,batch_date,pos_merchant_sales,platform_net_sales,transaction_fees,processing_fees,other_merchant_fees,calculated_recovery_variance,bank_deposit_amount,card_type,entry_method,interchange_rate_applied,transaction_count,notes",
    doordash:
      "order_date,store_id,order_id,order_subtotal,dd_commission_rate,dd_commission_amount,dd_marketing_fee,error_charge,consumer_fee,payout_amount,order_status",
    ubereats:
      "date,order_id,item_subtotal,commission_charged,commission_rate_applied,platform_gross_sales,order_status,delivery_fee,tip,tax,settlement_date,menu_item_count,channel,notes",
    grubhub:
      "date,restaurant_id,order_id,restaurant_food_sales,grubhub_commission,marketing_fee,tax_remitted,adjustment_amount,net_payout,order_type",
    postmates:
      "date,order_id,item_subtotal,commission_amount,commission_rate,payout_amount,settlement_date,merchant_id,market,notes",
    pos_summary:
      "channel,pos_net_sales,commission_variance,orders,refunds,discounts,net_sales,service_fees,tips,tax,deposit_total,notes",
  };
  const templateKey = option.key in templates ? option.key : module === "M02" ? "pos_summary" : option.key;
  const headers = templates[templateKey];
  if (!headers) return;
  const blob = new Blob([`${headers}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `FohBoh_${module}_${option.name.replace(/\s+/g, "_")}_Template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function WgsOnboardingWizard({
  location,
  onChange,
  onClose,
  onComplete,
  progress,
}: {
  location: LocationRecord;
  onChange: (next: WgsOnboardingProgress) => void;
  onClose: () => void;
  onComplete: () => void;
  progress: WgsOnboardingProgress;
}) {
  const visibleSteps = buildVisibleOnboardingSteps(location);
  const safeStepIndex = Math.max(0, Math.min(progress.stepIndex, Math.max(visibleSteps.length - 1, 0)));
  const currentStep = visibleSteps[safeStepIndex] ?? visibleSteps[0];
  const totalSteps = visibleSteps.length;
  const checklistCount = Object.values(progress.checks).reduce(
    (sum, items) => sum + items.filter(Boolean).length,
    0,
  );
  const uploadCount = Object.keys(progress.uploads).length;
  const progressPercent = totalSteps > 0 ? Math.round(((safeStepIndex + 0.5) / totalSteps) * 100) : 0;

  function patchProgress(patch: Partial<WgsOnboardingProgress>) {
    onChange({ ...progress, ...patch });
  }

  function toggleChecklist(stepId: string, itemIndex: number) {
    const step = visibleSteps.find((item) => item.id === stepId);
    if (!step?.items) return;
    const existing = progress.checks[stepId] ?? buildEmptyChecks(step);
    const next = existing.map((value, index) => (index === itemIndex ? !value : value));
    patchProgress({
      checks: {
        ...progress.checks,
        [stepId]: next,
      },
    });
  }

  async function handleFileSelected(file: File, option: WgsVendorOption) {
    await handleDocumentUpload(file, option, option.key);
  }

  async function handleDocumentUpload(file: File, option: WgsVendorOption, docKey: string) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 12);
    const text = file.type.includes("text") || file.name.endsWith(".csv") ? await file.text() : "";
    const rows = text ? Math.max(text.split(/\r?\n/).filter(Boolean).length - 1, 0) : 0;

    patchProgress({
      uploads: {
        ...progress.uploads,
        [docKey]: {
          docKey,
          hash,
          module: option.module,
          name: file.name,
          rows,
          vendorName: option.name,
        },
      },
    });
  }

  function goToStep(nextIndex: number) {
    patchProgress({
      stepIndex: Math.max(0, Math.min(totalSteps - 1, nextIndex)),
    });
  }

  function renderChecklist(step: WgsOnboardingStep) {
    const stepChecks = progress.checks[step.id] ?? buildEmptyChecks(step);
    const items = step.items ?? [];
    const completed = stepChecks.filter(Boolean).length;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={completed === items.length ? "success" : "warning"}>
              {completed} / {items.length} complete
            </Badge>
            <Badge tone={completed === items.length ? "success" : "neutral"}>
              {completed === items.length ? "Step ready" : "Work in progress"}
            </Badge>
          </div>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => {
            const checked = stepChecks[index] ?? false;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => toggleChecklist(step.id, index)}
                className={`grid w-full gap-2 rounded-2xl border p-4 text-left transition ${
                  checked
                    ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.05)]"
                    : "border-[var(--border)] bg-white hover:border-[var(--text)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs ${
                      checked
                        ? "border-[var(--success)] bg-[var(--success)] text-white"
                        : "border-[var(--border)] bg-[var(--surface)] text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <div>
                    <div className="font-medium text-[var(--text)]">{item.label}</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.note}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderUploadStep(module: "M01" | "M02", selectedKeys: string[], options: WgsVendorOption[]) {
    const selectedOptions = options.filter((option) => selectedKeys.includes(option.key));
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
          {getUploadCopy(module)}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Saved Active Sources
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <Badge key={option.key} tone="neutral">
                  {option.name}
                </Badge>
              ))
            ) : (
              <Badge tone="warning">No saved source configured</Badge>
            )}
          </div>
        </div>
        <div className="grid gap-3">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => {
              if (module === "M01") {
                const upload = progress.uploads[option.key];
                return (
                  <div
                    key={option.key}
                    className={`rounded-3xl border-2 border-dashed p-5 transition ${
                      upload
                        ? "border-[rgba(0,200,83,0.28)] bg-[rgba(0,200,83,0.05)]"
                        : "border-[var(--border)] bg-white hover:border-[var(--accent)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-[var(--text)]">{option.name}</div>
                        <div className="mt-1 text-sm text-[var(--muted)]">Processor statement intake</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadOnboardingTemplate(option, "M01")}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                        >
                          Download Template
                        </button>
                        <Badge tone={upload ? "success" : "warning"}>{upload ? "Uploaded" : "Awaiting file"}</Badge>
                      </div>
                    </div>
                    <label className="mt-3 block cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv,text/csv,.txt"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleFileSelected(file, option);
                        }}
                      />
                      <div className="rounded-2xl bg-[var(--surface)] px-4 py-5 text-center">
                        {upload ? (
                          <div className="text-sm leading-6 text-[var(--muted)]">
                            <div className="font-semibold text-[var(--success)]">{upload.name}</div>
                            <div>Rows / pages: {upload.rows || "PDF bundle"}</div>
                            <div>SHA-256: {upload.hash}</div>
                          </div>
                        ) : (
                          <>
                            <div className="text-[15px] text-[var(--text)]">
                              Drop {option.name} CSV or <span className="text-[var(--accent)]">browse</span>
                            </div>
                            <div className="mt-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
                              Transaction-level export | exact portal download
                            </div>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                );
              }

              const docs = [
                {
                  key: `${option.key}-settlement`,
                  title: "1 | DSP Settlement CSV",
                  subtitle: "Order-level export from DSP merchant portal",
                  accept: ".csv,text/csv,.txt",
                },
                {
                  key: `${option.key}-pos`,
                  title: "2 | POS Summary by Channel CSV",
                  subtitle: "Matching-period POS net sales by channel",
                  accept: ".csv,text/csv,.txt",
                },
                {
                  key: `${option.key}-agreement`,
                  title: "3 | DSP Agreement PDF",
                  subtitle: "Signed executed agreement with commission schedule",
                  accept: ".pdf,application/pdf",
                },
                {
                  key: `${option.key}-bank`,
                  title: "4 | Bank Statement PDF",
                  subtitle: "Matching-period bank deposit evidence",
                  accept: ".pdf,application/pdf",
                },
              ];

              return (
                <div key={option.key} className="rounded-3xl border border-[var(--border)] bg-white p-5">
                  <div className="mb-4 font-medium text-[var(--text)]">{option.name}</div>
                  <div className="space-y-3">
                    {docs.map((doc) => {
                      const upload = progress.uploads[doc.key];
                      return (
                        <div
                          key={doc.key}
                          className={`rounded-2xl border p-4 transition ${
                            upload
                              ? "border-[rgba(0,200,83,0.28)] bg-[rgba(0,200,83,0.05)]"
                              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                                {doc.title}
                              </div>
                              <div className="mt-1 text-sm text-[var(--muted)]">{doc.subtitle}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.key.endsWith("settlement") || doc.key.endsWith("pos") ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadOnboardingTemplate(
                                      doc.key.endsWith("pos") ? { ...option, key: "pos_summary" } : option,
                                      "M02",
                                    )
                                  }
                                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                                >
                                  Download Template
                                </button>
                              ) : null}
                              <Badge tone={upload ? "success" : "warning"}>{upload ? "Uploaded" : "Awaiting file"}</Badge>
                            </div>
                          </div>
                          <label className="mt-3 block cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept={doc.accept}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void handleDocumentUpload(file, option, doc.key);
                              }}
                            />
                            <div className="rounded-2xl bg-white px-4 py-5 text-center">
                              {upload ? (
                                <div className="text-sm leading-6 text-[var(--muted)]">
                                  <div className="font-semibold text-[var(--success)]">{upload.name}</div>
                                  <div>Rows / pages: {upload.rows || "PDF"}</div>
                                  <div>SHA-256: {upload.hash}</div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-[15px] text-[var(--text)]">
                                    {doc.title.includes("PDF") || doc.title.includes("Agreement") || doc.title.includes("Bank")
                                      ? `Drop ${doc.title.includes("Bank") ? "bank statement PDF" : `${option.name} PDF`} or browse`
                                      : `Drop ${doc.title.includes("POS") ? "POS Summary CSV" : `${option.name} CSV`} or browse`}
                                  </div>
                                  <div className="mt-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
                                    {doc.subtitle}
                                  </div>
                                </>
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-10 text-center text-sm text-[var(--muted)]">
              No saved {module === "M01" ? "processor" : "DSP"} is configured for this location. Go back to location setup or Manage Sources to define the active source before onboarding can continue.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
        <aside className="hidden w-[290px] flex-col border-r border-[var(--border)] bg-[var(--surface)] p-6 lg:flex">
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {location.name} - Onboarding
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {location.id} · {location.market}
          </div>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Step {progress.stepIndex + 1} of {totalSteps}</span>
              
              <span>{progressPercent}% complete</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-3 text-xs leading-5 text-[var(--muted)]">
              {checklistCount} checklist items completed · {uploadCount} intake files captured
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {visibleSteps.map((step, index) => {
              const isDone = index < safeStepIndex || (index === safeStepIndex && progress.completed);
              const isActive = index === safeStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-white text-[var(--text)] shadow-[0_8px_28px_rgba(0,0,0,0.05)]"
                      : "text-[var(--muted)] hover:bg-white/80"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      isDone
                        ? "bg-[var(--success)] text-white"
                        : isActive
                          ? "bg-[var(--accent)] text-white"
                          : "bg-white text-[var(--muted)]"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <div>
                    <div className="font-medium">{step.label}</div>
                    <div className="text-xs text-[var(--muted)]">{step.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                {currentStep.eyebrow}
              </div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                {currentStep.title}
              </div>
              <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                {currentStep.desc}
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

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {currentStep.type === "checklist" ? renderChecklist(currentStep) : null}
            {currentStep.type === "upload-m01"
              ? renderUploadStep("M01", progress.selectedVendors.m01, wgsM01Vendors)
              : null}
            {currentStep.type === "upload-m02"
              ? renderUploadStep("M02", progress.selectedVendors.m02, wgsM02Vendors)
              : null}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-5">
            <div className="text-sm text-[var(--muted)]">
              {location.status === "Onboarding"
                ? "This wizard mirrors the original WGS activation workflow from the HTML prototype."
                : "Location already exists in a non-onboarding state; the wizard is acting as a governed remediation path."}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToStep(progress.stepIndex - 1)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:opacity-40"
                disabled={safeStepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (safeStepIndex === totalSteps - 1) {
                    onChange({ ...progress, completed: true });
                    onComplete();
                    return;
                  }
                  goToStep(safeStepIndex + 1);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  safeStepIndex === totalSteps - 1
                    ? "bg-[var(--success)] hover:opacity-90"
                    : "bg-[var(--text)] hover:bg-[var(--accent)]"
                }`}
              >
                {safeStepIndex === totalSteps - 1 ? "Complete Onboarding" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
