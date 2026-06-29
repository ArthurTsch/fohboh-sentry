"use client";

import {
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { navigation, viewMeta } from "./config";
import {
  caarRecords,
  emptyAddLocationDraft,
  faqItems,
  initialMessages,
  locations,
  logRecords,
  schemaWorkspaces,
  uploadModules,
  wgsAccounts,
  wgsApprovals,
  wgsQueue,
  wgsUsers,
} from "./data";
import {
  buildCertificationResult,
  extractManualMetrics,
} from "./caar-engine";
import { useSentryDerivedState } from "./hooks/useSentryDerivedState";
import { useSentryPersistence } from "./hooks/useSentryPersistence";
import { AddLocationModal } from "./overlays/AddLocationModal";
import { ArtifactWorkflowModal } from "./overlays/ArtifactWorkflowModal";
import { CertificationRunModal } from "./overlays/CertificationRunModal";
import { CaarReportModal } from "./overlays/CaarReportModal";
import { RequestAccessModal } from "./overlays/RequestAccessModal";
import { SchemaEditorModal } from "./overlays/SchemaEditorModal";
import { SupportChat } from "./overlays/SupportChat";
import { Toast } from "./overlays/Toast";
import { UploadChecklistModal } from "./overlays/UploadChecklistModal";
import { WgsOnboardingWizard } from "./overlays/WgsOnboardingWizard";
import { WgsUserModal } from "./overlays/WgsUserModal";
import { SentryShell } from "./SentryShell";
import { SentryViewRouter } from "./SentryViewRouter";
import type {
  AddLocationDraft,
  CaarRecord,
  ChatMessage,
  IntakeState,
  LogRecord,
  RequestAccessDraft,
  SchemaWorkspace,
  SessionState,
  SupportModeState,
  UploadArtifact,
  UploadReceipt,
  ViewId,
  WgsOnboardingProgress,
  WgsUser,
} from "./types";
import { getSupportReply } from "./utils";
import { LandingPage } from "./views/LandingPage";

type ActiveArtifactState = {
  accountId: string;
  artifact: UploadArtifact;
  entryMode?: "manual" | "upload";
  locationId: string;
  locationName: string;
  moduleId: "M01" | "M02";
  vendorKey?: string;
  vendorName?: string;
};

type ActiveCertificationState = {
  locationId: string;
  locationName: string;
  ready: boolean;
  steps: { detail: string; done: boolean; label: string }[];
  trustScore: number;
};

const BASE_UPLOAD_TEMPLATE_ACCOUNT_ID = "C001";

type DatabaseRestaurant = {
  city: string | null;
  country: string | null;
  created_by: number | null;
  id: number;
  location: string | null;
  name: string;
  state: string | null;
  store_id: string | null;
  sentry_state?: {
    account_id: string | null;
    completed: boolean | null;
    created_by: number | null;
    ium: string | null;
    last_certified: string | null;
    location_id: string;
    m01_score: number;
    m02_score: number;
    modules_json: unknown;
    onboarding_checklist: unknown;
    onboarding_progress: unknown;
    recovery_display: string | null;
    restaurant_id: number;
    status: string;
  } | null;
  unit_id: string | null;
};

type DatabaseCaarRecord = CaarRecord & {
  createdAt?: string | null;
  createdBy?: number | null;
  restaurantId?: number | null;
};

type PersistedUploadRecord = {
  artifactKey: string;
  accountId?: string | null;
  expectedColumns?: number;
  fields: boolean;
  fileName: string;
  hashValue?: string;
  id: number;
  locationId: string;
  locationName: string;
  matchedColumns?: number;
  matchPct?: number;
  metrics?: IntakeState["metrics"];
  moduleId: "M01" | "M02";
  pageCount?: number;
  rows?: number;
  schema: boolean;
  sizeBytes: number;
  status: "ready" | "review";
  unmatchedHeaders?: string[];
  updatedAt?: string;
  uploaded: boolean;
  vendorKey?: string;
  vendorName?: string;
};

export function SentryApp({ initialSession = null }: { initialSession?: SessionState | null }) {
  const locationStatePersistenceStatusRef = useRef<"unknown" | "available" | "missing-table">(
    "unknown",
  );
  const [session, setSession] = useState<SessionState | null>(initialSession);
  const [activeViewOverride, setActiveViewOverride] = useState<ViewId | null>(null);
  const [expandedLocations, setExpandedLocations] = useState<string[]>(["LOC-104"]);
  const [selectedCaar, setSelectedCaar] = useState<CaarRecord | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "immutable" | "editable">("all");
  const [faqQuery, setFaqQuery] = useState("");
  const [faqOpen, setFaqOpen] = useState<string | null>(faqItems[0]?.question ?? null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [toast, setToast] = useState<string | null>(null);

  const [caarState, setCaarState] = useState(caarRecords);
  const [locationState, setLocationState] = useState(locations);
  const [assignedLocationState, setAssignedLocationState] = useState<typeof locations>([]);
  const [logState, setLogState] = useState(logRecords);
  const [uploadState, setUploadState] = useState(uploadModules);
  const [schemaState, setSchemaState] = useState(schemaWorkspaces);
  const [wgsAccountState] = useState(wgsAccounts);
  const [wgsQueueState, setWgsQueueState] = useState(wgsQueue);
  const [wgsApprovalState, setWgsApprovalState] = useState(wgsApprovals);
  const [wgsUserState, setWgsUserState] = useState(wgsUsers);
  const [wgsOnboardingState, setWgsOnboardingState] = useState<Record<string, WgsOnboardingProgress>>({});
  const [onboardingState, setOnboardingState] = useState<Record<string, boolean[]>>({
    account: [true, true, false],
    vendors: [true, false, false],
    evidence: [false, false, false],
    schema: [false, false, false],
    seal: [false, false, false],
    certify: [false, false, false],
  });

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [activeOnboardingLocation, setActiveOnboardingLocation] = useState<string | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<SchemaWorkspace | null>(null);
  const [editingWgsUser, setEditingWgsUser] = useState<WgsUser | null>(null);
  const [creatingWgsUser, setCreatingWgsUser] = useState(false);
  const [activeChecklist, setActiveChecklist] = useState<ActiveArtifactState | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifactState | null>(null);
  const [artifactIntakeState, setArtifactIntakeState] = useState<Record<string, IntakeState>>({});
  const [artifactContractState, setArtifactContractState] = useState<Record<string, Record<string, string>>>({});
  const [activeCertification, setActiveCertification] = useState<ActiveCertificationState | null>(null);
  const [activeUploadLocation, setActiveUploadLocation] = useState<{
    accountId: string;
    id: string;
    name: string;
  } | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<UploadReceipt | null>(null);
  const [supportMode, setSupportMode] = useState<SupportModeState>({
    active: false,
    accountId: null,
    accountName: null,
  });

  const effectiveSession = session;
  const activeView = activeViewOverride ?? (effectiveSession?.role === "WGS Manager" ? "wgs" : "dashboard");
  const runtimeLocationState = effectiveSession ? assignedLocationState : locationState;

  const deferredFaqQuery = useDeferredValue(faqQuery);

  const persistenceHydrated = useSentryPersistence(
    {
      artifactContractState,
      artifactIntakeState,
      caarState,
      locationState,
      logState,
      onboardingState,
      schemaState,
      supportMode,
      uploadState,
      wgsApprovalState,
      wgsOnboardingState,
      wgsQueueState,
      wgsUserState,
    },
    {
      setArtifactContractState,
      setArtifactIntakeState,
      setCaarState,
      setLocationState,
      setLogState,
      setOnboardingState,
      setSchemaState,
      setSupportMode,
      setUploadState,
      setWgsApprovalState,
      setWgsOnboardingState,
      setWgsQueueState,
      setWgsUserState,
    },
  );

  const syncAssignedRestaurants = useCallback(async function syncRestaurants(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    const response = await fetch("/api/restaurants", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      restaurants?: DatabaseRestaurant[];
    };

    setWgsOnboardingState((current) => ({
      ...current,
      ...extractOnboardingState(payload.restaurants ?? []),
    }));
    const persistedChecklist = extractOnboardingChecklist(payload.restaurants ?? []);
    if (persistedChecklist) {
      setOnboardingState(persistedChecklist);
    }
    setAssignedLocationState(
      mapAssignedRestaurantsToLocations(payload.restaurants ?? [], sessionState),
    );
  }, [effectiveSession, persistenceHydrated]);

  const syncAssignedCaars = useCallback(async function syncCaars(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    const response = await fetch("/api/caars", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      reports?: DatabaseCaarRecord[];
    };

    setCaarState(payload.reports ?? []);
  }, [effectiveSession, persistenceHydrated]);

  const applyPersistedUpload = useCallback((upload: PersistedUploadRecord, accountId: string) => {
    const locationScopedKey = getArtifactStateKey(
      accountId,
      upload.locationId,
      upload.moduleId,
      upload.artifactKey,
      upload.vendorKey,
    );

    setArtifactIntakeState((state) => ({
      ...state,
      [locationScopedKey]: {
        uploaded: upload.uploaded,
        hash: Boolean(upload.hashValue),
        schema: upload.schema,
        fields: upload.fields,
        fileName: upload.fileName,
        rows: upload.rows,
        hashValue: upload.hashValue,
        vendorKey: upload.vendorKey,
        vendorName: upload.vendorName,
        sizeBytes: upload.sizeBytes,
        matchPct: upload.matchPct,
        matchedColumns: upload.matchedColumns,
        expectedColumns: upload.expectedColumns,
        metrics: upload.metrics,
        unmatchedHeaders: upload.unmatchedHeaders,
        updatedAt: upload.updatedAt,
      },
    }));

    setUploadState((current) =>
      current.map((module) =>
        module.accountId === accountId && module.id === upload.moduleId
          ? {
              ...module,
              artifacts: module.artifacts.map((artifact) =>
                artifact.key === upload.artifactKey
                  ? {
                      ...artifact,
                      status: upload.status === "ready" ? "Ready" : "Needs Review",
                      note:
                        upload.matchPct !== undefined
                          ? `${upload.fileName} uploaded. Schema match ${upload.matchPct}%. ${
                              upload.status === "ready"
                                ? "Ready for certification intake."
                                : "WGS review required."
                            }`
                          : `${upload.fileName} uploaded and stored for this location.`,
                    }
                  : artifact,
              ),
            }
          : module,
      ),
    );

    return {
      receipt: {
        artifactKey: upload.artifactKey,
        expectedColumns: upload.expectedColumns,
        fileName: upload.fileName,
        hashValue: upload.hashValue,
        locationId: upload.locationId,
        locationName: upload.locationName,
        matchedColumns: upload.matchedColumns,
        matchPct: upload.matchPct,
        metrics: upload.metrics,
        moduleId: upload.moduleId,
        pageCount: upload.pageCount,
        rows: upload.rows,
        sizeBytes: upload.sizeBytes,
        status: upload.status,
        unmatchedHeaders: upload.unmatchedHeaders,
        updatedAt: upload.updatedAt,
        uploadId: upload.id,
        uploaded: upload.uploaded,
        vendorKey: upload.vendorKey,
        vendorName: upload.vendorName,
      } satisfies UploadReceipt,
    };
  }, []);

  const syncPersistedUploads = useCallback(async function syncUploads(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    const response = await fetch("/api/v1/uploads", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      uploads?: PersistedUploadRecord[];
    };

    const uploadRecords = payload.uploads ?? [];
    for (const upload of uploadRecords) {
      const accountId =
        upload.accountId ??
        (sessionState.role === "WGS Manager"
          ? "C001"
          : sessionState.accountId ?? `mgr:${sessionState.email.toLowerCase()}`);
      applyPersistedUpload(upload, accountId);
    }
  }, [
    applyPersistedUpload,
    effectiveSession,
    persistenceHydrated,
  ]);

  useEffect(() => {
    if (!effectiveSession || !persistenceHydrated) return;

    let cancelled = false;

    async function run() {
      const sessionState = effectiveSession;
      if (!sessionState) {
        return;
      }
      await syncAssignedRestaurants(sessionState);
      await Promise.all([syncAssignedCaars(sessionState), syncPersistedUploads(sessionState)]);

      if (cancelled) return;
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [effectiveSession, persistenceHydrated, syncAssignedCaars, syncAssignedRestaurants, syncPersistedUploads]);

  const {
    averageTrust,
    filteredFaq,
    filteredLogs,
    totalCaars,
    totalRecovery,
    visibleCaars,
    visibleLocations,
    visibleSchemaWorkspaces,
    visibleUploadModules,
  } = useSentryDerivedState({
    caarState,
    deferredFaqQuery,
    logFilter,
    logState,
    locationState: runtimeLocationState,
    schemaState,
    session: effectiveSession,
    supportMode,
    uploadState,
  });

  function upsertRuntimeLocation(nextLocation: (typeof locations)[number]) {
    setAssignedLocationState((current) => {
      const index = current.findIndex((item) => item.id === nextLocation.id);
      if (index === -1) {
        return [...current, nextLocation];
      }

      return current.map((item, itemIndex) => (itemIndex === index ? nextLocation : item));
    });
  }

  function updateRuntimeLocation(
    locationId: string,
    updater: (location: (typeof locations)[number]) => (typeof locations)[number],
  ) {
    setAssignedLocationState((current) =>
      current.map((item) => (item.id === locationId ? updater(item) : item)),
    );
  }

  function resolveUploadModulesForAccount(accountId: string) {
    const exactModules = uploadState.filter((module) => module.accountId === accountId);
    if (exactModules.length > 0) {
      return exactModules;
    }

    const baseTemplates = uploadModules.filter(
      (module) => module.accountId === BASE_UPLOAD_TEMPLATE_ACCOUNT_ID,
    );

    return baseTemplates.map((module) => ({
      ...module,
      accountId,
      artifacts: module.artifacts.map((artifact) => ({
        ...artifact,
        status: "Missing" as const,
        note: "No upload received yet for this location.",
      })),
    }));
  }

  function getScopedAccountId() {
    if (supportMode.active && supportMode.accountId) return supportMode.accountId;
    if (effectiveSession?.accountId) return effectiveSession.accountId;
    return "C001";
  }

  function getScopedAccountName() {
    if (supportMode.active && supportMode.accountName) return supportMode.accountName;
    return effectiveSession?.name?.trim() || effectiveSession?.email || "Portfolio";
  }

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout((showToast as typeof showToast & { timer?: number }).timer);
    (showToast as typeof showToast & { timer?: number }).timer = window.setTimeout(
      () => setToast(null),
      2200,
    );
  }

  function createWgsOnboardingProgress(): WgsOnboardingProgress {
    return {
      checks: {},
      completed: false,
      selectedVendors: { m01: [], m02: [] },
      stepIndex: 0,
      uploads: {},
    };
  }

  function getArtifactStateKey(
    accountId: string,
    locationId: string,
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendorKey?: string,
  ) {
    return `${accountId}:${locationId}:${moduleId}:${artifactKey}:${vendorKey ?? "global"}`;
  }

  function appendLog(entry: Omit<LogRecord, "hash" | "ts" | "user"> & { hash?: string; user?: string }) {
    setLogState((current) => [
      {
        accountId: entry.accountId,
        action: entry.action,
        hash:
          entry.hash ??
          `${entry.immutable ? "sha256" : "draft"}:${Math.random().toString(16).slice(2, 10)}`,
        immutable: entry.immutable,
        location: entry.location,
        ts: new Date().toISOString().replace("T", " ").slice(0, 16),
        user: entry.user ?? session?.email ?? "system",
      },
      ...current,
    ]);
  }

  function handleLogin(nextSession: SessionState) {
    startTransition(() => {
      setSession(nextSession);
      if (nextSession.role !== "WGS Manager") {
        setSupportMode({ active: false, accountId: null, accountName: null });
      }
      setActiveViewOverride(nextSession.role === "WGS Manager" ? "wgs" : "dashboard");
    });
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => null);

    startTransition(() => {
      setSession(null);
      setSelectedCaar(null);
      setChatOpen(false);
      setMessages(initialMessages);
      setActiveViewOverride("dashboard");
      setShowAddLocation(false);
      setShowRequestAccess(false);
      setActiveOnboardingLocation(null);
      setEditingWorkspace(null);
      setEditingWgsUser(null);
      setCreatingWgsUser(false);
      setActiveArtifact(null);
      setActiveChecklist(null);
      setActiveCertification(null);
      setActiveUploadLocation(null);
      setUploadFeedback(null);
      setAssignedLocationState([]);
      setSupportMode({ active: false, accountId: null, accountName: null });
    });
  }

  function handleViewChange(view: ViewId) {
    startTransition(() => setActiveViewOverride(view));
  }

  function handleOpenLocationUploads(locationId: string) {
    const location = visibleLocations.find((item) => item.id === locationId);
    if (!location) {
      return;
    }

    setActiveUploadLocation({
      accountId: location.accountId,
      id: location.id,
      name: location.name,
    });
    startTransition(() => setActiveViewOverride("uploads"));
  }

  function toggleLocation(id: string) {
    setExpandedLocations((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function handleExpandAll() {
    setExpandedLocations(visibleLocations.map((location) => location.id));
  }

  function sendChat(prompt?: string) {
    const text = (prompt ?? chatInput).trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      { from: "user", text },
      { from: "assistant", text: getSupportReply(text) },
    ]);
    setChatInput("");
    setChatOpen(true);
  }

  async function handleAddLocation(draft: AddLocationDraft) {
    const createResponse = await fetch("/api/restaurants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: getScopedAccountId(),
        address: draft.address,
        creatorEmail: effectiveSession?.email ?? null,
        locationName: draft.name,
        managerId: effectiveSession?.managerId ?? null,
        sentryState: {
          completed: false,
          ium: "--",
          lastCertified: "Pending",
          locationId: draft.locId.trim() || undefined,
          m01Score: 0,
          m02Score: 0,
          modules: [
            ...(draft.m01
              ? [{ label: "M01", score: 0, note: `${draft.processor} schema and contract config still pending seal.` }]
              : []),
            ...(draft.m02
              ? [{ label: "M02", score: 0, note: `${draft.dsps.join(", ")} evidence package still being configured.` }]
              : []),
            {
              label: "Evidence",
              score: 0,
              note: "Onboarding started. WGS review and first upload cycle are pending.",
            },
          ],
          onboardingChecklist: onboardingState,
          onboardingProgress: createWgsOnboardingProgress(),
          recoveryDisplay: "$0",
          status: "Onboarding",
        },
        unitId: draft.locId.trim() || null,
      }),
    });

    if (!createResponse.ok) {
      const payload = (await createResponse.json().catch(() => null)) as { error?: string } | null;
      showToast(payload?.error ?? "Unable to create the restaurant record.");
      return;
    }

    const payload = (await createResponse.json()) as {
      restaurant?: {
        address?: string | null;
        id: number;
        locationId?: string | null;
        name: string;
        unitId?: string | null;
      };
    };
    const createdRestaurant = payload.restaurant;
    const locationId =
      createdRestaurant?.locationId?.trim() ||
      createdRestaurant?.unitId?.trim() ||
      draft.locId.trim() ||
      `LOC-DB-${createdRestaurant?.id ?? Date.now()}`;
    const location = {
      accountId: getScopedAccountId(),
      id: locationId,
      name: createdRestaurant?.name?.trim() || draft.name,
      market: createdRestaurant?.address?.trim() || draft.address || "New market",
      ownerEmail: effectiveSession?.email ?? undefined,
      ownerManagerId: effectiveSession?.managerId ?? null,
      m01: 0,
      m02: 0,
      ium: "--",
      recovery: "$0",
      status: "Onboarding" as const,
      lastCertified: "Pending",
      modules: [
        ...(draft.m01
          ? [{ label: "M01", score: 0, note: `${draft.processor} schema and contract config still pending seal.` }]
          : []),
        ...(draft.m02
          ? [{ label: "M02", score: 0, note: `${draft.dsps.join(", ")} evidence package still being configured.` }]
          : []),
        {
          label: "Evidence",
          score: 0,
          note: "Onboarding started. WGS review and first upload cycle are pending.",
        },
      ],
    };

    upsertRuntimeLocation(location);
    setWgsOnboardingState((current) => ({
      ...current,
      [location.id]: createWgsOnboardingProgress(),
    }));
    void syncAssignedRestaurants();
    setShowAddLocation(false);
    setActiveViewOverride("onboarding");
    setActiveOnboardingLocation(location.id);
    void persistLocationState(location, {
      onboardingChecklist: onboardingState,
      onboardingProgress: createWgsOnboardingProgress(),
    });
    appendLog({
      accountId: location.accountId,
      action: `Location added for onboarding: ${location.name}`,
      immutable: false,
      location: location.name,
    });
    showToast(`${draft.name} added. WGS onboarding plan created.`);
  }

  async function processArtifactFileUpload(
    target: ActiveArtifactState,
    file: File,
    vendor?: { key: string; name: string },
  ): Promise<UploadReceipt> {
    const formData = new FormData();
    formData.set("artifactKey", target.artifact.key);
    formData.set("file", file);
    formData.set("locationId", target.locationId);
    formData.set("moduleId", target.moduleId);
    if (vendor?.key ?? target.vendorKey) {
      formData.set("vendorKey", vendor?.key ?? target.vendorKey ?? "");
    }
    if (vendor?.name ?? target.vendorName) {
      formData.set("vendorName", vendor?.name ?? target.vendorName ?? "");
    }

    const response = await fetch("/api/v1/uploads", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; upload?: PersistedUploadRecord }
      | null;

    if (!response.ok || !payload?.upload) {
      const message = payload?.error ?? "Upload failed.";
      showToast(message);
      throw new Error(message);
    }

    const { receipt } = applyPersistedUpload(payload.upload, target.accountId);
    appendLog({
      accountId: target.accountId,
      action: `${target.artifact.label} uploaded into ${target.moduleId}`,
      immutable: true,
      location: target.locationName,
    });
    setUploadFeedback(receipt);
    showToast(`${receipt.fileName} uploaded and stored.`);
    return receipt;
  }

  async function persistLocationState(
    location: (typeof locations)[number],
    options?: {
      onboardingChecklist?: Record<string, boolean[]>;
      onboardingProgress?: WgsOnboardingProgress;
    },
  ) {
    if (locationStatePersistenceStatusRef.current === "missing-table") {
      return;
    }

    try {
      const response = await fetch("/api/location-states", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: location.accountId,
          completed: options?.onboardingProgress?.completed ?? location.status !== "Onboarding",
          createdBy: effectiveSession?.managerId ?? location.ownerManagerId ?? null,
          ium: location.ium,
          lastCertified: location.lastCertified,
          locationId: location.id,
          m01Score: location.m01,
          m02Score: location.m02,
          modules: location.modules,
          onboardingChecklist: options?.onboardingChecklist ?? onboardingState,
          onboardingProgress: options?.onboardingProgress ?? null,
          recoveryDisplay: location.recovery,
          status: location.status,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 503) {
          locationStatePersistenceStatusRef.current = "missing-table";
          showToast(
            payload?.error ??
              "Location-state persistence is disabled until the database migration is applied.",
          );
          return;
        }
        showToast(payload?.error ?? "Location state save failed.");
        return;
      }

      locationStatePersistenceStatusRef.current = "available";
    } catch {
      showToast("Location state save failed.");
    }
  }

  async function handleArtifactFileSelected(file: File) {
    if (!activeArtifact) return;
    await processArtifactFileUpload(activeArtifact, file);
  }

  async function handleDirectArtifactUpload(
    moduleId: "M01" | "M02",
    artifactKey: string,
    file: File,
    vendor?: { key: string; name: string },
  ): Promise<UploadReceipt | null> {
    const targetLocation = activeUploadLocation ?? visibleLocations[0];
    const uploadModule = targetLocation
      ? resolveUploadModulesForAccount(targetLocation.accountId).find((item) => item.id === moduleId)
      : null;
    const artifact = uploadModule?.artifacts.find((item) => item.key === artifactKey);
    if (!uploadModule || !artifact || !targetLocation) return null;

    const target = {
      accountId: uploadModule.accountId,
      artifact,
      locationId: targetLocation.id,
      locationName: targetLocation.name,
      moduleId,
      vendorKey: vendor?.key,
      vendorName: vendor?.name,
    };
    setActiveArtifact(target);
    return processArtifactFileUpload(target, file, vendor);
  }

  function handleArtifactAction(
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendor?: { key: string; name: string },
    entryMode?: "manual" | "upload",
  ) {
    const targetLocation = activeUploadLocation ?? visibleLocations[0];
    const uploadModule = targetLocation
      ? resolveUploadModulesForAccount(targetLocation.accountId).find((item) => item.id === moduleId)
      : null;
    const artifact = uploadModule?.artifacts.find((item) => item.key === artifactKey);
    if (!uploadModule || !artifact || !targetLocation) return;
    setActiveArtifact({
      accountId: uploadModule.accountId,
      artifact,
      entryMode,
      locationId: targetLocation.id,
      locationName: targetLocation.name,
      moduleId,
      vendorKey: vendor?.key,
      vendorName: vendor?.name,
    });
  }

  function handleSaveWorkspace(workspace: SchemaWorkspace) {
    setSchemaState((current) =>
      current.map((item) =>
        item.account === workspace.account && item.module === workspace.module && item.vendor === workspace.vendor
          ? workspace
          : item,
      ),
    );
    setEditingWorkspace(null);
    showToast("Schema draft saved.");
  }

  function handleSealWorkspace(workspace: SchemaWorkspace) {
    const sealedBy = session?.email ?? "system";
    const sealedWorkspace: SchemaWorkspace = {
      ...workspace,
      vault: {
        ...workspace.vault,
        version: `${workspace.module.toLowerCase()}-v${Math.floor(Math.random() * 90) + 20}`,
        hash: `sha256:${Math.random().toString(16).slice(2, 14)}`,
        sealedBy,
        sealedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      },
      fields: workspace.fields.map((field) =>
        field.required ? { ...field, confidence: "Verified" } : field,
      ),
    };
    handleSaveWorkspace(sealedWorkspace);
    appendLog({
      accountId: workspace.accountId,
      action: `${workspace.module} ${workspace.vendor} contract config sealed to vault`,
      immutable: true,
      location: workspace.account,
    });
    showToast("Workspace sealed to vault.");
  }

  function handleToggleChecklist(stepId: string, itemIndex: number) {
    setOnboardingState((current) => {
      const next = {
        ...current,
        [stepId]: current[stepId].map((item, index) => (index === itemIndex ? !item : item)),
      };
      const targetLocationId = activeOnboardingLocation ?? activeUploadLocation?.id ?? visibleLocations[0]?.id;
      const targetLocation = targetLocationId
        ? runtimeLocationState.find((item) => item.id === targetLocationId)
        : null;
      if (targetLocation) {
        void persistLocationState(targetLocation, {
          onboardingChecklist: next,
          onboardingProgress: wgsOnboardingState[targetLocation.id],
        });
      }
      return next;
    });
  }

  function handleResolveQueue(ticketId: string) {
    const ticket = wgsQueueState.find((item) => item.id === ticketId);
    setWgsQueueState((current) => current.filter((item) => item.id !== ticketId));
    if (ticket) {
      appendLog({
        accountId: wgsAccountState.find((account) => account.name === ticket.account)?.id ?? "C001",
        action: `Support ticket resolved: ${ticket.issue}`,
        immutable: false,
        location: ticket.account,
      });
    }
    showToast(`Ticket ${ticketId} marked resolved.`);
  }

  function handleApprove(approvalId: string) {
    const approval = wgsApprovalState.find((item) => item.id === approvalId);
    setWgsApprovalState((current) => current.filter((item) => item.id !== approvalId));
    if (approval) {
      appendLog({
        accountId: wgsAccountState.find((account) => account.name === approval.account)?.id ?? "C001",
        action: `Approval completed: ${approval.type}`,
        immutable: false,
        location: approval.account,
      });
    }
    showToast(`Approval ${approvalId} completed.`);
  }

  function handleSaveWgsUser(user: WgsUser) {
    const isNew = user.id === "new";
    const resolvedUser = isNew
      ? {
          ...user,
          id: `U${String(wgsUserState.length + 1).padStart(3, "0")}`,
          lastLogin: "Pending setup",
        }
      : user;
    setWgsUserState((current) =>
      isNew
        ? [...current, resolvedUser]
        : current.map((item) => (item.id === resolvedUser.id ? resolvedUser : item)),
    );
    setEditingWgsUser(null);
    setCreatingWgsUser(false);
    appendLog({
      accountId: getScopedAccountId(),
      action: isNew
        ? `WGS user created: ${resolvedUser.firstName} ${resolvedUser.lastName}`
        : `WGS user updated: ${resolvedUser.firstName} ${resolvedUser.lastName}`,
      immutable: false,
      location: "WGS Admin",
    });
    showToast(isNew ? `Setup email sent to ${resolvedUser.email}.` : "WGS user updated.");
  }

  function handleProgressArtifactWorkflow() {
    if (!activeArtifact) return;
    const key = getArtifactStateKey(
      activeArtifact.accountId,
      activeArtifact.locationId,
      activeArtifact.moduleId,
      activeArtifact.artifact.key,
      activeArtifact.vendorKey,
    );
    const current =
      artifactIntakeState[key] ?? {
        uploaded: false,
        hash: false,
        schema: false,
        fields: false,
      };

    let next: IntakeState;
    const manualValues = artifactContractState[key] ?? {};
    const usingManualMode =
      activeArtifact.artifact.type === "Manual Entry" || manualValues.__entry_mode === "manual";

    if (usingManualMode) {
      const providedValues = Object.entries(manualValues).filter(
        ([fieldKey, fieldValue]) => fieldKey !== "__entry_mode" && Boolean(fieldValue),
      ).length;
      const requiredSatisfied = providedValues >= 3;
      const metrics = extractManualMetrics(activeArtifact.artifact.key, manualValues);
      next = {
        ...current,
        uploaded: true,
        hash: requiredSatisfied,
        schema: requiredSatisfied,
        fields: requiredSatisfied,
        fileName:
          current.fileName ??
          `${activeArtifact.locationName} ${activeArtifact.artifact.label} Manual Entry`,
        metrics,
        rows:
          current.rows ??
          Math.max(metrics.orderCount ?? 0, metrics.transactionCount ?? 0, providedValues),
        updatedAt: new Date().toISOString(),
      };
    } else {
      if (!current.uploaded) {
        showToast("Upload the source file first before advancing intake checks.");
        return;
      }
      next = current.hash
        ? current.schema
          ? {
              ...current,
              fields: true,
              updatedAt: new Date().toISOString(),
            }
          : {
              ...current,
              schema: true,
              updatedAt: new Date().toISOString(),
            }
        : {
            ...current,
            hash: true,
            updatedAt: new Date().toISOString(),
          };
    }

    setArtifactIntakeState((state) => ({ ...state, [key]: next }));

    const isReady = next.uploaded && next.hash && next.schema && next.fields;
    setUploadState((currentState) =>
      currentState.map((module) =>
        module.accountId === activeArtifact.accountId && module.id === activeArtifact.moduleId
          ? {
              ...module,
              artifacts: module.artifacts.map((artifact) =>
                artifact.key === activeArtifact.artifact.key
                  ? {
                      ...artifact,
                      status: isReady ? "Ready" : "Needs Review",
                      note: isReady
                        ? "All intake checks complete. Artifact is ready for certification."
                        : "Intake checks are in progress. Continue validation before certification.",
                    }
                  : artifact,
              ),
            }
          : module,
      ),
    );
    appendLog({
      accountId: activeArtifact.accountId,
      action: `${activeArtifact.artifact.label} intake advanced in ${activeArtifact.moduleId}`,
      immutable: isReady,
      location: activeArtifact.locationName,
    });
  }

  function handleArtifactContractFieldChange(fieldId: string, value: string) {
    if (!activeArtifact) return;
    const key = getArtifactStateKey(
      activeArtifact.accountId,
      activeArtifact.locationId,
      activeArtifact.moduleId,
      activeArtifact.artifact.key,
      activeArtifact.vendorKey,
    );
    setArtifactContractState((state) => ({
      ...state,
      [key]: {
        ...(state[key] ?? {}),
        [fieldId]: value,
      },
    }));
  }

  function handleEnterSupportMode(accountId: string) {
    const account = wgsAccountState.find((item) => item.id === accountId);
    setSupportMode({
      active: true,
      accountId,
      accountName: account?.name ?? accountId,
    });
    setActiveViewOverride("dashboard");
    showToast(`Support Mode enabled for ${account?.name ?? accountId}.`);
  }

  function handleOpenOnboarding(locationId: string) {
    setWgsOnboardingState((current) => ({
      ...current,
      [locationId]: current[locationId] ?? createWgsOnboardingProgress(),
    }));
    setActiveOnboardingLocation(locationId);
  }

  function handleOnboardingProgressChange(locationId: string, next: WgsOnboardingProgress) {
    setWgsOnboardingState((current) => ({
      ...current,
      [locationId]: next,
    }));
    const location = runtimeLocationState.find((item) => item.id === locationId);
    if (location) {
      void persistLocationState(location, {
        onboardingChecklist: onboardingState,
        onboardingProgress: next,
      });
    }
  }

function handleCompleteOnboarding(locationId: string) {
    const location = runtimeLocationState.find((item) => item.id === locationId);
    const progress = wgsOnboardingState[locationId];
    if (!location || !progress) return;

    const uploadCount = Object.keys(progress.uploads).length;
    updateRuntimeLocation(locationId, (item) => ({
      ...item,
      status: Math.round((item.m01 + item.m02) / 2) >= 85 ? "Certified" : "At Risk",
      lastCertified: new Date().toISOString().slice(0, 10),
      modules: item.modules.map((module) =>
        module.label === "Evidence"
          ? {
              ...module,
              score: Math.min(92, 60 + uploadCount * 6),
              note: `${uploadCount} onboarding uploads captured. WGS activation workflow completed and ready for ongoing certification.`,
            }
          : module,
      ),
    }));
    setWgsOnboardingState((current) => ({
      ...current,
      [locationId]: {
        ...progress,
        completed: true,
      },
    }));
    const completedProgress = {
      ...progress,
      completed: true,
    };
    const completedStatus: "Certified" | "At Risk" =
      Math.round((location.m01 + location.m02) / 2) >= 85 ? "Certified" : "At Risk";
    setActiveOnboardingLocation(null);
    const persistedLocation = {
      ...location,
      lastCertified: new Date().toISOString().slice(0, 10),
      modules: location.modules.map((module) =>
        module.label === "Evidence"
          ? {
              ...module,
              score: Math.min(92, 60 + uploadCount * 6),
              note: `${uploadCount} onboarding uploads captured. WGS activation workflow completed and ready for ongoing certification.`,
            }
          : module,
      ),
      status: completedStatus,
    };
    void persistLocationState(persistedLocation, {
      onboardingChecklist: onboardingState,
      onboardingProgress: completedProgress,
    });
    appendLog({
      accountId: location.accountId,
      action: `${location.name} onboarding completed and marked live`,
      immutable: false,
      location: location.name,
    });
    showToast(`${location.name} onboarding complete.`);
  }

  function handleSendPasswordReset(userId: string, email: string) {
    appendLog({
      accountId: getScopedAccountId(),
      action: `Password reset link sent to ${email}`,
      immutable: false,
      location: "WGS Admin",
    });
    showToast(`Reset link sent to ${email}.`);
  }

  function handleDeactivateWgsUser(userId: string) {
    const user = wgsUserState.find((item) => item.id === userId);
    if (!user) return;
    setWgsUserState((current) =>
      current.map((item) => (item.id === userId ? { ...item, status: "Inactive" } : item)),
    );
    setEditingWgsUser(null);
    appendLog({
      accountId: getScopedAccountId(),
      action: `WGS account deactivated: ${user.firstName} ${user.lastName}`,
      immutable: false,
      location: "WGS Admin",
    });
    showToast(`${user.firstName} ${user.lastName} deactivated.`);
  }

  function handleGenerateClaimPack(record: CaarRecord) {
    appendLog({
      accountId: record.accountId,
      action: `Claim pack generated for ${record.id}`,
      immutable: true,
      location: record.locationName,
    });
    showToast(`Claim pack generated for ${record.id}.`);
  }

  function handleRequestAccess(draft: RequestAccessDraft) {
    const nextId = `APR-${String(wgsApprovalState.length + 20).padStart(3, "0")}`;
    const scopeDetails = [
      draft.locations ? `${draft.locations} locations` : null,
      draft.processors.length > 0 ? `processors: ${draft.processors.join(", ")}` : null,
      draft.dsps.length > 0 ? `DSPs: ${draft.dsps.join(", ")}` : null,
      draft.monthlyVolume ? `volume: ${draft.monthlyVolume}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    setWgsApprovalState((current) => [
      {
        id: nextId,
        account: draft.company,
        type: "Access Request",
        summary: `${draft.name || draft.email} requested ${draft.modules.join(" + ")} via ${draft.modulePlan}.${scopeDetails ? ` ${scopeDetails}.` : ""}`,
      },
      ...current,
    ]);
    appendLog({
      accountId: getScopedAccountId(),
      action: `Request access submitted for ${draft.company}`,
      immutable: false,
      location: "Landing",
      user: draft.email,
    });
    setShowRequestAccess(false);
    showToast("Access request submitted for WGS review.");
  }

  function handleCreateSupportTicket(text: string) {
    const message = text.trim();
    if (!message) {
      showToast("Add a support message before creating a ticket.");
      return;
    }
    const accountName = getScopedAccountName();
    setWgsQueueState((current) => [
      {
        id: `TCK-${String(current.length + 400).padStart(3, "0")}`,
        account: accountName,
        issue: message,
        priority:
          message.toLowerCase().includes("trust score") || message.toLowerCase().includes("failed")
            ? "High"
            : "Medium",
        age: "Now",
      },
      ...current,
    ]);
    appendLog({
      accountId: getScopedAccountId(),
      action: `Support ticket created: ${message}`,
      immutable: false,
      location: accountName,
    });
    showToast("Support ticket added to the WGS queue.");
  }

  function handleRunCertification(locationId: string) {
    const location = runtimeLocationState.find((item) => item.id === locationId);
    if (!location) return;

    const certification = buildCertificationResult({
      artifactContractState,
      artifactIntakeState,
      location,
      uploadModules: resolveUploadModulesForAccount(location.accountId),
    });

    updateRuntimeLocation(locationId, (item) => ({
      ...item,
      lastCertified: new Date().toISOString().slice(0, 10),
      m01: certification.updatedModules.find((module) => module.label === "M01")?.score ?? item.m01,
      m02: certification.updatedModules.find((module) => module.label === "M02")?.score ?? item.m02,
      modules: certification.updatedModules,
      recovery: certification.updatedRecovery,
      status: certification.status,
    }));
    setCaarState((current) => [
      certification.record,
      ...current.filter((item) => item.locationId !== locationId),
    ]);
    appendLog({
      accountId: location.accountId,
      action: `Certification completed for ${location.name}`,
      immutable: true,
      location: location.name,
    });
    setActiveCertification({
      locationId,
      locationName: location.name,
      ready: certification.ready,
      steps: certification.steps,
      trustScore: certification.trustScore,
    });

    const updatedLocation = {
      ...location,
      lastCertified: new Date().toISOString().slice(0, 10),
      m01: certification.updatedModules.find((module) => module.label === "M01")?.score ?? location.m01,
      m02: certification.updatedModules.find((module) => module.label === "M02")?.score ?? location.m02,
      modules: certification.updatedModules,
      recovery: certification.updatedRecovery,
      status: certification.status,
    };
    void persistLocationState(updatedLocation, {
      onboardingChecklist: onboardingState,
      onboardingProgress: wgsOnboardingState[location.id],
    });
    void persistCaarReport(certification.record, location.accountId);
  }

  async function persistCaarReport(record: CaarRecord, accountId: string) {
    try {
      const response = await fetch("/api/caars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId,
          managerId: effectiveSession?.managerId ?? null,
          record,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast(payload?.error ?? "CAAR saved locally, but database save failed.");
        return;
      }

      await syncAssignedCaars();
      showToast(`${record.id} saved to the database.`);
    } catch {
      showToast("CAAR saved locally, but database save failed.");
    }
  }

  if (!effectiveSession) {
    return (
      <>
        <LandingPage onLogin={handleLogin} onRequestAccess={() => setShowRequestAccess(true)} />
        {showRequestAccess ? (
          <RequestAccessModal
            onClose={() => setShowRequestAccess(false)}
            onSubmit={handleRequestAccess}
          />
        ) : null}
        {toast ? <Toast message={toast} /> : null}
      </>
    );
  }

  const meta = viewMeta[activeView];

  const activeOnboardingRecord =
    (activeOnboardingLocation
      ? runtimeLocationState.find((item) => item.id === activeOnboardingLocation)
      : null) ?? null;

  const activeArtifactStateKey = activeArtifact
    ? getArtifactStateKey(
        activeArtifact.accountId,
        activeArtifact.locationId,
        activeArtifact.moduleId,
        activeArtifact.artifact.key,
        activeArtifact.vendorKey,
      )
    : null;
  const activeChecklistStateKey = activeChecklist
    ? getArtifactStateKey(
        activeChecklist.accountId,
        activeChecklist.locationId,
        activeChecklist.moduleId,
        activeChecklist.artifact.key,
        activeChecklist.vendorKey,
      )
    : null;
  const scopedUploadModules =
    activeUploadLocation?.accountId
      ? resolveUploadModulesForAccount(activeUploadLocation.accountId)
      : visibleUploadModules;

  return (
    <>
      <SentryShell
        activeView={activeView}
        meta={meta}
        navGroups={navigation}
        onExitSupportMode={() => setSupportMode({ active: false, accountId: null, accountName: null })}
        onOpenSupport={() => setChatOpen(true)}
        onRunPrimaryCertification={() => {
          const primaryLocation = visibleLocations[0];
          if (primaryLocation) handleRunCertification(primaryLocation.id);
        }}
        onSignOut={handleSignOut}
        onViewChange={handleViewChange}
        session={effectiveSession}
        supportMode={supportMode}
        visibleLocationCount={visibleLocations.length}
      >
        <SentryViewRouter
          accounts={wgsAccountState}
          activeView={activeView}
          activeUploadLocationId={activeUploadLocation?.id ?? visibleLocations[0]?.id ?? null}
          activeUploadLocationName={activeUploadLocation?.name ?? visibleLocations[0]?.name ?? null}
          approvals={wgsApprovalState}
          averageTrust={averageTrust}
          artifactContractState={artifactContractState}
          artifactIntakeState={artifactIntakeState}
          caars={visibleCaars}
          completed={onboardingState}
          expandedLocations={expandedLocations}
          faqOpen={faqOpen}
          faqQuery={faqQuery}
          filteredFaq={filteredFaq}
          filteredLogs={filteredLogs}
          locations={visibleLocations}
          logFilter={logFilter}
          onAddLocation={() => setShowAddLocation(true)}
          onAddUser={() => {
            setCreatingWgsUser(true);
            setEditingWgsUser(null);
          }}
          onApprove={handleApprove}
          onArtifactAction={handleArtifactAction}
          onDirectUpload={handleDirectArtifactUpload}
          onEnterSupportMode={handleEnterSupportMode}
          onExpandAll={handleExpandAll}
          onFilterChange={setLogFilter}
          onOpenCaar={setSelectedCaar}
          onOpenOnboarding={handleOpenOnboarding}
          onOpenSchemaEditor={setEditingWorkspace}
          onOpenUploads={handleOpenLocationUploads}
          onOpenUser={setEditingWgsUser}
          onQueryChange={setFaqQuery}
          onResolveQueue={handleResolveQueue}
          onRunCertification={handleRunCertification}
          onSealWorkspace={handleSealWorkspace}
          onToggleChecklist={handleToggleChecklist}
          onToggleLocation={toggleLocation}
          onToggleQuestion={(question) => setFaqOpen((current) => (current === question ? null : question))}
          onViewChange={handleViewChange}
          queue={wgsQueueState}
          role={effectiveSession.role}
          schemaWorkspaces={visibleSchemaWorkspaces}
          session={effectiveSession}
          totalCaars={totalCaars}
          totalRecovery={totalRecovery}
          uploadFeedback={uploadFeedback}
          uploadModules={scopedUploadModules}
          users={wgsUserState}
        />
      </SentryShell>

      <SupportChat
        chatInput={chatInput}
        chatOpen={chatOpen}
        messages={messages}
        onClose={() => setChatOpen(false)}
        onCreateTicket={() => handleCreateSupportTicket(chatInput)}
        onInputChange={setChatInput}
        onSend={sendChat}
        onToggle={() => setChatOpen((current) => !current)}
      />

      {showAddLocation ? (
        <AddLocationModal
          initialDraft={emptyAddLocationDraft}
          onClose={() => setShowAddLocation(false)}
          onSubmit={handleAddLocation}
        />
      ) : null}

      {activeArtifact && activeArtifactStateKey ? (
        <ArtifactWorkflowModal
          artifact={activeArtifact.artifact}
          contractValues={artifactContractState[activeArtifactStateKey] ?? {}}
          defaultEntryMode={activeArtifact.entryMode}
          intake={
            artifactIntakeState[activeArtifactStateKey] ?? {
              uploaded: false,
              hash: false,
              schema: false,
              fields: false,
            }
          }
          moduleId={activeArtifact.moduleId}
          onClose={() => setActiveArtifact(null)}
          onFieldChange={handleArtifactContractFieldChange}
          onFileSelected={handleArtifactFileSelected}
          onProgressIntake={handleProgressArtifactWorkflow}
          vendorName={activeArtifact.vendorName}
        />
      ) : null}

      {activeChecklist && activeChecklistStateKey ? (
        <UploadChecklistModal
          artifact={activeChecklist.artifact}
          intake={
            artifactIntakeState[activeChecklistStateKey] ?? {
              uploaded: false,
              hash: false,
              schema: false,
              fields: false,
            }
          }
          moduleId={activeChecklist.moduleId}
          onClose={() => setActiveChecklist(null)}
          vendorName={activeChecklist.vendorName}
        />
      ) : null}

      {editingWorkspace ? (
        <SchemaEditorModal
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onSave={handleSaveWorkspace}
          onSeal={handleSealWorkspace}
        />
      ) : null}

      {editingWgsUser || creatingWgsUser ? (
        <WgsUserModal
          accounts={wgsAccountState}
          user={creatingWgsUser ? null : editingWgsUser}
          onClose={() => {
            setEditingWgsUser(null);
            setCreatingWgsUser(false);
          }}
          onDeactivate={handleDeactivateWgsUser}
          onSave={handleSaveWgsUser}
          onSendReset={handleSendPasswordReset}
        />
      ) : null}

      {selectedCaar ? (
        <CaarReportModal
          artifactIntakeState={artifactIntakeState}
          onClose={() => setSelectedCaar(null)}
          onGenerateClaimPack={handleGenerateClaimPack}
          record={selectedCaar}
          uploadModules={scopedUploadModules}
        />
      ) : null}

      {activeCertification ? (
        <CertificationRunModal
          locationName={activeCertification.locationName}
          onClose={() => setActiveCertification(null)}
          openCaar={() => {
            const record = caarState.find((item) => item.locationId === activeCertification.locationId);
            if (record) setSelectedCaar(record);
            setActiveCertification(null);
          }}
          ready={activeCertification.ready}
          steps={activeCertification.steps}
          trustScore={activeCertification.trustScore}
        />
      ) : null}

      {activeOnboardingLocation && activeOnboardingRecord ? (
        <WgsOnboardingWizard
          location={activeOnboardingRecord}
          onChange={(next) => handleOnboardingProgressChange(activeOnboardingLocation, next)}
          onClose={() => setActiveOnboardingLocation(null)}
          onComplete={() => handleCompleteOnboarding(activeOnboardingLocation)}
          progress={wgsOnboardingState[activeOnboardingLocation] ?? createWgsOnboardingProgress()}
        />
      ) : null}

      {toast ? <Toast message={toast} /> : null}
    </>
  );
}

function mapAssignedRestaurantsToLocations(
  restaurants: DatabaseRestaurant[],
  session: SessionState,
) {
  if (restaurants.length === 0) {
    return [];
  }

  return restaurants
    .filter((restaurant) => restaurant.name.trim().length > 0)
    .map((restaurant) => {
      const market = getRestaurantMarket(restaurant);
      const locationId =
        restaurant.sentry_state?.location_id?.trim() ||
        restaurant.unit_id?.trim() ||
        restaurant.store_id?.trim() ||
        `LOC-DB-${restaurant.id}`;
      const modules = parseStoredModules(restaurant.sentry_state?.modules_json);
      const status = toLocationStatus(restaurant.sentry_state?.status);

      return {
        accountId: restaurant.sentry_state?.account_id || (
          session.role === "WGS Manager"
            ? `mgr:${restaurant.created_by ?? restaurant.id}`
            : session.accountId ?? `mgr:${session.email.toLowerCase()}`
        ),
        id: locationId,
        name: restaurant.name,
        market,
        ownerEmail: session.role === "WGS Manager" ? undefined : session.email,
        ownerManagerId: restaurant.sentry_state?.created_by ?? restaurant.created_by,
        m01: restaurant.sentry_state?.m01_score ?? 0,
        m02: restaurant.sentry_state?.m02_score ?? 0,
        ium: restaurant.sentry_state?.ium ?? "--",
        recovery: restaurant.sentry_state?.recovery_display ?? "$0",
        status,
        lastCertified: restaurant.sentry_state?.last_certified ?? "Pending",
        modules:
          modules.length > 0
            ? modules
            : [
                {
                  label: "Evidence",
                  score: 0,
                  note: "Assigned from admin. Onboarding, uploads, and first certification are still pending.",
                },
              ],
      };
    });
}

function extractOnboardingState(restaurants: DatabaseRestaurant[]) {
  return restaurants.reduce<Record<string, WgsOnboardingProgress>>((accumulator, restaurant) => {
    const locationId =
      restaurant.sentry_state?.location_id?.trim() ||
      restaurant.unit_id?.trim() ||
      restaurant.store_id?.trim() ||
      `LOC-DB-${restaurant.id}`;
    const progress = parseOnboardingProgress(restaurant.sentry_state?.onboarding_progress);
    if (progress) {
      accumulator[locationId] = progress;
    }
    return accumulator;
  }, {});
}

function extractOnboardingChecklist(restaurants: DatabaseRestaurant[]) {
  for (const restaurant of restaurants) {
    const raw = restaurant.sentry_state?.onboarding_checklist;
    if (raw && typeof raw === "object") {
      return raw as Record<string, boolean[]>;
    }
  }
  return null;
}

function parseStoredModules(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { label: string; note: string; score: number } =>
        typeof item === "object" &&
        item !== null &&
        "label" in item &&
        "note" in item &&
        "score" in item,
    )
    .map((item) => ({
      label: String(item.label),
      note: String(item.note),
      score: Number(item.score) || 0,
    }));
}

function parseOnboardingProgress(value: unknown): WgsOnboardingProgress | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<WgsOnboardingProgress>;
  return {
    checks:
      raw.checks && typeof raw.checks === "object"
        ? raw.checks
        : {},
    completed: Boolean(raw.completed),
    selectedVendors: {
      m01: Array.isArray(raw.selectedVendors?.m01) ? raw.selectedVendors.m01 : [],
      m02: Array.isArray(raw.selectedVendors?.m02) ? raw.selectedVendors.m02 : [],
    },
    stepIndex: typeof raw.stepIndex === "number" ? raw.stepIndex : 0,
    uploads:
      raw.uploads && typeof raw.uploads === "object"
        ? raw.uploads
        : {},
  };
}

function toLocationStatus(value: string | undefined): "Certified" | "At Risk" | "Onboarding" {
  if (value === "Certified" || value === "At Risk" || value === "Onboarding") {
    return value;
  }
  return "Onboarding" as const;
}

function getRestaurantMarket(restaurant: Pick<DatabaseRestaurant, "city" | "country" | "location" | "state">) {
  return (
    [restaurant.city, restaurant.state].filter(Boolean).join(", ") ||
    restaurant.location?.trim() ||
    restaurant.country?.trim() ||
    "New market"
  );
}
