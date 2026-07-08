"use client";

import {
  useCallback,
  useMemo,
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { navigation, viewMeta } from "./config";
import {
  emptyAddLocationDraft,
  faqItems,
  initialMessages,
  schemaWorkspaces,
  uploadModules,
  wgsM01Vendors,
  wgsM02Vendors,
} from "./data";
import {
  extractManualMetrics,
} from "./caar-engine";
import { useSentryDerivedState } from "./hooks/useSentryDerivedState";
import { useSentryPersistence } from "./hooks/useSentryPersistence";
import { AddLocationModal } from "./overlays/AddLocationModal";
import { ArtifactWorkflowModal } from "./overlays/ArtifactWorkflowModal";
import { CertificationCadenceModal } from "./overlays/CertificationCadenceModal";
import { CertificationRunModal } from "./overlays/CertificationRunModal";
import { CaarReportModal } from "./overlays/CaarReportModal";
import { RequestAccessModal } from "./overlays/RequestAccessModal";
import { SchemaEditorModal } from "./overlays/SchemaEditorModal";
import { SupportChat } from "./overlays/SupportChat";
import { Toast } from "./overlays/Toast";
import { UploadChecklistModal } from "./overlays/UploadChecklistModal";
import { WorkflowBlockerModal } from "./overlays/WorkflowBlockerModal";
import { WgsOnboardingWizard } from "./overlays/WgsOnboardingWizard";
import { WgsUserModal } from "./overlays/WgsUserModal";
import { SentryShell } from "./SentryShell";
import { SentryViewRouter } from "./SentryViewRouter";
import type {
  AddLocationDraft,
  CaarRecord,
  ChatMessage,
  IntakeState,
  LocationRecord,
  LocationSourceConfig,
  LocationWorkflowState,
  LogRecord,
  RequestAccessDraft,
  SchemaWorkspace,
  SessionState,
  SupportModeState,
  PermissionRecord,
  UploadArtifact,
  UploadModule,
  UploadReceipt,
  ViewId,
  WgsAccount,
  WgsApproval,
  WgsOnboardingProgress,
  WgsQueueItem,
  WgsUser,
} from "./types";
import { getSupportReply } from "./utils";
import { resolveVendorKey, resolveVendorSelections } from "./vendor-catalog";
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
  cadence: "monthly_final" | "weekly_preliminary";
  locationId: string;
  locationName: string;
  ready: boolean;
  steps: { detail: string; done: boolean; label: string }[];
  trustScore: number;
};

type PendingCertificationRequest = {
  locationId: string;
  locationName: string;
  locations?: { id: string; name: string }[];
};

type CertificationBlockerState = {
  blockers: string[];
  locationId: string;
  locationName: string;
  primaryAction: LocationWorkflowState["primaryAction"];
  primaryLabel: string;
  requirements: LocationWorkflowState["requirements"];
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
    governance_initialized_at: string | null;
    governance_sealed_at: string | null;
    governance_status: string;
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

type PersistedCertificationResponse = {
  certification?: {
    cadence?: "monthly_final" | "weekly_preliminary";
    ready: boolean;
    record: CaarRecord;
    status: "Certified" | "At Risk" | "Onboarding";
    steps: { detail: string; done: boolean; label: string }[];
    trustScore: number;
    updatedModules: { label: string; note: string; score: number }[];
    updatedRecovery: string;
  };
  location?: {
    id: string;
    lastCertified: string;
    m01: number;
    m02: number;
    modules: { label: string; note: string; score: number }[];
    recovery: string;
    status: "Certified" | "At Risk" | "Onboarding";
  };
};

type PersistedWorkspaceRecord = SchemaWorkspace;
type PersistedSupportTicket = WgsQueueItem;
type PersistedAccessRequest = WgsApproval;
type PersistedActivityLog = LogRecord;

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

  const [caarState, setCaarState] = useState<CaarRecord[]>([]);
  const [locationState, setLocationState] = useState<LocationRecord[]>([]);
  const [assignedLocationState, setAssignedLocationState] = useState<LocationRecord[]>([]);
  const [logState, setLogState] = useState<LogRecord[]>([]);
  const [uploadState, setUploadState] = useState<UploadModule[]>(
    uploadModules.filter((module) => module.accountId === BASE_UPLOAD_TEMPLATE_ACCOUNT_ID),
  );
  const [schemaState, setSchemaState] = useState<SchemaWorkspace[]>([]);
  const [wgsAccountState] = useState<WgsAccount[]>([]);
  const [wgsQueueState, setWgsQueueState] = useState<WgsQueueItem[]>([]);
  const [wgsApprovalState, setWgsApprovalState] = useState<WgsApproval[]>([]);
  const [wgsUserState, setWgsUserState] = useState<WgsUser[]>([]);
  const [wgsOnboardingState, setWgsOnboardingState] = useState<Record<string, WgsOnboardingProgress>>({});
  const [onboardingState, setOnboardingState] = useState<Record<string, boolean[]>>({
    account: [false, false, false],
    vendors: [false, false, false],
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
  const [pendingCertificationRequest, setPendingCertificationRequest] = useState<PendingCertificationRequest | null>(null);
  const [certificationBlocker, setCertificationBlocker] = useState<CertificationBlockerState | null>(null);
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
  const [addLocationInitialDraft, setAddLocationInitialDraft] =
    useState<AddLocationDraft>(emptyAddLocationDraft);

  const effectiveSession = session;
  const activeView = activeViewOverride ?? (effectiveSession?.role === "WGS Manager" ? "wgs" : "dashboard");
  const runtimeLocationState = effectiveSession
    ? applyLifecycleNotesToLocations({
        artifactContractState,
        artifactIntakeState,
        locations: assignedLocationState,
        schemaState,
        uploadState,
      })
    : locationState;

  const deferredFaqQuery = useDeferredValue(faqQuery);
  const permissionRecords = useMemo<PermissionRecord[]>(() => {
    if (!effectiveSession) {
      return [];
    }

    const visibleScope =
      effectiveSession.role === "WGS Manager" || effectiveSession.role === "SuperAdmin"
        ? "Governed support and portfolio-wide visibility"
        : `${runtimeLocationState.length} visible location${runtimeLocationState.length === 1 ? "" : "s"}`;

    return [
      {
        email: effectiveSession.email,
        lastSeen: "Current session",
        name: effectiveSession.name?.trim() || effectiveSession.email,
        role: effectiveSession.role,
        scope: visibleScope,
      },
    ];
  }, [effectiveSession, runtimeLocationState.length]);
  const workflowByLocation = useMemo(
    () =>
      Object.fromEntries(
        runtimeLocationState.map((location) => [
          location.id,
          deriveLocationWorkflowState({
            artifactIntakeState,
            location,
            schemaState,
            uploadState,
          }),
        ]),
      ) as Record<string, LocationWorkflowState>,
    [artifactIntakeState, runtimeLocationState, schemaState, uploadState],
  );

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

  const applyPersistedWorkspace = useCallback((workspace: PersistedWorkspaceRecord) => {
    let nextSchemaSnapshot: PersistedWorkspaceRecord[] = [];

    setSchemaState((current) => {
      const next = [...current];
      const index = next.findIndex(
        (item) =>
          item.accountId === workspace.accountId &&
          item.locationId === workspace.locationId &&
          item.module === workspace.module &&
          item.vendor === workspace.vendor,
      );
      if (index === -1) {
        next.push(workspace);
      } else {
        next[index] = workspace;
      }
      nextSchemaSnapshot = next;
      return next;
    });

    if (workspace.locationId) {
      const contractKey = getArtifactStateKey(
        workspace.accountId,
        workspace.locationId,
        workspace.module,
        workspace.module === "M01" ? "m01-contract" : "m02-contract",
      );

      const nextContractValues =
        workspace.module === "M01"
          ? mapM01WorkspaceContractToArtifactValues(workspace)
          : mapM02WorkspaceContractToArtifactValues(workspace);

      setArtifactContractState((current) => ({
        ...current,
        [contractKey]: nextContractValues,
      }));
    }
    if (workspace.locationId) {
      setAssignedLocationState((current) =>
        current.map((location) => {
          if (location.id !== workspace.locationId) {
            return location;
          }

          const activeGovernedModules = location.modules
            .map((module) => module.label)
            .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");
          const sealedModules = new Set(
            nextSchemaSnapshot
              .filter(
                (item) =>
                  item.locationId === workspace.locationId &&
                  (item.status === "sealed" || item.vault.state === "sealed"),
              )
              .map((item) => item.module),
          );
          if (workspace.status === "sealed" || workspace.vault.state === "sealed") {
            sealedModules.add(workspace.module);
          }

          const governanceStatus =
            activeGovernedModules.length > 0 && activeGovernedModules.every((module) => sealedModules.has(module))
              ? "sealed"
              : "draft";
          const now = new Date().toISOString();

          return {
            ...location,
            governanceInitializedAt: location.governanceInitializedAt ?? now,
            governanceSealedAt:
              governanceStatus === "sealed"
                ? now
                : location.governanceSealedAt,
            governanceStatus,
            modules: location.modules.map((module) =>
              module.label === workspace.module
                ? {
                    ...module,
                    note:
                      workspace.status === "sealed" || workspace.vault.state === "sealed"
                        ? `${workspace.vendor} governance sealed. Continue with required evidence uploads for certification.`
                        : `${workspace.vendor} governance draft saved. Review mappings and seal when ready.`,
                  }
                : module,
            ),
          };
        }),
      );
    }
  }, []);

  const syncGovernanceWorkspaces = useCallback(async function syncWorkspaces(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    const response = await fetch("/api/v1/governance/workspaces", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      workspaces?: PersistedWorkspaceRecord[];
    };

    const persistedWorkspaces = payload.workspaces ?? [];
    if (persistedWorkspaces.length === 0) {
      return;
    }

    for (const workspace of persistedWorkspaces) {
      applyPersistedWorkspace(workspace);
    }
  }, [applyPersistedWorkspace, effectiveSession, persistenceHydrated]);

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

  const syncSupportTickets = useCallback(async function syncTickets(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    if (
      sessionState.role !== "WGS Manager" &&
      sessionState.role !== "SuperAdmin" &&
      sessionState.role !== "Admin"
    ) {
      return;
    }

    const response = await fetch("/api/v1/support/tickets", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      tickets?: PersistedSupportTicket[];
    };

    setWgsQueueState(payload.tickets ?? []);
  }, [effectiveSession, persistenceHydrated]);

  const syncAccessRequests = useCallback(async function syncRequests(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    if (
      sessionState.role !== "WGS Manager" &&
      sessionState.role !== "SuperAdmin" &&
      sessionState.role !== "Admin"
    ) {
      return;
    }

    const response = await fetch("/api/v1/access-requests", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      requests?: PersistedAccessRequest[];
    };

    setWgsApprovalState(payload.requests ?? []);
  }, [effectiveSession, persistenceHydrated]);

  const syncAuditLogs = useCallback(async function syncLogs(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    const response = await fetch("/api/v1/activity-log", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      logs?: PersistedActivityLog[];
    };

    setLogState(payload.logs ?? []);
  }, [effectiveSession, persistenceHydrated]);

  useEffect(() => {
    if (!effectiveSession || !persistenceHydrated) return;

    let cancelled = false;

    async function run() {
      const sessionState = effectiveSession;
      if (!sessionState) {
        return;
      }
      await syncAssignedRestaurants(sessionState);
      await Promise.all([
        syncAssignedCaars(sessionState),
        syncPersistedUploads(sessionState),
        syncGovernanceWorkspaces(sessionState),
        syncSupportTickets(sessionState),
        syncAccessRequests(sessionState),
        syncAuditLogs(sessionState),
      ]);

      if (cancelled) return;
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveSession,
    persistenceHydrated,
    syncAssignedCaars,
    syncAssignedRestaurants,
    syncAuditLogs,
    syncAccessRequests,
    syncGovernanceWorkspaces,
    syncPersistedUploads,
    syncSupportTickets,
  ]);

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

  function upsertRuntimeLocation(nextLocation: LocationRecord) {
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
    updater: (location: LocationRecord) => LocationRecord,
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

  function getUploadTargetLocation() {
    return activeUploadLocation
      ? visibleLocations.find((item) => item.id === activeUploadLocation.id) ?? visibleLocations[0] ?? null
      : visibleLocations[0] ?? null;
  }

  function getLocationSourceConfig(locationId: string): LocationSourceConfig | null {
    const location = runtimeLocationState.find((item) => item.id === locationId);
    if (!location) {
      return null;
    }

    const progress = wgsOnboardingState[locationId];
    const activeLabels = new Set(location.modules.map((module) => module.label));

    return {
      m01Enabled: activeLabels.has("M01"),
      m01Vendors: resolveVendorSelections("M01", progress?.selectedVendors.m01 ?? []),
      m02Enabled: activeLabels.has("M02"),
      m02Vendors: resolveVendorSelections("M02", progress?.selectedVendors.m02 ?? []),
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

  async function recordClientActivity(args: {
    accountId?: string;
    action: string;
    entityId?: string;
    entityType?: string;
    immutable?: boolean;
    locationId?: string;
    locationName?: string;
    summary: string;
  }) {
    appendLog({
      accountId: args.accountId ?? getScopedAccountId(),
      action: args.summary,
      immutable: Boolean(args.immutable),
      location: args.locationName ?? "Portfolio",
      user: effectiveSession?.name?.trim() || effectiveSession?.email || "system",
    });

    await fetch("/api/v1/activity-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: args.accountId ?? getScopedAccountId(),
        action: args.action,
        entityId: args.entityId,
        entityType: args.entityType ?? "ui_event",
        immutable: Boolean(args.immutable),
        locationId: args.locationId,
        locationName: args.locationName,
        summary: args.summary,
      }),
    }).catch(() => null);

    void syncAuditLogs();
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
      setCertificationBlocker(null);
      setActiveUploadLocation(null);
      setUploadFeedback(null);
      setAssignedLocationState([]);
      setSupportMode({ active: false, accountId: null, accountName: null });
    });
  }

  function handleViewChange(view: ViewId) {
    startTransition(() => setActiveViewOverride(view));
  }

  async function handleOpenAddLocation() {
    let nextDraft = emptyAddLocationDraft;

    try {
      const response = await fetch("/api/v1/access-requests/bootstrap", {
        cache: "no-store",
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          request?: {
            dsps?: string[];
            m01?: boolean;
            m02?: boolean;
            processor?: string;
          } | null;
        };

        if (payload.request) {
          nextDraft = {
            ...emptyAddLocationDraft,
            dsps: payload.request.dsps?.length ? payload.request.dsps : [],
            m01: payload.request.m01 ?? false,
            m02: payload.request.m02 ?? false,
            processor: payload.request.processor?.trim() || emptyAddLocationDraft.processor,
          };
        }
      }
    } catch {
      // Leave the standard draft in place if bootstrap prefill cannot be loaded.
    }

    setAddLocationInitialDraft(nextDraft);
    setShowAddLocation(true);
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

  function handleOpenDiy() {
    startTransition(() => setActiveViewOverride("diy"));
  }

  function handleCompleteUploadSet(locationId: string) {
    const location = visibleLocations.find((item) => item.id === locationId);
    if (!location) {
      return;
    }

    void recordClientActivity({
      action: "location_upload_set_completed",
      entityId: location.id,
      entityType: "location_upload_set",
      immutable: false,
      locationId: location.id,
      locationName: location.name,
      summary: `Completed upload intake for ${location.name}.`,
    });
    setActiveUploadLocation(null);
    startTransition(() => setActiveViewOverride("waterfall"));
    showToast(`Upload set saved for ${location.name}.`);
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
          governanceStatus: "uninitialized",
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
          onboardingProgress: {
            ...createWgsOnboardingProgress(),
            selectedVendors: {
              m01: draft.m01 && draft.processor ? [resolveVendorKey("M01", draft.processor)] : [],
              m02: draft.m02 ? draft.dsps.map((dsp) => resolveVendorKey("M02", dsp)) : [],
            },
          },
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
      governanceInitializedAt: null,
      governanceSealedAt: null,
      governanceStatus: "uninitialized" as const,
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
      [location.id]: {
        ...createWgsOnboardingProgress(),
        selectedVendors: {
          m01: draft.m01 && draft.processor ? [resolveVendorKey("M01", draft.processor)] : [],
          m02: draft.m02 ? draft.dsps.map((dsp) => resolveVendorKey("M02", dsp)) : [],
        },
      },
    }));
    void syncAssignedRestaurants();
    setShowAddLocation(false);
    setActiveViewOverride("onboarding");
    setActiveOnboardingLocation(location.id);
    void persistLocationState(location, {
      onboardingChecklist: onboardingState,
      onboardingProgress: {
        ...createWgsOnboardingProgress(),
        selectedVendors: {
          m01: draft.m01 && draft.processor ? [resolveVendorKey("M01", draft.processor)] : [],
          m02: draft.m02 ? draft.dsps.map((dsp) => resolveVendorKey("M02", dsp)) : [],
        },
      },
    });
    void syncAuditLogs();
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
    void syncAuditLogs();
    setUploadFeedback(receipt);
    showToast(`${receipt.fileName} uploaded and stored.`);
    return receipt;
  }

  async function persistLocationState(
    location: LocationRecord,
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
          governanceInitializedAt: location.governanceInitializedAt ?? null,
          governanceSealedAt: location.governanceSealedAt ?? null,
          governanceStatus: location.governanceStatus ?? "uninitialized",
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

  async function persistWorkspace(workspace: SchemaWorkspace, action: "draft" | "seal") {
    const response = await fetch("/api/v1/governance/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        workspace,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; workspace?: PersistedWorkspaceRecord }
      | null;

    if (!response.ok || !payload?.workspace) {
      showToast(payload?.error ?? "Unable to save the governance workspace.");
      return null;
    }

    applyPersistedWorkspace(payload.workspace);
    setEditingWorkspace(null);
    return payload.workspace;
  }

  async function handleSaveWorkspace(workspace: SchemaWorkspace) {
    const savedWorkspace = await persistWorkspace(workspace, "draft");
    if (!savedWorkspace) {
      return;
    }
    void recordClientActivity({
      accountId: savedWorkspace.accountId,
      action: "governance_workspace_saved",
      entityId: `${savedWorkspace.module}:${savedWorkspace.vendor}:${savedWorkspace.locationId ?? "global"}`,
      entityType: "schema_registry_v2",
      immutable: false,
      locationId: savedWorkspace.locationId,
      locationName: savedWorkspace.locationName ?? savedWorkspace.account,
      summary: `${savedWorkspace.module} ${savedWorkspace.vendor} draft saved for ${savedWorkspace.locationName ?? savedWorkspace.account}.`,
    });
    await Promise.all([syncAssignedRestaurants(), syncGovernanceWorkspaces(), syncAuditLogs()]);
    showToast("Schema draft saved.");
  }

  async function handleSealWorkspace(workspace: SchemaWorkspace) {
    const sealedWorkspace = await persistWorkspace(workspace, "seal");
    if (!sealedWorkspace) {
      return;
    }
    void recordClientActivity({
      accountId: sealedWorkspace.accountId,
      action: "governance_workspace_sealed_client",
      entityId: `${sealedWorkspace.module}:${sealedWorkspace.vendor}:${sealedWorkspace.locationId ?? "global"}:${sealedWorkspace.vault.version}`,
      entityType: "contract_configs_v2",
      immutable: true,
      locationId: sealedWorkspace.locationId,
      locationName: sealedWorkspace.locationName ?? sealedWorkspace.account,
      summary: `${sealedWorkspace.module} ${sealedWorkspace.vendor} sealed for ${sealedWorkspace.locationName ?? sealedWorkspace.account}.`,
    });
    await Promise.all([syncAssignedRestaurants(), syncGovernanceWorkspaces(), syncAuditLogs()]);
    showToast("Workspace sealed to vault.");
  }

  function handleInitializeWorkspace(
    locationId: string,
    module: "M01" | "M02",
    vendor?: string,
  ) {
    const location = runtimeLocationState.find((item) => item.id === locationId);
    if (!location) {
      showToast("Select a valid location before creating a schema workspace.");
      return;
    }

    const vendorName =
      vendor ??
      (module === "M01" ? wgsM01Vendors[0]?.name : wgsM02Vendors[0]?.name) ??
      (module === "M01" ? "Heartland" : "DoorDash");
    const template =
      schemaWorkspaces.find((workspace) => workspace.module === module && workspace.vendor === vendorName) ??
      schemaWorkspaces.find((workspace) => workspace.module === module);

    if (!template) {
      showToast(`No ${module} template is available to initialize the workspace.`);
      return;
    }

    setEditingWorkspace({
      account: location.name,
      accountId: location.accountId,
      contract: template.contract.map((field) => ({
        ...field,
        source:
          field.source.includes("agreement") || field.source.includes("Signed")
            ? field.source
            : "Pending signed source document",
        value: field.value,
      })),
      fields: template.fields.map((field) => ({
        ...field,
        confidence: field.required ? "Needs Review" : field.confidence,
      })),
      locationId: location.id,
      locationName: location.name,
      module,
      status: "draft",
      vault: {
        hash: "pending",
        sealedAt: "Pending",
        sealedBy: effectiveSession?.email ?? "system",
        state: "draft",
        version: `${module.toLowerCase()}-draft`,
      },
      vendor: vendorName,
    });
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

  async function handleResolveQueue(ticketId: string) {
    const response = await fetch(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      showToast(payload?.error ?? `Unable to resolve ticket ${ticketId}.`);
      return;
    }

    setWgsQueueState((current) => current.filter((item) => item.id !== ticketId));
    void syncAuditLogs();
    showToast(`Ticket ${ticketId} marked resolved.`);
  }

  async function handleApprove(approvalId: string) {
    const response = await fetch(`/api/v1/access-requests/${encodeURIComponent(approvalId)}`, {
      method: "PATCH",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      showToast(payload?.error ?? `Unable to review approval ${approvalId}.`);
      return;
    }

    setWgsApprovalState((current) => current.filter((item) => item.id !== approvalId));
    void syncAuditLogs();
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
    void recordClientActivity({
      action: isNew ? "wgs_user_created" : "wgs_user_updated",
      entityId: resolvedUser.id,
      entityType: "wgs_user",
      immutable: false,
      locationName: "WGS Admin",
      summary: isNew
        ? `WGS user created: ${resolvedUser.firstName} ${resolvedUser.lastName}`
        : `WGS user updated: ${resolvedUser.firstName} ${resolvedUser.lastName}`,
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
      activeArtifact.artifact.type === "Manual Entry" ||
      activeArtifact.entryMode === "manual" ||
      manualValues.__entry_mode === "manual";

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
    void recordClientActivity({
      accountId: activeArtifact.accountId,
      action: "artifact_intake_advanced",
      entityId: `${activeArtifact.moduleId}:${activeArtifact.artifact.key}:${activeArtifact.locationId}`,
      entityType: "artifact_intake",
      immutable: isReady,
      locationId: activeArtifact.locationId,
      locationName: activeArtifact.locationName,
      summary: `${activeArtifact.artifact.label} intake advanced in ${activeArtifact.moduleId}.`,
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
    void recordClientActivity({
      accountId,
      action: "support_mode_enabled",
      entityId: accountId,
      entityType: "support_mode",
      immutable: false,
      locationName: "Portfolio",
      summary: `Support Mode enabled for ${account?.name ?? accountId}.`,
    });
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

  function handleManageUploadSources(next: {
    m01Enabled: boolean;
    m01Vendors: string[];
    m02Enabled: boolean;
    m02Vendors: string[];
  }) {
    const targetLocation = getUploadTargetLocation();
    if (!targetLocation) {
      return;
    }

    const currentProgress = wgsOnboardingState[targetLocation.id] ?? createWgsOnboardingProgress();
    const nextProgress: WgsOnboardingProgress = {
      ...currentProgress,
      selectedVendors: {
        m01: next.m01Enabled ? next.m01Vendors : [],
        m02: next.m02Enabled ? next.m02Vendors : [],
      },
    };

    const evidenceModule =
      targetLocation.modules.find((module) => module.label === "Evidence") ?? {
        label: "Evidence",
        note: "Onboarding started. WGS review and first upload cycle are pending.",
        score: 0,
      };
    const existingM01 = targetLocation.modules.find((module) => module.label === "M01");
    const existingM02 = targetLocation.modules.find((module) => module.label === "M02");
    const m01Names = resolveVendorSelections("M01", next.m01Vendors).map((vendor) => vendor.name);
    const m02Names = resolveVendorSelections("M02", next.m02Vendors).map((vendor) => vendor.name);

    const updatedLocation: LocationRecord = {
      ...targetLocation,
      modules: [
        ...(next.m01Enabled
          ? [
              existingM01 ?? {
                label: "M01",
                note: `${m01Names.join(", ") || "Selected processor"} schema and contract config still pending seal.`,
                score: 0,
              },
            ]
          : []),
        ...(next.m02Enabled
          ? [
              existingM02 ?? {
                label: "M02",
                note: `${m02Names.join(", ") || "Selected DSPs"} evidence package still being configured.`,
                score: 0,
              },
            ]
          : []),
        evidenceModule,
      ],
    };

    setWgsOnboardingState((current) => ({
      ...current,
      [targetLocation.id]: nextProgress,
    }));
    updateRuntimeLocation(targetLocation.id, () => updatedLocation);
    void persistLocationState(updatedLocation, {
      onboardingChecklist: onboardingState,
      onboardingProgress: nextProgress,
    });
    void syncAssignedRestaurants();
    showToast("Active source settings updated.");
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
    void recordClientActivity({
      accountId: location.accountId,
      action: "location_onboarding_completed",
      entityId: location.id,
      entityType: "location_onboarding",
      immutable: false,
      locationId: location.id,
      locationName: location.name,
      summary: `${location.name} onboarding completed and marked live.`,
    });
    showToast(`${location.name} onboarding complete.`);
  }

  function handleSendPasswordReset(userId: string, email: string) {
    void recordClientActivity({
      action: "wgs_user_password_reset_requested",
      entityId: userId,
      entityType: "wgs_user",
      immutable: false,
      locationName: "WGS Admin",
      summary: `Password reset link sent to ${email}.`,
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
    void recordClientActivity({
      action: "wgs_user_deactivated",
      entityId: userId,
      entityType: "wgs_user",
      immutable: false,
      locationName: "WGS Admin",
      summary: `WGS account deactivated: ${user.firstName} ${user.lastName}.`,
    });
    showToast(`${user.firstName} ${user.lastName} deactivated.`);
  }

  function handleDownloadCaarPdf(record: CaarRecord) {
    window.open(
      `/api/v1/caars/download?caarId=${encodeURIComponent(record.id)}&artifact=pdf`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleDownloadClaimPack(record: CaarRecord) {
    window.open(
      `/api/v1/caars/download?caarId=${encodeURIComponent(record.id)}&artifact=exportpack`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function handleGenerateClaimPack(record: CaarRecord) {
    const response = await fetch("/api/v1/caars/claim-pack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        caarId: record.id,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { downloadUrl?: string; error?: string }
      | null;

    if (!response.ok) {
      showToast(payload?.error ?? `Unable to generate ExportPack for ${record.id}.`);
      return;
    }

    void recordClientActivity({
      accountId: record.accountId,
      action: "caar_exportpack_generated",
      entityId: record.id,
      entityType: "caars_v2",
      immutable: true,
      locationId: record.locationId,
      locationName: record.locationName,
      summary: `ExportPack generated for ${record.id}.`,
    });
    showToast(`ExportPack generated for ${record.id}.`);
    if (payload?.downloadUrl) {
      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } else {
      handleDownloadClaimPack(record);
    }
  }

  async function handleRequestAccess(draft: RequestAccessDraft) {
    const response = await fetch("/api/v1/access-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: draft.company,
        dsps: draft.dsps,
        email: draft.email,
        locations: draft.locations,
        modulePlan: draft.modulePlan,
        modules: draft.modules,
        monthlyVolume: draft.monthlyVolume,
        name: draft.name,
        notes: draft.notes,
        phone: draft.phone,
        processors: draft.processors,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; request?: PersistedAccessRequest }
      | null;

    if (!response.ok) {
      showToast(payload?.error ?? "Unable to submit access request.");
      return;
    }

    if (payload?.request && effectiveSession?.role === "WGS Manager") {
      setWgsApprovalState((current) => [payload.request!, ...current]);
    }
    void syncAuditLogs();
    setShowRequestAccess(false);
    showToast("Access request submitted for WGS review.");
  }

  async function handleCreateSupportTicket(text: string) {
    const message = text.trim();
    if (!message) {
      showToast("Add a support message before creating a ticket.");
      return;
    }
    const accountName = getScopedAccountName();
    const response = await fetch("/api/v1/support/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: getScopedAccountId(),
        accountName,
        issue: message,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; ticket?: PersistedSupportTicket }
      | null;

    if (!response.ok) {
      showToast(payload?.error ?? "Unable to create support ticket right now.");
      return;
    }

    if (payload?.ticket && (effectiveSession?.role === "WGS Manager" || effectiveSession?.role === "SuperAdmin" || effectiveSession?.role === "Admin")) {
      setWgsQueueState((current) => [payload.ticket!, ...current]);
    }
    void syncAuditLogs();
    showToast("Support ticket added to the WGS queue.");
  }

  function handleRunCertification(locationId: string) {
    const location = runtimeLocationState.find((item) => item.id === locationId);
    if (!location) return;
    const workflow = workflowByLocation[locationId];
    if (workflow && !workflow.readyForCertification) {
      setCertificationBlocker({
        blockers: workflow.blockers,
        locationId,
        locationName: location.name,
        primaryAction: workflow.primaryAction,
        primaryLabel: workflow.primaryLabel,
        requirements: workflow.requirements,
      });
      return;
    }
    setPendingCertificationRequest({
      locationId,
      locationName: location.name,
    });
  }

  async function executeRunCertification(cadence: "monthly_final" | "weekly_preliminary") {
    const request = pendingCertificationRequest;
    if (!request) return;
    const location = runtimeLocationState.find((item) => item.id === request.locationId);
    if (!location) return;
    setPendingCertificationRequest(null);

    const response = await fetch("/api/v1/certifications/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
          cadence,
          locationId: request.locationId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | ({ error?: string } & PersistedCertificationResponse)
      | null;

    if (!response.ok || !payload?.certification || !payload.location) {
      const workflow = workflowByLocation[request.locationId];
      if (response.status === 409) {
        setCertificationBlocker({
          blockers: parseCertificationBlockers(payload?.error, workflow),
          locationId: request.locationId,
          locationName: location.name,
          primaryAction: workflow?.primaryAction ?? "uploads",
          primaryLabel: workflow?.primaryLabel ?? "Open Upload Data",
          requirements: workflow?.requirements ?? [],
        });
        return;
      }
      showToast(payload?.error ?? "Unable to run certification right now.");
      return;
    }

    const { certification } = payload;

      updateRuntimeLocation(request.locationId, (item) => ({
        ...item,
        lastCertified: payload.location?.lastCertified ?? item.lastCertified,
      m01: payload.location?.m01 ?? item.m01,
      m02: payload.location?.m02 ?? item.m02,
      modules: payload.location?.modules ?? certification.updatedModules,
      recovery: payload.location?.recovery ?? certification.updatedRecovery,
      status: payload.location?.status ?? certification.status,
    }));
      setCaarState((current) => [
        certification.record,
        ...current.filter((item) => item.locationId !== request.locationId),
      ]);
      setActiveCertification({
        cadence: certification.cadence ?? cadence,
        locationId: request.locationId,
        locationName: location.name,
        ready: certification.ready,
        steps: certification.steps,
        trustScore: certification.trustScore,
      });
      await Promise.all([syncAssignedRestaurants(), syncAssignedCaars(), syncAuditLogs()]);
      showToast(
        cadence === "weekly_preliminary"
          ? `${certification.record.id} preliminary certification saved.`
          : `${certification.record.id} certified and saved.`,
      );
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
  const activeUploadSourceConfig = (() => {
    const targetLocationId = activeUploadLocation?.id ?? visibleLocations[0]?.id ?? null;
    return targetLocationId ? getLocationSourceConfig(targetLocationId) : null;
  })();
  const diyLocationSourceConfigs = Object.fromEntries(
    visibleLocations.map((location) => [location.id, getLocationSourceConfig(location.id)]),
  ) as Record<string, LocationSourceConfig>;
  const activeUploadModules = (() => {
    const targetLocationId = activeUploadLocation?.id ?? visibleLocations[0]?.id ?? null;
    const location = targetLocationId
      ? visibleLocations.find((item) => item.id === targetLocationId) ?? null
      : null;

    if (!location) {
      return [] as Array<"M01" | "M02">;
    }

    return location.modules
      .map((module) => module.label)
      .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");
  })();

  return (
    <>
      <SentryShell
        activeView={activeView}
        meta={meta}
        navGroups={navigation}
        onExitSupportMode={() => setSupportMode({ active: false, accountId: null, accountName: null })}
        onOpenSupport={() => setChatOpen(true)}
        onRunPrimaryCertification={() => {
          const selectableLocations = visibleLocations.map((location) => ({
            id: location.id,
            name: location.name,
          }));
          const primaryLocation = selectableLocations[0];
          if (!primaryLocation) {
            showToast("No location is available for certification.");
            return;
          }
          setPendingCertificationRequest({
            locationId: primaryLocation.id,
            locationName: primaryLocation.name,
            locations: selectableLocations,
          });
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
          activeUploadModules={activeUploadModules}
          activeUploadLocationName={activeUploadLocation?.name ?? visibleLocations[0]?.name ?? null}
          activeUploadSourceConfig={activeUploadSourceConfig}
          diyLocationSourceConfigs={diyLocationSourceConfigs}
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
          onAddLocation={handleOpenAddLocation}
          onAddUser={() => {
            setCreatingWgsUser(true);
            setEditingWgsUser(null);
          }}
          onApprove={handleApprove}
          onCompleteUploadSet={handleCompleteUploadSet}
          onManageUploadSources={handleManageUploadSources}
          onArtifactAction={handleArtifactAction}
          onDirectUpload={handleDirectArtifactUpload}
          onEnterSupportMode={handleEnterSupportMode}
          onExpandAll={handleExpandAll}
          onFilterChange={setLogFilter}
          onDownloadPdf={handleDownloadCaarPdf}
          onOpenCaar={setSelectedCaar}
          onOpenDiy={handleOpenDiy}
          onOpenOnboarding={handleOpenOnboarding}
          onOpenSchemaEditor={setEditingWorkspace}
          onOpenUploads={handleOpenLocationUploads}
          onOpenUser={setEditingWgsUser}
          onInitializeWorkspace={handleInitializeWorkspace}
          onQueryChange={setFaqQuery}
          onResolveQueue={handleResolveQueue}
          onRunCertification={handleRunCertification}
          onSealWorkspace={handleSealWorkspace}
          onToggleChecklist={handleToggleChecklist}
          onToggleLocation={toggleLocation}
          onToggleQuestion={(question) => setFaqOpen((current) => (current === question ? null : question))}
          onViewChange={handleViewChange}
          permissionRecords={permissionRecords}
          queue={wgsQueueState}
          role={effectiveSession.role}
          schemaWorkspaces={visibleSchemaWorkspaces}
          session={effectiveSession}
          totalCaars={totalCaars}
          totalRecovery={totalRecovery}
          uploadFeedback={uploadFeedback}
          uploadModules={scopedUploadModules}
          users={wgsUserState}
          workflowByLocation={workflowByLocation}
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
          initialDraft={addLocationInitialDraft}
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
          role={effectiveSession?.role ?? "Viewer"}
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
          onDownloadPdf={handleDownloadCaarPdf}
          onGenerateClaimPack={handleGenerateClaimPack}
          record={selectedCaar}
          uploadModules={scopedUploadModules}
        />
      ) : null}

      {pendingCertificationRequest ? (
        <CertificationCadenceModal
          locationId={pendingCertificationRequest.locationId}
          locations={pendingCertificationRequest.locations}
          locationName={pendingCertificationRequest.locationName}
          onChangeLocation={(locationId) => {
            const nextLocation =
              pendingCertificationRequest.locations?.find((location) => location.id === locationId) ?? null;
            if (!nextLocation) {
              return;
            }
            setPendingCertificationRequest((current) =>
              current
                ? {
                    ...current,
                    locationId: nextLocation.id,
                    locationName: nextLocation.name,
                  }
                : current,
            );
          }}
          onClose={() => setPendingCertificationRequest(null)}
          onSubmit={executeRunCertification}
        />
      ) : null}

      {activeCertification ? (
        <CertificationRunModal
          cadence={activeCertification.cadence}
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

      {certificationBlocker ? (
        <WorkflowBlockerModal
          blockers={certificationBlocker.blockers}
          locationName={certificationBlocker.locationName}
          onClose={() => setCertificationBlocker(null)}
          onOpenDiy={handleOpenDiy}
          onOpenOnboarding={() => handleOpenOnboarding(certificationBlocker.locationId)}
          onOpenUploads={() => handleOpenLocationUploads(certificationBlocker.locationId)}
          primaryAction={certificationBlocker.primaryAction}
          primaryLabel={certificationBlocker.primaryLabel}
          requirements={certificationBlocker.requirements}
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
        governanceInitializedAt: restaurant.sentry_state?.governance_initialized_at ?? null,
        governanceSealedAt: restaurant.sentry_state?.governance_sealed_at ?? null,
        governanceStatus: toGovernanceStatus(restaurant.sentry_state?.governance_status),
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
                  note: defaultEvidenceLifecycleNote(
                    toGovernanceStatus(restaurant.sentry_state?.governance_status),
                  ),
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

function toGovernanceStatus(value: string | undefined): "uninitialized" | "draft" | "sealed" {
  if (value === "draft" || value === "sealed") {
    return value;
  }

  return "uninitialized";
}

function defaultEvidenceLifecycleNote(status: "uninitialized" | "draft" | "sealed") {
  if (status === "sealed") {
    return "Governed setup is sealed. Upload the current certification-period evidence package to proceed.";
  }

  if (status === "draft") {
    return "Governance work is in progress. WGS must finish and seal the active Schema Registry and Contract Config.";
  }

  return "Governance has not been initialized yet. Start the WGS onboarding and schema setup workflow first.";
}

function getRestaurantMarket(restaurant: Pick<DatabaseRestaurant, "city" | "country" | "location" | "state">) {
  return (
    [restaurant.city, restaurant.state].filter(Boolean).join(", ") ||
    restaurant.location?.trim() ||
    restaurant.country?.trim() ||
    "New market"
  );
}

function mapM01WorkspaceContractToArtifactValues(workspace: SchemaWorkspace) {
  return {
    __entry_mode: "manual",
    contract_type: getContractValue(workspace.contract, "Pricing Model"),
    effective_date: getContractValue(workspace.contract, "Effective Date"),
    markup_bps: extractNumericValue(getContractValue(workspace.contract, "Processor Markup")),
    pricing_model: getContractValue(workspace.contract, "Pricing Model"),
    processor_name: workspace.vendor,
    txn_fee: extractNumericValue(getContractValue(workspace.contract, "Per Transaction Fee")),
  };
}

function mapM02WorkspaceContractToArtifactValues(workspace: SchemaWorkspace) {
  const rate = extractNumericValue(getContractValue(workspace.contract, "Commission Rate"));

  return {
    __entry_mode: "manual",
    commission_base: getContractValue(workspace.contract, "Commission Base"),
    delivery_active: "true",
    effective_date: getContractValue(workspace.contract, "Effective Date"),
    rate_catering: rate,
    rate_delivery: rate,
    rate_member: rate,
    rate_pickup: rate,
    rate_sponsored: rate,
    store_id: getContractValue(workspace.contract, "Restaurant UUID"),
  };
}

function getContractValue(contract: SchemaWorkspace["contract"], label: string) {
  return contract.find((field) => field.label === label)?.value?.trim() ?? "";
}

function extractNumericValue(value: string) {
  return value.replace(/[^0-9.-]/g, "");
}

function deriveLocationWorkflowState({
  artifactIntakeState,
  location,
  schemaState,
  uploadState,
}: {
  artifactIntakeState: Record<string, IntakeState>;
  location: LocationRecord;
  schemaState: SchemaWorkspace[];
  uploadState: UploadModule[];
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requirements: LocationWorkflowState["requirements"] = [];
  const activeModules = location.modules
    .map((module) => module.label)
    .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");

  if (location.status === "Onboarding") {
    blockers.push("Complete onboarding and activation for this location before certification can run.");
    requirements.push({
      action: "onboarding",
      detail: "Location setup, activation, and first-run enrollment must be completed first.",
      key: "onboarding",
      label: "Onboarding",
      status: "action_required",
    });
  } else {
    requirements.push({
      action: "onboarding",
      detail: "Location is active and past the initial onboarding gate.",
      key: "onboarding",
      label: "Onboarding",
      status: "complete",
    });
  }

  let schemaBlocked = false;
  let uploadBlocked = false;
  const governanceGaps: string[] = [];
  const evidenceGaps: string[] = [];

  for (const moduleId of activeModules) {
    const sealedWorkspace = schemaState.some(
      (workspace) =>
        workspace.accountId === location.accountId &&
        workspace.locationId === location.id &&
        workspace.module === moduleId &&
        (workspace.status === "sealed" || workspace.vault.state === "sealed"),
    );

    if (!sealedWorkspace) {
      schemaBlocked = true;
      const message = `${moduleId} schema registry and contract config must be sealed in DIY Access.`;
      blockers.push(message);
      governanceGaps.push(`${moduleId} schema + contract seal missing`);
    }

    const template = resolveModuleTemplate(uploadState, location.accountId, moduleId);
    const missingArtifacts = (template?.artifacts ?? [])
      .filter((artifact) => artifact.type !== "Manual Entry")
      .filter((artifact) =>
        !resolveLocationArtifactIntake(
          artifactIntakeState,
          location.accountId,
          location.id,
          moduleId,
          artifact.key,
        )?.uploaded,
      )
      .map((artifact) => artifact.label);

    if (missingArtifacts.length > 0) {
      uploadBlocked = true;
      const message = `${moduleId} evidence still missing: ${missingArtifacts.join(", ")}.`;
      blockers.push(message);
      evidenceGaps.push(`${moduleId}: ${missingArtifacts.join(", ")}`);
    }

    const latestArtifact = (template?.artifacts ?? [])
      .filter((artifact) => artifact.type !== "Manual Entry")
      .map((artifact) =>
        resolveLocationArtifactIntake(
          artifactIntakeState,
          location.accountId,
          location.id,
          moduleId,
          artifact.key,
        ),
      )
      .filter((artifact): artifact is IntakeState => Boolean(artifact))
      .sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")))[0];

    if (latestArtifact?.updatedAt && isStaleArtifactDate(latestArtifact.updatedAt)) {
      warnings.push(`${moduleId} uploads are older than 31 days. Upload the current period evidence before rerun.`);
    }
  }

  requirements.push({
    action: "diy",
    detail:
      activeModules.length === 0
        ? "No governed M01/M02 module is active for this location yet."
        : governanceGaps.length === 0
          ? `All active module workspaces are sealed: ${activeModules.join(", ")}.`
          : governanceGaps.join(" | "),
    key: "governance",
    label: "Governance Seal",
    status:
      activeModules.length === 0 ? "not_applicable" : governanceGaps.length === 0 ? "complete" : "action_required",
  });
  requirements.push({
    action: "uploads",
    detail:
      activeModules.length === 0
        ? "Evidence uploads are not required until a governed module is enabled."
        : evidenceGaps.length === 0
          ? `All required uploads are present for ${activeModules.join(", ")}.`
          : evidenceGaps.join(" | "),
    key: "evidence",
    label: "Evidence Uploads",
    status:
      activeModules.length === 0 ? "not_applicable" : evidenceGaps.length === 0 ? "complete" : "action_required",
  });

  const readyForCertification = blockers.length === 0;
  const primaryAction = location.status === "Onboarding"
    ? "onboarding"
    : schemaBlocked
      ? "diy"
      : uploadBlocked
        ? "uploads"
        : "certification";

  const primaryLabel =
    primaryAction === "onboarding"
      ? "Continue Onboarding"
      : primaryAction === "diy"
        ? "Seal Schema Workspace"
        : primaryAction === "uploads"
          ? "Upload Missing Evidence"
          : "Run Certification";

  return {
    blockers,
    primaryAction,
    primaryLabel,
    readyForCertification,
    requirements,
    warnings,
  } satisfies LocationWorkflowState;
}

function parseCertificationBlockers(
  message: string | undefined,
  workflow: LocationWorkflowState | undefined,
) {
  if (message?.startsWith("Certification cannot run yet:")) {
    return message
      .replace("Certification cannot run yet:", "")
      .replace(/\.$/, "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return workflow?.blockers.length ? workflow.blockers : ["Complete the remaining certification prerequisites first."];
}

function applyLifecycleNotesToLocations({
  artifactContractState,
  artifactIntakeState,
  locations,
  schemaState,
  uploadState,
}: {
  artifactContractState: Record<string, Record<string, string>>;
  artifactIntakeState: Record<string, IntakeState>;
  locations: LocationRecord[];
  schemaState: SchemaWorkspace[];
  uploadState: UploadModule[];
}) {
  let changed = false;

  const next = locations.map((location) => {
    let locationChanged = false;
    const activeModules = location.modules
      .map((module) => module.label)
      .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");

    if (activeModules.length === 0) {
      return location;
    }

    const moduleNotes = new Map<string, { note: string; score: number }>();
    const overallMissing: string[] = [];
    const staleItems: string[] = [];

    for (const moduleId of activeModules) {
      const moduleTemplate = resolveModuleTemplate(uploadState, location.accountId, moduleId);
      const moduleMissing: string[] = [];
      let latestUpdatedAt: string | undefined;

      for (const artifact of moduleTemplate?.artifacts ?? []) {
        if (artifact.type === "Manual Entry") {
          const manualKey = `${location.accountId}:${location.id}:${moduleId}:${artifact.key}:global`;
          const hasManual = Boolean(artifactContractState[manualKey]);
          if (!hasManual) {
            moduleMissing.push(readableArtifactLabel(artifact.key));
          }
          continue;
        }

        const intake = resolveLocationArtifactIntake(
          artifactIntakeState,
          location.accountId,
          location.id,
          moduleId,
          artifact.key,
        );
        if (!intake?.uploaded) {
          moduleMissing.push(readableArtifactLabel(artifact.key));
        } else if (intake.updatedAt && (!latestUpdatedAt || intake.updatedAt > latestUpdatedAt)) {
          latestUpdatedAt = intake.updatedAt;
        }
      }

      const governedWorkspaces = schemaState.filter(
        (workspace) =>
          workspace.accountId === location.accountId &&
          workspace.locationId === location.id &&
          workspace.module === moduleId &&
          workspace.status === "sealed",
      );

      if (governedWorkspaces.length === 0) {
        moduleMissing.push(`${moduleId} schema + contract seal`);
      }

      if (latestUpdatedAt && isStaleArtifactDate(latestUpdatedAt)) {
        staleItems.push(`${moduleId} evidence is older than 31 days`);
      }

      const note =
        moduleMissing.length === 0
          ? latestUpdatedAt && isStaleArtifactDate(latestUpdatedAt)
            ? `${moduleId} setup is sealed, but the evidence set is stale and needs a current rerun package.`
            : `${moduleId} setup is sealed and the current period evidence package is ready for rerun.`
          : `${moduleId} rerun blocked by missing ${moduleMissing.join(", ")}.`;

      moduleNotes.set(moduleId, {
        note,
        score: moduleMissing.length === 0 ? (latestUpdatedAt && isStaleArtifactDate(latestUpdatedAt) ? 74 : 92) : Math.max(35, 100 - moduleMissing.length * 18),
      });
      overallMissing.push(...moduleMissing.map((item) => `${moduleId}: ${item}`));
    }

    const evidenceNote =
      overallMissing.length === 0
        ? staleItems.length === 0
          ? "Static setup is sealed. Only current-period source files are needed for the next certification rerun."
          : `Static setup is sealed. ${staleItems.join("; ")}. Upload only the new period files before rerun.`
        : `Static setup is retained. Missing rerun prerequisites: ${overallMissing.join("; ")}.`;
    const evidenceScore =
      overallMissing.length === 0
        ? staleItems.length === 0
          ? 96
          : 78
        : Math.max(30, 95 - overallMissing.length * 10);

    const nextModules = location.modules.map((module) => {
      if (module.label === "Evidence") {
        if (module.note !== evidenceNote || module.score !== evidenceScore) {
          changed = true;
          locationChanged = true;
          return {
            ...module,
            note: evidenceNote,
            score: evidenceScore,
          };
        }
        return module;
      }

      const nextState = moduleNotes.get(module.label);
      if (!nextState) return module;
      if (module.note !== nextState.note || module.score !== nextState.score) {
        changed = true;
        locationChanged = true;
        return {
          ...module,
          note: nextState.note,
          score: nextState.score,
        };
      }
      return module;
    });

    return locationChanged ? { ...location, modules: nextModules } : location;
  });

  return changed ? next : locations;
}

function resolveModuleTemplate(
  modules: UploadModule[],
  accountId: string,
  moduleId: "M01" | "M02",
) {
  return (
    modules.find((module) => module.accountId === accountId && module.id === moduleId) ??
    modules.find((module) => module.accountId === "C001" && module.id === moduleId)
  );
}

function resolveLocationArtifactIntake(
  state: Record<string, IntakeState>,
  accountId: string,
  locationId: string,
  moduleId: "M01" | "M02",
  artifactKey: string,
) {
  const prefix = `${accountId}:${locationId}:${moduleId}:${artifactKey}:`;
  const matches = Object.entries(state)
    .filter(([key, value]) => key.startsWith(prefix) && value.uploaded)
    .map(([, value]) => value)
    .sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")));
  return matches[0] ?? null;
}

function readableArtifactLabel(key: string) {
  return key
    .replace(/^m0[12]-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isStaleArtifactDate(value: string) {
  const ageMs = Date.now() - new Date(value).getTime();
  return ageMs > 31 * 24 * 60 * 60 * 1000;
}
