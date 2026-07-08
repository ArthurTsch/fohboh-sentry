import { useEffect, useMemo, useRef, useState } from "react";
import { LocationSourceSettingsModal } from "../overlays/LocationSourceSettingsModal";
import { Badge } from "../ui/primitives";
import type { IntakeState, LocationSourceConfig, UploadModule, UploadReceipt } from "../types";
import { getVendorCatalog } from "../vendor-catalog";
import { getTemplateHeaders } from "@/lib/uploads/definitions";

type UploadCardState = {
  phase: "idle" | "uploading" | "success" | "review" | "error";
  receipt?: UploadReceipt;
  message?: string;
};

const moduleMeta = {
  M01: {
    icon: "[M01]",
    label: "M01 - Merchant Fee (Card Processor)",
    ruleEyebrow: "Upload Rules - M01 Processor Statements",
    ruleText:
      "Download the transaction-level CSV from your card processor's merchant portal. Upload the file exactly as provided - no reformatting, no opening in Excel. Each processor uses different native column names. The Schema Registry validates column names on upload; any mismatch flags a schema warning requiring WGS review.",
    vendors: getVendorCatalog("M01"),
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
    vendors: getVendorCatalog("M02"),
    uploadArtifactKey: "m02-settlement",
    manualArtifactKey: "m02-contract",
    templateModule: "M02",
  },
} as const;

export function UploadCenterView({
  activeLocationId,
  activeLocationModules,
  activeLocationName,
  activeSourceConfig,
  canManageSources,
  intakeState,
  modules,
  onCompleteUploadSet,
  onManageSources,
  onArtifactAction,
  onDirectUpload,
  uploadFeedback,
}: {
  activeLocationId: string | null;
  activeLocationModules: Array<"M01" | "M02">;
  activeLocationName: string | null;
  activeSourceConfig: LocationSourceConfig | null;
  canManageSources: boolean;
  contractState: Record<string, Record<string, string>>;
  intakeState: Record<string, IntakeState>;
  modules: UploadModule[];
  onCompleteUploadSet: (locationId: string) => void;
  onManageSources: (next: {
    m01Enabled: boolean;
    m01Vendors: string[];
    m02Enabled: boolean;
    m02Vendors: string[];
  }) => void;
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
  ) => Promise<UploadReceipt | null>;
  onOpenSchema: () => void;
  uploadFeedback: UploadReceipt | null;
}) {
  const [activeModule, setActiveModule] = useState<"M01" | "M02">("M01");
  const [showManageSources, setShowManageSources] = useState(false);
  const [cardState, setCardState] = useState<Record<string, UploadCardState>>({});
  const [pendingUpload, setPendingUpload] = useState<{
    moduleId: "M01" | "M02";
    artifactKey: string;
    vendor: { key: string; name: string };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const availableModules = useMemo(() => {
    if (activeLocationModules.length > 0) {
      return activeLocationModules;
    }

    const configured = (["M01", "M02"] as const).filter((moduleId) => {
      if (!activeSourceConfig) {
        return modules.some((module) => module.id === moduleId);
      }

      return moduleId === "M01" ? activeSourceConfig.m01Enabled : activeSourceConfig.m02Enabled;
    });

    return configured.length > 0
      ? configured
      : (["M01", "M02"] as const).filter((moduleId) =>
          modules.some((module) => module.id === moduleId),
        );
  }, [activeLocationModules, activeSourceConfig, modules]);

  useEffect(() => {
    if (!availableModules.includes(activeModule) && availableModules[0]) {
      setActiveModule(availableModules[0]);
    }
  }, [activeModule, availableModules]);

  const activeUploadModule = modules.find((module) => module.id === activeModule) ?? modules[0];
  const activeMeta = moduleMeta[activeModule];
  const visibleVendors = useMemo(() => {
    const selected =
      activeModule === "M01" ? activeSourceConfig?.m01Vendors : activeSourceConfig?.m02Vendors;

    if (!selected || selected.length === 0) {
      return activeMeta.vendors;
    }

    const selectedKeys = new Set(selected.map((vendor) => vendor.key));
    return activeMeta.vendors.filter((vendor) => selectedKeys.has(vendor.key));
  }, [activeMeta.vendors, activeModule, activeSourceConfig]);
  const uploadArtifactKeyFor = (baseKey: string) =>
    activeUploadModule?.artifacts.find((artifact) => artifact.key.startsWith(baseKey))?.key ?? baseKey;
  const recentReceipt = useMemo(() => {
    const receipts = Object.values(cardState)
      .map((value) => value.receipt)
      .filter((value): value is UploadReceipt => Boolean(value));
    return receipts.at(-1) ?? uploadFeedback;
  }, [cardState, uploadFeedback]);
  const uploadCompletionSummary = useMemo(() => {
    if (!activeLocationId) {
      return null;
    }

    const summaryRows: Array<{ key: string; label: string; uploaded: boolean }> = [];

    for (const moduleId of availableModules) {
      const uploadModule = modules.find((item) => item.id === moduleId);
      if (!uploadModule) {
        continue;
      }

      const selectedVendors =
        moduleId === "M01" ? activeSourceConfig?.m01Vendors : activeSourceConfig?.m02Vendors;
      const vendors =
        selectedVendors && selectedVendors.length > 0
          ? selectedVendors
          : moduleMeta[moduleId].vendors.map((vendor) => ({ key: vendor.key, name: vendor.name }));

      const requiredArtifactKeys =
        moduleId === "M01"
          ? [
              resolveModuleArtifactKey(uploadModule, "m01-processor"),
              resolveModuleArtifactKey(uploadModule, "m01-pos"),
              resolveModuleArtifactKey(uploadModule, "m01-agreement"),
              resolveModuleArtifactKey(uploadModule, "m01-bank"),
            ]
          : [
              resolveModuleArtifactKey(uploadModule, "m02-settlement"),
              resolveModuleArtifactKey(uploadModule, "m02-pos"),
              resolveModuleArtifactKey(uploadModule, "m02-agreement"),
              resolveModuleArtifactKey(uploadModule, "m02-bank"),
            ];

      const artifactLabels =
        moduleId === "M01"
          ? ["Processor Statement", "POS Export", "Merchant Agreement", "Bank Statement"]
          : ["DSP Settlement", "POS Summary", "DSP Agreement", "Bank Statement"];

      for (const vendor of vendors) {
        requiredArtifactKeys.forEach((artifactKey, index) => {
          const stateKey = `${uploadModule.accountId}:${activeLocationId}:${moduleId}:${artifactKey}:${vendor.key}`;
          const intake = intakeState[stateKey];
          summaryRows.push({
            key: `${moduleId}:${vendor.key}:${artifactKey}`,
            label: `${moduleId} | ${vendor.name} | ${artifactLabels[index]}`,
            uploaded: Boolean(intake?.uploaded),
          });
        });
      }
    }

    const uploadedCount = summaryRows.filter((row) => row.uploaded).length;
    const missingRows = summaryRows.filter((row) => !row.uploaded);

    return {
      isComplete: summaryRows.length > 0 && missingRows.length === 0,
      missingRows,
      totalCount: summaryRows.length,
      uploadedCount,
    };
  }, [activeLocationId, activeSourceConfig, availableModules, intakeState, modules]);

  function getCardKey(moduleId: "M01" | "M02", artifactKey: string, vendorKey: string) {
    return `${activeLocationId ?? "global"}:${moduleId}:${artifactKey}:${vendorKey}`;
  }

  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,.pdf,application/pdf"
        className="hidden"
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = event.target.files?.[0];
          if (file && pendingUpload) {
            const uploadKey = getCardKey(
              pendingUpload.moduleId,
              pendingUpload.artifactKey,
              pendingUpload.vendor.key,
            );

            setCardState((current) => ({
              ...current,
              [uploadKey]: {
                phase: "uploading",
                message: "Uploading file and validating schema.",
              },
            }));

            try {
              const receipt = await onDirectUpload(
                pendingUpload.moduleId,
                pendingUpload.artifactKey,
                file,
                pendingUpload.vendor,
              );

              if (!receipt) {
                setCardState((current) => ({
                  ...current,
                  [uploadKey]: {
                    phase: "error",
                    message: "Upload target could not be resolved for this location.",
                  },
                }));
              } else {
                setCardState((current) => ({
                  ...current,
                  [uploadKey]: {
                    phase: receipt.status === "ready" ? "success" : "review",
                    message:
                      receipt.status === "ready"
                        ? "Upload completed and passed intake checks."
                        : "Upload completed but still needs review.",
                    receipt,
                  },
                }));
              }
            } catch (error) {
              setCardState((current) => ({
                ...current,
                [uploadKey]: {
                  phase: "error",
                  message:
                    error instanceof Error
                      ? error.message
                      : "Upload failed. Try again with the raw file export.",
                },
              }));
            }
          }
          setPendingUpload(null);
          input.value = "";
        }}
      />
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-[family-name:var(--font-display)] text-[34px] font-bold tracking-[-0.05em] text-[var(--text)]">
              Upload Data
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {activeLocationName
                ? `${activeLocationName} | Upload native CSV statements exactly as downloaded - no reformatting, no Excel re-save`
                : "Upload native CSV statements exactly as downloaded - no reformatting, no Excel re-save"}
            </div>
          </div>
          {canManageSources && activeLocationName && activeSourceConfig ? (
            <button
              type="button"
              onClick={() => setShowManageSources(true)}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Manage Sources
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        {activeLocationName && activeLocationId ? (
          <div className="rounded-2xl border border-[rgba(214,48,49,0.16)] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Current Upload Target
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Location Title
                    </div>
                    <div className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                      {activeLocationName}
                    </div>
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Location ID
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--text)]">{activeLocationId}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-full border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                Location-Scoped Uploads
              </div>
            </div>
            <div className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Every file uploaded on this screen is saved to{" "}
              <span className="font-semibold text-[var(--text)]">{activeLocationName}</span> only.
              To upload for another location, go back to the Location Waterfall and open Upload Data from that specific location.
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[rgba(214,48,49,0.16)] bg-white px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            No active upload location is selected. Open Upload Data from a location row first so files are stored against the correct location.
          </div>
        )}
      </div>

      <div className="px-5 pt-4">
        {availableModules.length > 1 ? (
          <div className="flex flex-wrap items-center gap-7 border-b border-[var(--border)]">
            {availableModules.map((moduleId) => {
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
        ) : availableModules[0] ? (
          <div className="border-b border-[var(--border)] pb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent)]">
              <span>{moduleMeta[availableModules[0]].icon}</span>
              <span>{moduleMeta[availableModules[0]].label}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-5 pt-5">
        {recentReceipt ? <RecentUploadBanner receipt={recentReceipt} /> : null}
        <div className="rounded-xl border border-[rgba(214,48,49,0.18)] bg-[#2B1403] px-4 py-4 text-[#F3AE62]">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF5C4D]">
            {activeMeta.ruleEyebrow}
          </div>
          <div className="mt-2 max-w-5xl text-[14px] leading-8">{activeMeta.ruleText}</div>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-2 xl:grid-cols-2">
        {visibleVendors.length === 0 ? (
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                No active providers configured
              </div>
              <div className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                This location does not currently have any active {activeModule === "M01" ? "card processors" : "DSPs"} configured for {activeModule}. Add one before starting uploads.
              </div>
              {canManageSources && activeSourceConfig ? (
                <button
                  type="button"
                  onClick={() => setShowManageSources(true)}
                  className="mt-5 rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Configure Active Sources
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {visibleVendors.map((vendor) => {
          const settlementArtifactKey = uploadArtifactKeyFor(activeMeta.uploadArtifactKey);
          const posArtifactKey = activeModule === "M02" ? uploadArtifactKeyFor("m02-pos") : uploadArtifactKeyFor("m01-pos");
          const agreementArtifactKey =
            activeModule === "M02" ? uploadArtifactKeyFor("m02-agreement") : uploadArtifactKeyFor("m01-agreement");
          const bankArtifactKey = activeModule === "M02" ? uploadArtifactKeyFor("m02-bank") : uploadArtifactKeyFor("m01-bank");
          const settlementCardState = cardState[getCardKey(activeModule, settlementArtifactKey, vendor.key)];
          const posCardState = posArtifactKey
            ? cardState[getCardKey(activeModule, posArtifactKey, vendor.key)]
            : undefined;
          const agreementCardState = agreementArtifactKey
            ? cardState[getCardKey(activeModule, agreementArtifactKey, vendor.key)]
            : undefined;
          const bankCardState = bankArtifactKey
            ? cardState[getCardKey(activeModule, bankArtifactKey, vendor.key)]
            : undefined;
          const intakeFor = (artifactKey: string) => {
            const stateKey = activeUploadModule && activeLocationId
              ? `${activeUploadModule.accountId}:${activeLocationId}:${activeModule}:${artifactKey}:${vendor.key}`
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
                    Schema {vendor.schema ?? "v1.0"} | base: {vendor.base ?? "configured in governance"}
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
                          settlementArtifactKey,
                          {
                            key: vendor.key,
                            name: vendor.name,
                          },
                          "manual",
                        )
                      }
                      intake={settlementIntake}
                      hasUpload={settlementHasUpload}
                      uploadState={settlementCardState}
                      emptyTitle={`Drop ${vendor.name} CSV or browse`}
                      emptySub="Order-level export | exact portal download"
                    />

                    <DocumentSection
                      title="2 | POS Summary by Channel"
                      subtitle="POS net sales breakdown for the same period"
                      primaryLabel="Upload CSV"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        if (!posArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: posArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        posArtifactKey
                          ? onArtifactAction(
                              activeModule,
                              posArtifactKey,
                              {
                                key: vendor.key,
                                name: vendor.name,
                              },
                              "manual",
                            )
                          : undefined
                      }
                      intake={posIntake ?? undefined}
                      hasUpload={posHasUpload}
                      uploadState={posCardState}
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
                      uploadState={agreementCardState}
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
                      uploadState={bankCardState}
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
                          settlementArtifactKey,
                          {
                            key: vendor.key,
                            name: vendor.name,
                          },
                          "manual",
                        )
                      }
                      intake={settlementIntake}
                      hasUpload={settlementHasUpload}
                      uploadState={settlementCardState}
                      emptyTitle={`Drop ${vendor.name} CSV or browse`}
                      emptySub="Transaction-level export | no reformatting"
                    />

                    <DocumentSection
                      title="2 | POS Export CSV"
                      subtitle="Matching-period POS export for cross-system reconciliation"
                      primaryLabel="Upload CSV"
                      secondaryLabel="Manual Entry"
                      onPrimary={() => {
                        if (!posArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: posArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      onSecondary={() =>
                        posArtifactKey
                          ? onArtifactAction(
                              activeModule,
                              posArtifactKey,
                              {
                                key: vendor.key,
                                name: vendor.name,
                              },
                              "manual",
                            )
                          : undefined
                      }
                      intake={posIntake ?? undefined}
                      hasUpload={posHasUpload}
                      uploadState={posCardState}
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
                      uploadState={agreementCardState}
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
                      uploadState={bankCardState}
                      emptyTitle="Drop bank statement PDF or browse"
                      emptySub="PDF only | matching period"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-5 py-4">
        <div className="flex-1">
          <div className="text-sm text-[var(--muted)]">
            Files are SHA-256 hashed at intake before processing. Upload the file exactly as downloaded from the DSP or processor portal.
          </div>
          {uploadCompletionSummary ? (
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                    Upload Set Review
                  </div>
                  <div className="mt-2 text-sm text-[var(--text)]">
                    {uploadCompletionSummary.uploadedCount}/{uploadCompletionSummary.totalCount} required documents uploaded for{" "}
                    <span className="font-semibold">{activeLocationName ?? "this location"}</span>.
                  </div>
                  {uploadCompletionSummary.missingRows.length > 0 ? (
                    <div className="mt-3 text-sm text-[var(--muted)]">
                      Missing: {uploadCompletionSummary.missingRows.slice(0, 4).map((row) => row.label).join(" | ")}
                      {uploadCompletionSummary.missingRows.length > 4
                        ? ` | +${uploadCompletionSummary.missingRows.length - 4} more`
                        : ""}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-[var(--success)]">
                      All required documents for this location are present. Finish intake to return to the Location Waterfall.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!uploadCompletionSummary.isComplete || !activeLocationId}
                  onClick={() => {
                    if (activeLocationId) {
                      onCompleteUploadSet(activeLocationId);
                    }
                  }}
                  className="rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeLocationName ? `Finish Uploads for ${activeLocationName}` : "Finish Uploads"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showManageSources && activeSourceConfig && activeLocationName ? (
        <LocationSourceSettingsModal
          initialConfig={activeSourceConfig}
          locationName={activeLocationName}
          onClose={() => setShowManageSources(false)}
          onSave={(next) => {
            onManageSources(next);
            setShowManageSources(false);
          }}
        />
      ) : null}
    </div>
  );
}

function resolveModuleArtifactKey(module: UploadModule, prefix: string) {
  return module.artifacts.find((artifact) => artifact.key.startsWith(prefix))?.key ?? prefix;
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

function RecentUploadBanner({ receipt }: { receipt: UploadReceipt }) {
  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-4 ${
        receipt.status === "ready"
          ? "border-[rgba(0,200,83,0.24)] bg-[rgba(0,200,83,0.06)]"
          : "border-[rgba(255,152,0,0.3)] bg-[rgba(255,152,0,0.08)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Recent Upload
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--text)]">{receipt.fileName}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {receipt.locationName} | {receipt.moduleId}
            {receipt.vendorName ? ` | ${receipt.vendorName}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={receipt.status === "ready" ? "success" : "warning"}>
            {receipt.status === "ready" ? "Ready" : "Needs Review"}
          </Badge>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            {formatBytes(receipt.sizeBytes)}
            {receipt.rows ? ` | ${receipt.rows} rows` : ""}
            {receipt.matchPct !== undefined ? ` | Schema ${receipt.matchPct}%` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function UploadStateBadge({
  state,
  hasUpload,
}: {
  state?: UploadCardState;
  hasUpload: boolean;
}) {
  if (state?.phase === "uploading") {
    return <Badge tone="info">Uploading</Badge>;
  }

  if (state?.phase === "success") {
    return <Badge tone="success">Uploaded</Badge>;
  }

  if (state?.phase === "review") {
    return <Badge tone="warning">Review</Badge>;
  }

  if (state?.phase === "error") {
    return <Badge tone="danger">Failed</Badge>;
  }

  if (hasUpload) {
    return <Badge tone="success">Received</Badge>;
  }

  return <Badge tone="neutral">Pending</Badge>;
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
  uploadState,
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
  uploadState?: UploadCardState;
  emptyTitle: string;
  emptySub: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          {title}
        </div>
        <UploadStateBadge state={uploadState} hasUpload={hasUpload} />
      </div>
      <div className="mb-3 text-[11px] leading-5 text-[var(--muted)]">{subtitle}</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className={`rounded-lg px-3 py-2 text-[13px] font-semibold text-white transition ${
            uploadState?.phase === "uploading"
              ? "cursor-wait bg-[var(--info)]"
              : "bg-[var(--text)] hover:bg-[var(--accent)]"
          }`}
          disabled={uploadState?.phase === "uploading"}
        >
          {uploadState?.phase === "uploading" ? "Uploading..." : primaryLabel}
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
      {uploadState?.message ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${
            uploadState.phase === "error"
              ? "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
              : uploadState.phase === "review"
                ? "bg-[rgba(255,152,0,0.1)] text-[#b86a00]"
                : uploadState.phase === "success"
                  ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                  : "bg-[rgba(0,97,255,0.08)] text-[var(--info)]"
          }`}
        >
          {uploadState.message}
        </div>
      ) : null}
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
  const headers = getTemplateHeaders(vendorKey);
  if (headers.length === 0 || typeof window === "undefined") return;
  const blob = new Blob([`${headers.join(",")}\n`], { type: "text/csv" });
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
