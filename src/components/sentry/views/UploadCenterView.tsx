import { useMemo, useRef, useState } from "react";
import type { IntakeState, UploadModule } from "../types";

const moduleMeta = {
  M01: {
    icon: "[M01]",
    label: "M01 - Merchant Fee (Card Processor)",
    ruleEyebrow: "Upload Rules - M01 Processor Statements",
    ruleText:
      "Download the transaction-level CSV from your card processor's merchant portal. Upload the file exactly as provided - no reformatting, no opening in Excel. Each processor uses different native column names. The Schema Registry validates column names on upload; any mismatch flags a schema warning requiring WGS review.",
    vendors: [
      { key: "heartland", name: "Heartland", schema: "v1.0", base: "trans_amount" },
      { key: "toast", name: "Toast", schema: "v1.0", base: "gross_amount" },
      { key: "square", name: "Square", schema: "v1.0", base: "amount" },
      { key: "worldpay", name: "Worldpay", schema: "v1.0", base: "txn_amount" },
      { key: "chase", name: "Chase Paymentech", schema: "v1.0", base: "transaction_amount" },
    ],
    uploadArtifactKey: "m01-processor",
    manualArtifactKey: "m01-contract",
    templateModule: "M01",
  },
  M02: {
    icon: "[M02]",
    label: "M02 - Delivery Fee (DSP)",
    ruleEyebrow: "Upload Rules - M02 Settlement Statements",
    ruleText:
      "Download order-level settlement CSVs directly from each DSP portal. Upload the raw export exactly as downloaded. Do not normalize columns before upload. The active schema must match the native DSP export before certification can proceed.",
    vendors: [
      { key: "ubereats", name: "Uber Eats", schema: "v1.0", base: "platform_gross_sales" },
      { key: "doordash", name: "DoorDash", schema: "v1.0", base: "order_subtotal" },
      { key: "grubhub", name: "Grubhub", schema: "v1.0", base: "restaurant_food_sales" },
      { key: "slice", name: "Slice", schema: "v1.0", base: "order_subtotal" },
    ],
    uploadArtifactKey: "m02-settlement",
    manualArtifactKey: "m02-contract",
    templateModule: "M02",
  },
} as const;

const templateHeaders: Record<string, string> = {
  heartland:
    "trans_date,trans_id,card_type,trans_amount,fee_amount,disc_rate,disc_amount,auth_code,terminal_id,batch_id,card_number_last4,trans_type",
  toast:
    "date,batch_date,pos_merchant_sales,platform_net_sales,transaction_fees,processing_fees,other_merchant_fees,calculated_recovery_variance,bank_deposit_amount,card_type,entry_method,interchange_rate_applied,transaction_count,notes",
  square:
    "date,transaction_id,amount,fee,net_total,card_brand,pan_suffix,device_name,location_name,description,refund_id,dispute_id",
  worldpay:
    "txn_date,txn_id,card_brand,txn_amount,disc_rate,disc_amount,interchange_amount,assessment,terminal_id,batch_number,auth_number",
  chase:
    "transaction_date,transaction_id,card_type,transaction_amount,disc_rate,disc_amount,interchange_fee,service_fee,authorization_number,mid",
  ubereats:
    "date,order_id,item_subtotal,commission_charged,commission_rate_applied,platform_gross_sales,order_status,delivery_fee,tip,tax,settlement_date,menu_item_count,channel,notes",
  doordash:
    "order_date,store_id,order_id,order_subtotal,dd_commission_rate,dd_commission_amount,dd_marketing_fee,error_charge,consumer_fee,payout_amount,order_status",
  grubhub:
    "date,restaurant_id,order_id,restaurant_food_sales,grubhub_commission,marketing_fee,tax_remitted,adjustment_amount,net_payout,order_type",
  slice:
    "order_date,store_id,order_id,order_subtotal,slice_commission,marketing_contribution,adjustment,tax,net_payout",
};

export function UploadCenterView({
  intakeState,
  modules,
  onArtifactAction,
  onDirectUpload,
  onOpenChecklist,
}: {
  contractState: Record<string, Record<string, string>>;
  intakeState: Record<string, IntakeState>;
  modules: UploadModule[];
  onArtifactAction: (
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendor?: { key: string; name: string },
    entryMode?: "manual" | "upload",
  ) => void;
  onDirectUpload: (
    moduleId: "M01" | "M02",
    artifactKey: string,
    file: File,
    vendor?: { key: string; name: string },
  ) => void;
  onOpenChecklist: (
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendor?: { key: string; name: string },
  ) => void;
  onOpenSchema: () => void;
}) {
  const [activeModule, setActiveModule] = useState<"M01" | "M02">("M01");
  const [pendingUpload, setPendingUpload] = useState<{
    moduleId: "M01" | "M02";
    artifactKey: string;
    vendor: { key: string; name: string };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadModule = modules.find((module) => module.id === activeModule) ?? modules[0];
  const activeMeta = moduleMeta[activeModule];
  const moduleArtifactMap = useMemo(() => {
    return Object.fromEntries(
      modules.map((module) => [module.id, Object.fromEntries(module.artifacts.map((artifact) => [artifact.key, artifact]))]),
    ) as Record<"M01" | "M02", Record<string, UploadModule["artifacts"][number]>>;
  }, [modules]);
  const uploadArtifactKeyFor = (baseKey: string) =>
    Object.keys(moduleArtifactMap[activeModule] ?? {}).find((key) => key.startsWith(baseKey)) ?? baseKey;

  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,.pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && pendingUpload) {
            onDirectUpload(pendingUpload.moduleId, pendingUpload.artifactKey, file, pendingUpload.vendor);
          }
          event.currentTarget.value = "";
        }}
      />
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="font-[family-name:var(--font-display)] text-[34px] font-bold tracking-[-0.05em] text-[var(--text)]">
          Upload Data
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          Upload native CSV statements exactly as downloaded - no reformatting, no Excel re-save
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex flex-wrap items-center gap-7 border-b border-[var(--border)]">
          {(["M02", "M01"] as const).map((moduleId) => {
            const meta = moduleMeta[moduleId];
            const active = moduleId === activeModule;
            return (
              <button
                key={moduleId}
                type="button"
                onClick={() => setActiveModule(moduleId)}
                className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-[15px] transition ${
                  active
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="rounded-xl border border-[rgba(214,48,49,0.18)] bg-[#2B1403] px-4 py-4 text-[#F3AE62]">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF5C4D]">
            {activeMeta.ruleEyebrow}
          </div>
          <div className="mt-2 max-w-5xl text-[14px] leading-8">{activeMeta.ruleText}</div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-2 xl:grid-cols-2">
        {activeMeta.vendors.map((vendor) => {
          const settlementArtifactKey = uploadArtifactKeyFor(activeMeta.uploadArtifactKey);
          const manualArtifact = moduleArtifactMap[activeModule]?.[activeMeta.manualArtifactKey];
          const posArtifactKey = activeModule === "M02" ? uploadArtifactKeyFor("m02-pos") : uploadArtifactKeyFor("m01-pos");
          const agreementArtifactKey =
            activeModule === "M02" ? uploadArtifactKeyFor("m02-agreement") : uploadArtifactKeyFor("m01-agreement");
          const bankArtifactKey = activeModule === "M02" ? uploadArtifactKeyFor("m02-bank") : uploadArtifactKeyFor("m01-bank");
          const intakeFor = (artifactKey: string) => {
            const stateKey = activeUploadModule
              ? `${activeUploadModule.accountId}:${activeModule}:${artifactKey}:${vendor.key}`
              : "";
            return stateKey
              ? intakeState[stateKey] ?? { uploaded: false, hash: false, schema: false, fields: false }
              : { uploaded: false, hash: false, schema: false, fields: false };
          };
          const settlementIntake = intakeFor(settlementArtifactKey);
          const settlementHasUpload = Boolean(settlementIntake.fileName) && settlementIntake.vendorKey === vendor.key;
          const posIntake = posArtifactKey ? intakeFor(posArtifactKey) : null;
          const posHasUpload = Boolean(posIntake?.fileName) && posIntake?.vendorKey === vendor.key;
          const agreementIntake = agreementArtifactKey ? intakeFor(agreementArtifactKey) : null;
          const agreementHasUpload = Boolean(agreementIntake?.fileName) && agreementIntake?.vendorKey === vendor.key;
          const bankIntake = bankArtifactKey ? intakeFor(bankArtifactKey) : null;
          const bankHasUpload = Boolean(bankIntake?.fileName) && bankIntake?.vendorKey === vendor.key;

          return (
            <div key={vendor.key} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div>
                  <div className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--text)]">{vendor.name}</div>
                  <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
                    Schema {vendor.schema} | base: {vendor.base}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadTemplate(vendor.key, activeMeta.templateModule, vendor.name)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Template
                </button>
              </div>

              <div className="px-4 py-4">
                {activeModule === "M02" ? (
                  <div className="space-y-5">
                    <DocumentSection
                      title="1 | DSP Settlement CSV"
                      subtitle={`${vendor.name} order-level statement`}
                      primaryLabel="Upload CSV"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: settlementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        onArtifactAction(
                          activeModule,
                          activeMeta.manualArtifactKey,
                          {
                            key: vendor.key,
                            name: vendor.name,
                          },
                          "manual",
                        )
                      }
                      intake={settlementIntake}
                      hasUpload={settlementHasUpload}
                      emptyTitle={`Drop ${vendor.name} CSV or browse`}
                      emptySub="Order-level export | exact portal download"
                    />

                    <DocumentSection
                      title="2 | POS Summary by Channel"
                      subtitle="POS net sales breakdown for the same period"
                      primaryLabel="Upload CSV"
                      onPrimary={() => {
                        if (!posArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: posArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      intake={posIntake ?? undefined}
                      hasUpload={posHasUpload}
                      emptyTitle="Drop POS Summary CSV or browse"
                      emptySub="channel | pos_net_sales | commission_variance"
                    />

                    <DocumentSection
                      title="3 | DSP Agreement"
                      subtitle="Signed commercial agreement including the rate schedule"
                      primaryLabel="Upload PDF"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        if (!agreementArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: agreementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        agreementArtifactKey
                          ? onArtifactAction(
                              activeModule,
                              agreementArtifactKey,
                              {
                                key: vendor.key,
                                name: vendor.name,
                              },
                              "manual",
                            )
                          : undefined
                      }
                      intake={agreementIntake ?? undefined}
                      hasUpload={agreementHasUpload}
                      emptyTitle={`Drop signed ${vendor.name} agreement PDF or browse`}
                      emptySub="PDF only | signed executed copy"
                    />

                    <DocumentSection
                      title="4 | Bank Statement"
                      subtitle="Matching-period deposit statement for payout reconciliation"
                      primaryLabel="Upload PDF"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        if (!bankArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: bankArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        bankArtifactKey
                          ? onArtifactAction(
                              activeModule,
                              bankArtifactKey,
                              {
                                key: vendor.key,
                                name: vendor.name,
                              },
                              "manual",
                            )
                          : undefined
                      }
                      intake={bankIntake ?? undefined}
                      hasUpload={bankHasUpload}
                      emptyTitle="Drop bank statement PDF or browse"
                      emptySub="PDF only | matching period"
                    />
                  </div>
                ) : (
                  <div className="space-y-5">
                    <DocumentSection
                      title="1 | Processor Statement CSV"
                      subtitle={`${vendor.name} transaction-level processor export`}
                      primaryLabel="Upload CSV"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: settlementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        onArtifactAction(
                          activeModule,
                          activeMeta.manualArtifactKey,
                          {
                            key: vendor.key,
                            name: vendor.name,
                          },
                          "manual",
                        )
                      }
                      intake={settlementIntake}
                      hasUpload={settlementHasUpload}
                      emptyTitle={`Drop ${vendor.name} CSV or browse`}
                      emptySub="Transaction-level export | no reformatting"
                    />

                    <DocumentSection
                      title="2 | POS Export CSV"
                      subtitle="Matching-period POS export for cross-system reconciliation"
                      primaryLabel="Upload CSV"
                      onPrimary={() => {
                        if (!posArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: posArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      intake={posIntake ?? undefined}
                      hasUpload={posHasUpload}
                      emptyTitle="Drop POS export CSV or browse"
                      emptySub="gross_sales | tenders | transactions"
                    />

                    <DocumentSection
                      title="3 | Merchant Agreement"
                      subtitle="Signed merchant services agreement with rate schedule"
                      primaryLabel="Upload PDF"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        if (!agreementArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: agreementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        agreementArtifactKey
                          ? onArtifactAction(
                              activeModule,
                              agreementArtifactKey,
                              {
                                key: vendor.key,
                                name: vendor.name,
                              },
                              "manual",
                            )
                          : undefined
                      }
                      intake={agreementIntake ?? undefined}
                      hasUpload={agreementHasUpload}
                      emptyTitle={`Drop signed ${vendor.name} agreement PDF or browse`}
                      emptySub="PDF only | signed executed copy"
                    />

                    <DocumentSection
                      title="4 | Bank Statement"
                      subtitle="Matching-period bank statement for processor deposit reconciliation"
                      primaryLabel="Upload PDF"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        if (!bankArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: bankArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        bankArtifactKey
                          ? onArtifactAction(
                              activeModule,
                              bankArtifactKey,
                              {
                                key: vendor.key,
                                name: vendor.name,
                              },
                              "manual",
                            )
                          : undefined
                      }
                      intake={bankIntake ?? undefined}
                      hasUpload={bankHasUpload}
                      emptyTitle="Drop bank statement PDF or browse"
                      emptySub="PDF only | matching period"
                    />

                    {manualArtifact ? (
                      <div className="text-[12px] text-[var(--muted)]">
                        Manual Entry opens the governed contract workflow used for M01 certification.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-5 py-4">
        <div className="text-sm text-[var(--muted)]">
          Files are SHA-256 hashed at intake before processing. Upload the file exactly as downloaded from the DSP or processor portal.
        </div>
      </div>
    </div>
  );
}

function IntakeDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8F8FA] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
      <span
        className={`h-2 w-2 rounded-full ${
          done ? "bg-[var(--success)] shadow-[0_0_6px_rgba(0,200,83,0.35)]" : "bg-[var(--border)]"
        }`}
      />
      {label}
    </span>
  );
}

function DocumentSection({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  intake,
  hasUpload,
  emptyTitle,
  emptySub,
}: {
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  intake?: IntakeState;
  hasUpload: boolean;
  emptyTitle: string;
  emptySub: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="mb-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
        {title}
      </div>
      <div className="mb-3 text-[11px] leading-5 text-[var(--muted)]">{subtitle}</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="rounded-lg bg-[var(--text)] px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-[var(--accent)]"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
      <UploadTile intake={intake} hasUpload={hasUpload} emptyTitle={emptyTitle} emptySub={emptySub} onClick={onPrimary} compact />
    </div>
  );
}

function UploadTile({
  intake,
  hasUpload,
  emptyTitle,
  emptySub,
  onClick,
  compact = false,
}: {
  intake?: IntakeState;
  hasUpload: boolean;
  emptyTitle: string;
  emptySub: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`mt-4 flex w-full flex-col items-center justify-center rounded-2xl bg-[#F8F8FA] px-4 text-center transition hover:bg-[#F3F4F7] ${
          compact ? "min-h-[110px] py-5" : "min-h-[140px] py-6"
        }`}
      >
        {hasUpload ? (
          <>
            <span
              className={`text-[20px] font-semibold ${
                intake?.matchPct !== undefined && intake.matchPct < 60
                  ? "text-[var(--accent)]"
                  : "text-[var(--success)]"
              }`}
            >
              {intake?.matchPct !== undefined && intake.matchPct < 60 ? "WARNING" : "MATCHED"}
            </span>
            <span
              className={`mt-3 text-[14px] font-semibold ${
                intake?.matchPct !== undefined && intake.matchPct < 60
                  ? "text-[var(--accent)]"
                  : "text-[var(--success)]"
              }`}
            >
              {intake?.fileName}
            </span>
            <span className="mt-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
              {formatBytes(intake?.sizeBytes ?? 0)} | {intake?.rows ?? "-"} rows | Schema{" "}
              {intake?.matchPct !== undefined ? `${intake.matchPct}%` : "sealed"} | SHA-256:{" "}
              {intake?.hashValue ?? "pending"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[18px] font-semibold text-[var(--muted)]">DROP</span>
            <span className={`${compact ? "mt-2 text-[15px]" : "mt-3 text-[24px]"} leading-none text-[var(--text)]`}>
              {emptyTitle}
            </span>
            <span className="mt-3 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">{emptySub}</span>
          </>
        )}
      </button>

      {hasUpload && intake?.matchPct !== undefined && intake.matchPct < 60 ? (
        <div className="mt-4 rounded-xl border border-[rgba(212,131,10,0.4)] bg-[rgba(214,48,49,0.07)] px-4 py-3">
          <div className="text-[12px] font-semibold text-[var(--accent)]">
            {intake.fileName} - partial schema match ({intake.matchPct}%)
          </div>
          <div className="mt-1 text-[11px] text-[var(--text)]">
            {formatBytes(intake.sizeBytes ?? 0)} - {intake.rows ?? 0} rows - {intake.matchedColumns ?? 0}/
            {intake.expectedColumns ?? 0} columns matched
          </div>
          {intake.unmatchedHeaders?.length ? (
            <div className="mt-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--accent)]">
              Unmatched: {intake.unmatchedHeaders.slice(0, 5).join(", ")}
              {intake.unmatchedHeaders.length > 5 ? ` + ${intake.unmatchedHeaders.length - 5} more` : ""}
            </div>
          ) : null}
          <div className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
            Verify this is the correct file and that the Schema Registry column mappings are up to date. Run the monthly proof cycle if vendor has changed their export format.
          </div>
        </div>
      ) : null}

      {hasUpload ? (
        <div className="mt-3 flex gap-2">
          <IntakeDot done={Boolean(intake?.uploaded)} label="Upload" />
          <IntakeDot done={Boolean(intake?.hash)} label="Hash" />
          <IntakeDot done={Boolean(intake?.schema)} label="Schema" />
          <IntakeDot done={Boolean(intake?.fields)} label="Fields" />
        </div>
      ) : null}
    </>
  );
}

function downloadTemplate(vendorKey: string, module: "M01" | "M02", vendorName: string) {
  const headers = templateHeaders[vendorKey];
  if (!headers || typeof window === "undefined") return;
  const blob = new Blob([`${headers}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `FohBoh_${module}_${vendorName}_Template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
