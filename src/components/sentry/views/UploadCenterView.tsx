import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { RefObject } from "react";
import { Badge } from "../ui/primitives";
import { ActionNotice, WorkflowContextBar } from "../ui/workflow-ux";
import type {
  IntakeState,
  LocationSourceConfig,
  SchemaWorkspace,
  UploadModule,
  UploadReceipt,
} from "../types";
import { getVendorCatalog } from "../vendor-catalog";
import { getTemplateHeaders } from "@/lib/uploads/definitions";
import { AccessibleDialog } from "../ui/AccessibleDialog";

type UploadCardState = {
  phase: "idle" | "uploading" | "success" | "review" | "error";
  receipt?: UploadReceipt;
  message?: string;
};

type PdfViewerState = {
  artifactKey: string;
  fileName: string;
  lineCount: number;
  loading: boolean;
  locationId: string;
  locationName: string;
  moduleId: "M01" | "M02";
  subtitle: string;
  text: string;
  title: string;
  uploadId: number;
};

function getActionableUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : "Upload failed.";
  const normalized = message.toLowerCase();
  if (normalized.includes("eai_again") || normalized.includes("connection") || normalized.includes("network") || normalized.includes("fetch")) {
    return "Temporary connection problem. Your file was not rejected; check the connection and retry the upload.";
  }
  if (normalized.includes("too large") || normalized.includes("100 mb")) {
    return "This file exceeds the 100 MB upload limit. Export a smaller statement period and try again.";
  }
  if (normalized.includes("pdf") && (normalized.includes("readable") || normalized.includes("text"))) {
    return "This PDF does not contain readable text. Download the original machine-readable statement instead of a scan.";
  }
  if (normalized.includes("provider") || normalized.includes("vendor")) {
    return `This document does not match the selected provider. ${message}`;
  }
  if (normalized.includes("schema") || normalized.includes("column") || normalized.includes("header")) {
    return `The provider export format needs review. ${message}`;
  }
  return `${message} Retry with the original file downloaded from the provider portal.`;
}

const moduleMeta = {
  M01: {
    icon: "[M01]",
    label: "M01 - Merchant Fee (Card Processor)",
    ruleEyebrow: "Upload Rules - M01 Processor Statements",
    ruleText:
      "Download the transaction-level processor export from your merchant portal. CSV is preferred, but the original PDF statement is also accepted for supported processors. Upload the file exactly as provided - no reformatting, no opening in Excel. Each processor uses different native column names. The Schema Registry validates columns on upload; any mismatch flags a review warning. This intake flow is upload-only.",
    vendors: getVendorCatalog("M01"),
    uploadArtifactKey: "m01-processor",
    templateModule: "M01",
  },
  M02: {
    icon: "[M02]",
    label: "M02 - Delivery Fee (DSP)",
    ruleEyebrow: "Upload Rules - M02 Settlement Statements",
    ruleText:
      "Download order-level settlement CSVs directly from each DSP portal. Upload the raw export exactly as downloaded. Do not normalize columns before upload. The active schema must match the native DSP export before certification can proceed. This intake flow is upload-only.",
    vendors: getVendorCatalog("M02"),
    uploadArtifactKey: "m02-settlement",
    templateModule: "M02",
  },
} as const;

export function UploadCenterView({
  activeArtifactHint,
  activeLocationId,
  activeModuleHint,
  activeLocationModules,
  activeLocationName,
  activeSourceConfig,
  activeVendorKeyHint,
  activeVendorNameHint,
  intakeState,
  modules,
  onCompleteUploadSet,
  onDirectUpload,
  onOpenLocationDashboard,
  onRemoveUpload,
  onResetLocationUploads,
  onOpenSchema,
  schemaWorkspaces,
  uploadFeedback,
}: {
  activeArtifactHint?: string | null;
  activeLocationId: string | null;
  activeModuleHint?: "M01" | "M02" | null;
  activeLocationModules: Array<"M01" | "M02">;
  activeLocationName: string | null;
  activeSourceConfig: LocationSourceConfig | null;
  activeVendorKeyHint?: string | null;
  activeVendorNameHint?: string | null;
  contractState: Record<string, Record<string, string>>;
  intakeState: Record<string, IntakeState>;
  modules: UploadModule[];
  onCompleteUploadSet: (locationId: string, moduleId: "M01" | "M02") => void;
  onDirectUpload: (
    moduleId: "M01" | "M02",
    artifactKey: string,
    file: File,
    vendor?: { key: string; name: string },
  ) => Promise<UploadReceipt | null>;
  onOpenLocationDashboard: (locationId: string) => void;
  onRemoveUpload: (
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendorKey: string,
  ) => Promise<void>;
  onResetLocationUploads: (locationId: string) => Promise<void>;
  onOpenSchema: () => void;
  schemaWorkspaces: SchemaWorkspace[];
  uploadFeedback: UploadReceipt | null;
}) {
  const [activeModule, setActiveModule] = useState<"M01" | "M02">("M01");
  const [cardState, setCardState] = useState<Record<string, UploadCardState>>({});
  const [pendingUpload, setPendingUpload] = useState<{
    moduleId: "M01" | "M02";
    artifactKey: string;
    vendor: { key: string; name: string };
  } | null>(null);
  const [pdfViewer, setPdfViewer] = useState<PdfViewerState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const focusedCardRef = useRef<HTMLDivElement | null>(null);
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
    if (activeModuleHint && availableModules.includes(activeModuleHint) && activeModuleHint !== activeModule) {
      setActiveModule(activeModuleHint);
      return;
    }

    if (!availableModules.includes(activeModule) && availableModules[0]) {
      setActiveModule(availableModules[0]);
    }
  }, [activeModule, activeModuleHint, availableModules]);

  useEffect(() => {
    setCardState({});
    setPendingUpload(null);
    setPdfViewer(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [activeLocationId]);

  useEffect(() => {
    if (!activeArtifactHint || !activeLocationId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      focusedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [activeArtifactHint, activeLocationId, activeModuleHint, activeVendorKeyHint]);

  async function handleViewExtractedText({
    artifactKey,
    fileName,
    subtitle,
    title,
    uploadId,
  }: {
    artifactKey: string;
    fileName: string;
    subtitle: string;
    title: string;
    uploadId: number;
  }) {
    setPdfViewer({
      artifactKey,
      fileName,
      lineCount: 0,
      loading: true,
      locationId: activeLocationId ?? "",
      locationName: activeLocationName ?? "Unknown location",
      moduleId: activeModule,
      subtitle,
      text: "",
      title,
      uploadId,
    });

    try {
      const response = await fetch(`/api/v1/uploads/${uploadId}/extracted-text`, {
        method: "GET",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as
        | {
            artifactKey: string;
            fileName: string;
            lineCount: number;
            locationId: string;
            locationName: string;
            moduleId: "M01" | "M02";
            text: string;
            uploadId: number;
          }
        | { error?: string };

      if (!response.ok || !("uploadId" in payload)) {
        const message =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load extracted PDF text.";
        throw new Error(message);
      }

      setPdfViewer({
        artifactKey: payload.artifactKey,
        fileName: payload.fileName,
        lineCount: payload.lineCount,
        loading: false,
        locationId: payload.locationId,
        locationName: payload.locationName,
        moduleId: payload.moduleId,
        subtitle,
        text: payload.text,
        title,
        uploadId: payload.uploadId,
      });
    } catch (error) {
      setPdfViewer({
        artifactKey,
        fileName,
        lineCount: 0,
        loading: false,
        locationId: activeLocationId ?? "",
        locationName: activeLocationName ?? "Unknown location",
        moduleId: activeModule,
        subtitle,
        text:
          error instanceof Error
            ? `Unable to load extracted PDF text.\n\n${error.message}`
            : "Unable to load extracted PDF text.",
        title,
        uploadId,
      });
    }
  }

  const activeUploadModule = modules.find((module) => module.id === activeModule) ?? modules[0];
  const activeMeta = moduleMeta[activeModule];
  const visibleVendors = useMemo(() => {
    const selected =
      activeModule === "M01" ? activeSourceConfig?.m01Vendors : activeSourceConfig?.m02Vendors;

    if (!selected || selected.length === 0) {
      return [];
    }

    const selectedKeys = new Set(selected.map((vendor) => vendor.key));
    return activeMeta.vendors.filter((vendor) => selectedKeys.has(vendor.key));
  }, [activeMeta.vendors, activeModule, activeSourceConfig]);
  const sealedWorkspaceKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const workspace of schemaWorkspaces) {
      if (workspace.vault.state !== "sealed" && workspace.status !== "sealed") {
        continue;
      }

      keys.add(
        `${workspace.locationId}:${workspace.module}:${normalizeProviderIdentity(workspace.vendor)}`,
      );
    }

    return keys;
  }, [schemaWorkspaces]);
  const isVaultSealedForProvider = (
    moduleId: "M01" | "M02",
    vendor: { key: string; name: string },
  ) => {
    if (!activeLocationId) {
      return false;
    }

    return (
      sealedWorkspaceKeys.has(
        `${activeLocationId}:${moduleId}:${normalizeProviderIdentity(vendor.name)}`,
      ) ||
      sealedWorkspaceKeys.has(
        `${activeLocationId}:${moduleId}:${normalizeProviderIdentity(vendor.key)}`,
      )
    );
  };
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

    for (const moduleId of [activeModule]) {
      const uploadModule = modules.find((item) => item.id === moduleId);
      if (!uploadModule) {
        continue;
      }

      const selectedVendors =
        moduleId === "M01" ? activeSourceConfig?.m01Vendors : activeSourceConfig?.m02Vendors;
      const vendors = selectedVendors && selectedVendors.length > 0 ? selectedVendors : [];

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
  }, [activeLocationId, activeModule, activeSourceConfig, intakeState, modules]);
  const activeModuleVaultLocked =
    visibleVendors.length > 0 &&
    visibleVendors.every((vendor) => !isVaultSealedForProvider(activeModule, vendor));

  function getCardKey(moduleId: "M01" | "M02", artifactKey: string, vendorKey: string) {
    return `${activeLocationId ?? "global"}:${moduleId}:${artifactKey}:${vendorKey}`;
  }

  async function runDirectUpload(
    target: {
      moduleId: "M01" | "M02";
      artifactKey: string;
      vendor: { key: string; name: string };
    },
    file: File,
  ) {
    const uploadKey = getCardKey(target.moduleId, target.artifactKey, target.vendor.key);

    if (!isVaultSealedForProvider(target.moduleId, target.vendor)) {
      setCardState((current) => ({
        ...current,
        [uploadKey]: {
          phase: "error",
          message:
            `Upload locked. Seal the ${target.moduleId} ${target.vendor.name} vault before uploading certification evidence.`,
        },
      }));
      return;
    }

    setCardState((current) => ({
      ...current,
      [uploadKey]: {
        phase: "uploading",
        message: "Uploading file and validating schema.",
      },
    }));

    try {
      const receipt = await onDirectUpload(target.moduleId, target.artifactKey, file, target.vendor);

      if (!receipt) {
        setCardState((current) => ({
          ...current,
          [uploadKey]: {
            phase: "error",
            message: "Upload target could not be resolved for this location.",
          },
        }));
        return;
      }

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
    } catch (error) {
      setCardState((current) => ({
        ...current,
        [uploadKey]: {
          phase: "error",
          message: getActionableUploadError(error),
        },
      }));
    }
  }

  return (
    <div className="space-y-4">
      <WorkflowContextBar
        locationId={activeLocationId}
        locationName={activeLocationName ?? "No location selected"}
        moduleId={activeModule}
        providerName={activeVendorNameHint}
        period="Current evidence period"
      />
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
            await runDirectUpload(pendingUpload, file);
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
          {activeLocationId ? (
            <button
              type="button"
              onClick={() => onOpenLocationDashboard(activeLocationId)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--text)]"
            >
              <span aria-hidden="true">&larr;</span>
              Return to Location Dashboard
            </button>
          ) : null}
        </div>
        {activeArtifactHint && activeLocationName ? (
          <div className="mt-4">
            <ActionNotice title="Required next upload">
              Upload the highlighted governed document for <span className="font-semibold">{activeLocationName}</span>
              {activeModuleHint ? <> in <span className="font-semibold">{activeModuleHint}</span></> : null}
              {activeVendorNameHint ? <> with <span className="font-semibold">{activeVendorNameHint}</span></> : null}
              .
            </ActionNotice>
          </div>
        ) : null}
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
        {activeModuleVaultLocked ? (
          <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-4">
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Upload Data Locked
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Certification evidence cannot be uploaded for{" "}
              <span className="font-semibold text-[var(--text)]">{activeLocationName ?? "this location"}</span>{" "}
              until the {activeModule} vault is sealed. Go to the restaurant dashboard, use{" "}
              <span className="font-semibold text-[var(--text)]">Seal Vault</span>, then return here.
            </div>
            {activeLocationId ? (
              <button
                type="button"
                onClick={() => onOpenLocationDashboard(activeLocationId)}
                className="mt-4 rounded-xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                Open Restaurant Dashboard
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
            Saved Evidence For This Location
          </div>
          <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Reopening Upload Data shows the current saved evidence set for{" "}
            <span className="font-semibold text-[var(--text)]">{activeLocationName ?? "this location"}</span>.
            Uploading again replaces the current file for that document slot. The bank statement is location-level:
            upload it once from any bank slot and Sentry links it to every configured module and provider automatically.
          </div>
        </div>
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
                This location does not currently have any active {activeModule === "M01" ? "card processors" : "DSPs"} configured for {activeModule}. Uploads are blocked until a source is explicitly selected for this location.
              </div>
              <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm leading-7 text-[var(--muted)]">
                Configure this from the restaurant dashboard under Active Sources. Upload Data is reserved for evidence files only.
              </div>
            </div>
          </div>
        ) : null}
        {visibleVendors.map((vendor) => {
          const vaultSealed = isVaultSealedForProvider(activeModule, vendor);
          const vaultLockMessage = `Certification evidence upload is unavailable until the ${activeModule} ${vendor.name} vault is sealed. Use Seal Vault from the restaurant dashboard, then return here.`;
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
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === settlementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === settlementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
                      title="1 | DSP Settlement CSV"
                      subtitle={`${vendor.name} order-level statement`}
                      primaryLabel="Upload CSV"
                      onPrimary={() => {
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: settlementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={settlementIntake}
                      hasUpload={settlementHasUpload}
                      uploadState={settlementCardState}
                      onFileDrop={(file) =>
                        void runDirectUpload(
                          {
                            moduleId: activeModule,
                            artifactKey: settlementArtifactKey,
                            vendor: { key: vendor.key, name: vendor.name },
                          },
                          file,
                        )
                      }
                      canViewExtractedText={Boolean(
                        settlementHasUpload &&
                          settlementIntake?.uploadId &&
                          settlementIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        settlementHasUpload &&
                        settlementIntake?.uploadId &&
                        settlementIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: settlementArtifactKey,
                                fileName: settlementIntake.fileName ?? "",
                                subtitle: `${vendor.name} order-level statement`,
                                title: "1 | DSP Settlement CSV",
                                uploadId: settlementIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        settlementHasUpload
                          ? () => onRemoveUpload(activeModule, settlementArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle={`Drop ${vendor.name} CSV or browse`}
                      emptySub="Order-level export | exact portal download"
                    />

                    <DocumentSection
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === posArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === posArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
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
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={posIntake ?? undefined}
                      hasUpload={posHasUpload}
                      uploadState={posCardState}
                      onFileDrop={(file) =>
                        posArtifactKey
                          ? void runDirectUpload(
                              {
                                moduleId: activeModule,
                                artifactKey: posArtifactKey,
                                vendor: { key: vendor.key, name: vendor.name },
                              },
                              file,
                            )
                          : undefined
                      }
                      canViewExtractedText={Boolean(
                        posHasUpload && posIntake?.uploadId && posIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        posHasUpload && posIntake?.uploadId && posIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: posArtifactKey,
                                fileName: posIntake.fileName ?? "",
                                subtitle: "POS net sales breakdown for the same period",
                                title: "2 | POS Summary by Channel",
                                uploadId: posIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        posHasUpload && posArtifactKey
                          ? () => onRemoveUpload(activeModule, posArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle="Drop POS Summary CSV or browse"
                      emptySub="channel | pos_net_sales | commission_variance"
                    />

                    <DocumentSection
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === agreementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === agreementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
                      title="3 | DSP Agreement"
                      subtitle="Signed commercial agreement including the rate schedule"
                      primaryLabel="Upload PDF"
                      onPrimary={() => {
                        if (!agreementArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: agreementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={agreementIntake ?? undefined}
                      hasUpload={agreementHasUpload}
                      uploadState={agreementCardState}
                      onFileDrop={(file) =>
                        agreementArtifactKey
                          ? void runDirectUpload(
                              {
                                moduleId: activeModule,
                                artifactKey: agreementArtifactKey,
                                vendor: { key: vendor.key, name: vendor.name },
                              },
                              file,
                            )
                          : undefined
                      }
                      canViewExtractedText={Boolean(
                        agreementHasUpload &&
                          agreementIntake?.uploadId &&
                          agreementIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        agreementHasUpload &&
                        agreementIntake?.uploadId &&
                        agreementIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: agreementArtifactKey,
                                fileName: agreementIntake.fileName ?? "",
                                subtitle: "Signed commercial agreement including the rate schedule",
                                title: "3 | DSP Agreement",
                                uploadId: agreementIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        agreementHasUpload && agreementArtifactKey
                          ? () => onRemoveUpload(activeModule, agreementArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle={`Drop signed ${vendor.name} agreement PDF or browse`}
                      emptySub="PDF only | signed executed copy"
                    />

                    <DocumentSection
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === bankArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === bankArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
                      title="4 | Bank Statement"
                      subtitle="Matching-period deposit statement for payout reconciliation"
                      primaryLabel="Upload PDF"
                      onPrimary={() => {
                        if (!bankArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: bankArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={bankIntake ?? undefined}
                      hasUpload={bankHasUpload}
                      uploadState={bankCardState}
                      onFileDrop={(file) =>
                        bankArtifactKey
                          ? void runDirectUpload(
                              {
                                moduleId: activeModule,
                                artifactKey: bankArtifactKey,
                                vendor: { key: vendor.key, name: vendor.name },
                              },
                              file,
                            )
                          : undefined
                      }
                      canViewExtractedText={Boolean(
                        bankHasUpload && bankIntake?.uploadId && bankIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        bankHasUpload && bankIntake?.uploadId && bankIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: bankArtifactKey,
                                fileName: bankIntake.fileName ?? "",
                                subtitle: "Matching-period deposit statement for payout reconciliation",
                                title: "4 | Bank Statement",
                                uploadId: bankIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        bankHasUpload && bankArtifactKey
                          ? () => onRemoveUpload(activeModule, bankArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle="Upload shared bank statement once"
                      emptySub="PDF only | matching period"
                    />
                  </div>
                ) : (
                  <div className="space-y-5">
                    <DocumentSection
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === settlementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === settlementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
                      title="1 | Processor Statement"
                      subtitle={`${vendor.name} raw processor export or original statement PDF`}
                      primaryLabel="Upload File"
                      onPrimary={() => {
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: settlementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={settlementIntake}
                      hasUpload={settlementHasUpload}
                      uploadState={settlementCardState}
                      onFileDrop={(file) =>
                        void runDirectUpload(
                          {
                            moduleId: activeModule,
                            artifactKey: settlementArtifactKey,
                            vendor: { key: vendor.key, name: vendor.name },
                          },
                          file,
                        )
                      }
                      canViewExtractedText={Boolean(
                        settlementHasUpload &&
                          settlementIntake?.uploadId &&
                          settlementIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        settlementHasUpload &&
                        settlementIntake?.uploadId &&
                        settlementIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: settlementArtifactKey,
                                fileName: settlementIntake.fileName ?? "",
                                subtitle: `${vendor.name} raw processor export or original statement PDF`,
                                title: "1 | Processor Statement",
                                uploadId: settlementIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        settlementHasUpload
                          ? () => onRemoveUpload(activeModule, settlementArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle={`Drop ${vendor.name} CSV/PDF or browse`}
                      emptySub="CSV preferred | original PDF accepted | no reformatting"
                    />

                    <DocumentSection
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === posArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === posArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
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
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={posIntake ?? undefined}
                      hasUpload={posHasUpload}
                      uploadState={posCardState}
                      onFileDrop={(file) =>
                        posArtifactKey
                          ? void runDirectUpload(
                              {
                                moduleId: activeModule,
                                artifactKey: posArtifactKey,
                                vendor: { key: vendor.key, name: vendor.name },
                              },
                              file,
                            )
                          : undefined
                      }
                      canViewExtractedText={Boolean(
                        posHasUpload && posIntake?.uploadId && posIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        posHasUpload && posIntake?.uploadId && posIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: posArtifactKey,
                                fileName: posIntake.fileName ?? "",
                                subtitle: "Matching-period POS export for cross-system reconciliation",
                                title: "2 | POS Export CSV",
                                uploadId: posIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        posHasUpload && posArtifactKey
                          ? () => onRemoveUpload(activeModule, posArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle="Drop POS export CSV or browse"
                      emptySub="gross_sales | tenders | transactions"
                    />

                    <DocumentSection
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === agreementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === agreementArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
                      title="3 | Merchant Agreement"
                      subtitle="Signed merchant services agreement with rate schedule"
                      primaryLabel="Upload PDF"
                      onPrimary={() => {
                        if (!agreementArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: agreementArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={agreementIntake ?? undefined}
                      hasUpload={agreementHasUpload}
                      uploadState={agreementCardState}
                      onFileDrop={(file) =>
                        agreementArtifactKey
                          ? void runDirectUpload(
                              {
                                moduleId: activeModule,
                                artifactKey: agreementArtifactKey,
                                vendor: { key: vendor.key, name: vendor.name },
                              },
                              file,
                            )
                          : undefined
                      }
                      canViewExtractedText={Boolean(
                        agreementHasUpload &&
                          agreementIntake?.uploadId &&
                          agreementIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        agreementHasUpload &&
                        agreementIntake?.uploadId &&
                        agreementIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: agreementArtifactKey,
                                fileName: agreementIntake.fileName ?? "",
                                subtitle: "Signed merchant services agreement with rate schedule",
                                title: "3 | Merchant Agreement",
                                uploadId: agreementIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        agreementHasUpload && agreementArtifactKey
                          ? () => onRemoveUpload(activeModule, agreementArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle={`Drop signed ${vendor.name} agreement PDF or browse`}
                      emptySub="PDF only | signed executed copy"
                    />

                    <DocumentSection
                      emphasized={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === bankArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                      }
                      emphasisRef={
                        activeModule === activeModuleHint &&
                        activeArtifactHint === bankArtifactKey &&
                        (!activeVendorKeyHint || activeVendorKeyHint === vendor.key)
                          ? focusedCardRef
                          : undefined
                      }
                      title="4 | Bank Statement"
                      subtitle="Shared location statement · automatically linked across modules and providers"
                      primaryLabel="Upload PDF"
                      onPrimary={() => {
                        if (!bankArtifactKey) return;
                        setPendingUpload({
                          moduleId: activeModule,
                          artifactKey: bankArtifactKey,
                          vendor: { key: vendor.key, name: vendor.name },
                        });
                        fileInputRef.current?.click();
                      }}
                      locked={!vaultSealed}
                      lockMessage={vaultLockMessage}
                      onOpenVault={
                        activeLocationId ? () => onOpenLocationDashboard(activeLocationId) : undefined
                      }
                      intake={bankIntake ?? undefined}
                      hasUpload={bankHasUpload}
                      uploadState={bankCardState}
                      onFileDrop={(file) =>
                        bankArtifactKey
                          ? void runDirectUpload(
                              {
                                moduleId: activeModule,
                                artifactKey: bankArtifactKey,
                                vendor: { key: vendor.key, name: vendor.name },
                              },
                              file,
                            )
                          : undefined
                      }
                      canViewExtractedText={Boolean(
                        bankHasUpload && bankIntake?.uploadId && bankIntake?.fileName?.toLowerCase().endsWith(".pdf"),
                      )}
                      onViewExtractedText={
                        bankHasUpload && bankIntake?.uploadId && bankIntake?.fileName?.toLowerCase().endsWith(".pdf")
                          ? () =>
                              void handleViewExtractedText({
                                artifactKey: bankArtifactKey,
                                fileName: bankIntake.fileName ?? "",
                                subtitle: "Shared location statement used across configured evidence sets",
                                title: "4 | Bank Statement",
                                uploadId: bankIntake.uploadId!,
                              })
                          : undefined
                      }
                      onRemove={
                        bankHasUpload && bankArtifactKey
                          ? () => onRemoveUpload(activeModule, bankArtifactKey, vendor.key)
                          : undefined
                      }
                      onOpenSchema={onOpenSchema}
                      emptyTitle="Upload shared bank statement once"
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
                    {uploadCompletionSummary.uploadedCount}/{uploadCompletionSummary.totalCount} required {activeModule} documents uploaded for{" "}
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
                      All required {activeModule} documents for this location are present. Finish intake to return to the Location Waterfall.
                    </div>
                  )}
                </div>
                <div className="min-w-[280px]">
                  <button
                    type="button"
                    disabled={!uploadCompletionSummary.isComplete || !activeLocationId}
                    onClick={() => {
                      if (activeLocationId) {
                        onCompleteUploadSet(activeLocationId, activeModule);
                      }
                    }}
                    className="w-full rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      !activeLocationId
                        ? "Select a location first."
                        : uploadCompletionSummary.isComplete
                          ? "All required uploads are complete."
                          : `Uploads are still missing: ${uploadCompletionSummary.missingRows
                              .slice(0, 3)
                              .map((row) => row.label)
                              .join(" | ")}${uploadCompletionSummary.missingRows.length > 3 ? " | more remaining" : ""}`
                    }
                  >
                    {activeLocationName ? `Finish ${activeModule} Uploads for ${activeLocationName}` : `Finish ${activeModule} Uploads`}
                  </button>
                  {!uploadCompletionSummary.isComplete ? (
                    <div className="mt-2 text-xs leading-5 text-[var(--muted)]">
                      Finish is locked until all required uploads for {activeModule} on this location are present.
                      {uploadCompletionSummary.missingRows.length > 0 ? (
                        <>
                          {" "}Still missing:{" "}
                          <span className="text-[var(--accent)]">
                            {uploadCompletionSummary.missingRows.slice(0, 2).map((row) => row.label).join(" | ")}
                            {uploadCompletionSummary.missingRows.length > 2
                              ? ` | +${uploadCompletionSummary.missingRows.length - 2} more`
                              : ""}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs leading-5 text-[var(--success)]">
                      All required {activeModule} uploads are present. You can finish this module now.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!activeLocationId}
                  onClick={() => {
                    if (activeLocationId) {
                      void onResetLocationUploads(activeLocationId);
                    }
                  }}
                  className="rounded-xl border border-[rgba(214,48,49,0.24)] px-4 py-3 text-sm font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[rgba(214,48,49,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start New Certification Period
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      </div>

      {pdfViewer ? (
        <AccessibleDialog ariaLabel={`Extracted PDF text for ${pdfViewer.title}`} closeOnEscape={!pdfViewer.loading} onClose={() => setPdfViewer(null)} className="fixed inset-0 z-[220] flex items-center justify-center bg-[rgba(15,23,42,0.42)] px-4 py-6">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
              <div className="min-w-0">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Extracted PDF Text
                </div>
                <div className="mt-2 font-[family-name:var(--font-display)] text-[30px] font-bold tracking-[-0.05em] text-[var(--text)]">
                  {pdfViewer.title}
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {pdfViewer.locationName} | {pdfViewer.moduleId} | {pdfViewer.fileName}
                </div>
                <div className="text-sm leading-7 text-[var(--muted)]">{pdfViewer.subtitle}</div>
              </div>
              <button
                type="button"
                onClick={() => setPdfViewer(null)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
              >
                Close
              </button>
            </div>

            <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={pdfViewer.loading ? "info" : pdfViewer.text.trim() ? "success" : "warning"}>
                  {pdfViewer.loading ? "Loading" : pdfViewer.text.trim() ? "Text Extracted" : "No Text Found"}
                </Badge>
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {pdfViewer.lineCount} lines
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Upload #{pdfViewer.uploadId}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {pdfViewer.artifactKey}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
              {pdfViewer.loading ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">
                  Loading persisted extracted text for this PDF...
                </div>
              ) : pdfViewer.text.trim() ? (
                <div className="min-w-max rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 font-[family-name:var(--font-mono)] text-[12px] leading-6 text-[var(--text)]">
                  {pdfViewer.text.split(/\r?\n/).map((line, index) => (
                    <div key={`${index}:${line.slice(0, 24)}`} className="min-h-6 whitespace-pre">
                      {line || " "}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[rgba(255,152,0,0.3)] bg-[rgba(255,152,0,0.08)] px-5 py-5 text-sm leading-7 text-[var(--text)]">
                  No machine-readable text was extracted from this saved PDF. This usually means the document is scan-only or image-only rather than text-based.
                </div>
              )}
            </div>
          </div>
        </AccessibleDialog>
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
            {receipt.detectedFormatName ? ` | Detected: ${receipt.detectedFormatName}` : ""}
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
      {receipt.parseWarnings?.length ? (
        <div className="mt-3 rounded-xl border border-[rgba(255,152,0,0.3)] bg-[rgba(255,152,0,0.08)] px-3 py-2 text-sm text-[var(--text)]">
          {receipt.parseWarnings[0]}
        </div>
      ) : null}
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
  emphasized = false,
  emphasisRef,
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onViewExtractedText,
  canViewExtractedText = false,
  onRemove,
  onOpenSchema,
  intake,
  hasUpload,
  uploadState,
  onFileDrop,
  locked = false,
  lockMessage,
  onOpenVault,
  emptyTitle,
  emptySub,
}: {
  emphasized?: boolean;
  emphasisRef?: RefObject<HTMLDivElement | null>;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onViewExtractedText?: () => void;
  canViewExtractedText?: boolean;
  onRemove?: () => void;
  onOpenSchema?: () => void;
  intake?: IntakeState;
  hasUpload: boolean;
  uploadState?: UploadCardState;
  onFileDrop?: (file: File) => void;
  locked?: boolean;
  lockMessage?: string;
  onOpenVault?: () => void;
  emptyTitle: string;
  emptySub: string;
}) {
  return (
    <div
      ref={emphasized ? emphasisRef : undefined}
      className={`rounded-xl border p-3 transition ${
        emphasized
          ? "border-[var(--accent)] bg-[rgba(214,48,49,0.04)] shadow-[0_0_0_3px_rgba(214,48,49,0.08)]"
          : "border-[var(--border)]"
      }`}
    >
      {emphasized ? (
        <div className="mb-3 inline-flex rounded-full border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.08)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
          Upload This Next
        </div>
      ) : null}
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
            locked
              ? "cursor-not-allowed bg-[var(--panel-soft)] text-[var(--muted)]"
              : uploadState?.phase === "uploading"
              ? "cursor-wait bg-[var(--info)]"
              : "bg-[var(--text)] hover:bg-[var(--accent)]"
          }`}
          disabled={locked || uploadState?.phase === "uploading"}
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
        {canViewExtractedText && onViewExtractedText ? (
          <button
            type="button"
            onClick={() => void onViewExtractedText()}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            View Extracted Text
          </button>
        ) : null}
        {hasUpload && onRemove ? (
          <button
            type="button"
            onClick={() => void onRemove()}
            className="rounded-lg border border-[rgba(214,48,49,0.24)] px-3 py-2 text-[13px] text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[rgba(214,48,49,0.06)]"
          >
            Remove File
          </button>
        ) : null}
      </div>
      {uploadState?.message ? (
        <div
          aria-live="polite"
          role={uploadState.phase === "error" ? "alert" : "status"}
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
      {locked ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--muted)]">
          <div className="font-semibold text-[var(--text)]">Upload locked until vault is sealed.</div>
          <div>{lockMessage}</div>
          {onOpenVault ? (
            <button
              type="button"
              onClick={onOpenVault}
              className="mt-3 rounded-lg bg-[var(--text)] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[var(--accent)]"
            >
              Open Restaurant Dashboard
            </button>
          ) : null}
        </div>
      ) : null}
      <UploadTile
        intake={intake}
        hasUpload={hasUpload}
        emptyTitle={emptyTitle}
        emptySub={emptySub}
        onClick={onPrimary}
        onFileDrop={onFileDrop}
        onOpenSchema={onOpenSchema}
        locked={locked}
        compact
      />
    </div>
  );
}

function UploadTile({
  intake,
  hasUpload,
  emptyTitle,
  emptySub,
  onClick,
  onFileDrop,
  onOpenSchema,
  locked = false,
  compact = false,
}: {
  intake?: IntakeState;
  hasUpload: boolean;
  emptyTitle: string;
  emptySub: string;
  onClick: () => void;
  onFileDrop?: (file: File) => void;
  onOpenSchema?: () => void;
  locked?: boolean;
  compact?: boolean;
}) {
  const hasParseWarning = Boolean(intake?.parseWarnings?.length);
  const hasSchemaWarning = intake?.matchPct !== undefined && intake.matchPct < 60;
  const reviewState = hasParseWarning || hasSchemaWarning;
  const schemaGatePassed = Boolean(intake?.schema) && !hasSchemaWarning;
  const fieldsGatePassed = Boolean(intake?.fields) && !reviewState;
  const [dragActive, setDragActive] = useState(false);

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (locked) {
      event.dataTransfer.dropEffect = "none";
      return;
    }
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    if (locked) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file && onFileDrop) {
      onFileDrop(file);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={locked}
        className={`mt-4 flex w-full flex-col items-center justify-center rounded-2xl px-4 text-center transition ${
          locked
            ? "cursor-not-allowed bg-[#F3F4F7] opacity-70"
            : dragActive
            ? "bg-[rgba(214,48,49,0.08)] ring-2 ring-[rgba(214,48,49,0.2)]"
            : "bg-[#F8F8FA] hover:bg-[#F3F4F7]"
        } ${compact ? "min-h-[110px] py-5" : "min-h-[140px] py-6"
        }`}
      >
        {hasUpload ? (
          <>
            <span
              className={`text-[20px] font-semibold ${
                reviewState
                  ? "text-[var(--accent)]"
                  : "text-[var(--success)]"
              }`}
            >
              {reviewState ? "REVIEW" : "MATCHED"}
            </span>
            <span
              className={`mt-3 text-[14px] font-semibold ${
                reviewState
                  ? "text-[var(--accent)]"
                  : "text-[var(--success)]"
              }`}
            >
              {intake?.fileName}
            </span>
            <span className="mt-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
              {formatBytes(intake?.sizeBytes ?? 0)} | {intake?.rows ?? "-"} rows | Schema{" "}
              {intake?.matchPct !== undefined
                ? `${intake.matchPct}%`
                : hasParseWarning
                  ? "review"
                  : "sealed"}{" "}
              | SHA-256:{" "}
              {intake?.hashValue ?? "pending"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[18px] font-semibold text-[var(--muted)]">{locked ? "LOCKED" : "DROP"}</span>
            <span className={`${compact ? "mt-2 text-[15px]" : "mt-3 text-[24px]"} leading-none text-[var(--text)]`}>
              {locked ? "Seal the vault before uploading evidence" : emptyTitle}
            </span>
            <span className="mt-3 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
              {locked ? "governance seal required" : emptySub}
            </span>
          </>
        )}
      </button>

      {hasUpload && hasSchemaWarning ? (
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
          {onOpenSchema ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={onOpenSchema}
                className="rounded-lg border border-[rgba(214,48,49,0.24)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[rgba(214,48,49,0.06)]"
              >
                Open Schema Registry
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasUpload && intake?.parseWarnings?.length ? (
        <div className="mt-4 rounded-xl border border-[rgba(255,152,0,0.3)] bg-[rgba(255,152,0,0.08)] px-4 py-3 text-[11px] leading-5 text-[var(--text)]">
          {intake.parseWarnings[0]}
        </div>
      ) : null}

      {hasUpload ? (
        <div className="mt-3 flex gap-2">
          <IntakeDot done={Boolean(intake?.uploaded)} label="Upload" />
          <IntakeDot done={Boolean(intake?.hash)} label="Hash" />
          <IntakeDot done={schemaGatePassed} label="Schema" />
          <IntakeDot done={fieldsGatePassed} label="Fields" />
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

function normalizeProviderIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
