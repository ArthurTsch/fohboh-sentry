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
import { getNavigationForRole, viewMeta } from "./config";
import {
  emptyAddLocationDraft,
  faqItems,
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
import { CertificationProgressModal } from "./overlays/CertificationProgressModal";
import { CertificationRunModal } from "./overlays/CertificationRunModal";
import { CaarReportModal } from "./overlays/CaarReportModal";
import { RequestAccessModal } from "./overlays/RequestAccessModal";
import { SchemaEditorModal } from "./overlays/SchemaEditorModal";
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
  WgsOnboardingUpload,
  WgsQueueItem,
  WgsUser,
} from "./types";
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
  caarId: string;
  locationId: string;
  locationName: string;
  ready: boolean;
  steps: { detail: string; done: boolean; label: string }[];
  trustScore: number;
};

type CertificationProgressState = {
  cadence: "monthly_final" | "weekly_preliminary";
  certificationMonth: string;
  locationName: string;
  moduleId: "M01" | "M02";
  phase: "preparing" | "certifying" | "applying" | "refreshing";
};

type PendingCertificationRequest = {
  locationId: string;
  locationName: string;
  locations?: { id: string; name: string }[];
  selectedModules: Array<"M01" | "M02">;
  selectedVendorKey?: string;
  selectableModules: Array<{
    blockers: string[];
    enabled: boolean;
    moduleId: "M01" | "M02";
    ready: boolean;
  }>;
  selectableVendors: Array<{ key: string; name: string }>;
};

type CertificationBlockerState = {
  blockers: string[];
  description?: string;
  eyebrow?: string;
  locationId: string;
  locationName: string;
  nextStepDetail?: string;
  primaryAction: LocationWorkflowState["primaryAction"];
  primaryLabel: string;
  requirements: LocationWorkflowState["requirements"];
  uploadArtifactKey?: string;
  uploadModuleTarget?: "M01" | "M02";
  uploadVendorName?: string;
  uploadVendorKey?: string;
};

type GovernanceWorkspaceConflictPayload = {
  action?: "upload_agreement";
  artifactKey?: string;
  ctaLabel?: string;
  error?: string;
  locationId?: string;
  locationName?: string;
  moduleId?: "M01" | "M02";
  vendor?: string;
  workspace?: PersistedWorkspaceRecord;
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
  detectedFormatKey?: string;
  detectedFormatName?: string;
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
  parseWarnings?: string[];
  rows?: number;
  schema: boolean;
  sizeBytes: number;
  sourceSystemKey?: string;
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
type PersistedSupportTicket = {
  id: string;
  priority: "High" | "Medium" | "Low";
  status: "open" | "in_review" | "waiting_on_customer" | "resolved";
  subject: string;
};
type PersistedAccessRequest = WgsApproval;
type PersistedActivityLog = LogRecord;

export function SentryApp({ initialSession = null }: { initialSession?: SessionState | null }) {
  const locationStatePersistenceStatusRef = useRef<"unknown" | "available" | "missing-table">(
    "unknown",
  );
  const [session, setSession] = useState<SessionState | null>(initialSession);
  const [activeViewOverride, setActiveViewOverride] = useState<ViewId | null>(null);
  const [expandedLocations, setExpandedLocations] = useState<string[]>(["LOC-104"]);
  const [activeWorkspaceLocationId, setActiveWorkspaceLocationId] = useState<string | null>(null);
  const [selectedCaar, setSelectedCaar] = useState<CaarRecord | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "immutable" | "editable">("all");
  const [faqQuery, setFaqQuery] = useState("");
  const [faqOpen, setFaqOpen] = useState<string | null>(faqItems[0]?.question ?? null);
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
  const [artifactUploadProgress, setArtifactUploadProgress] = useState<{ fileName: string } | null>(null);
  const [artifactIntakeState, setArtifactIntakeState] = useState<Record<string, IntakeState>>({});
  const [artifactContractState, setArtifactContractState] = useState<Record<string, Record<string, string>>>({});
  const [activeCertification, setActiveCertification] = useState<ActiveCertificationState | null>(null);
  const [certificationProgress, setCertificationProgress] = useState<CertificationProgressState | null>(null);
  const [pendingCertificationRequest, setPendingCertificationRequest] = useState<PendingCertificationRequest | null>(null);
  const [certificationBlocker, setCertificationBlocker] = useState<CertificationBlockerState | null>(null);
  const [activeUploadLocation, setActiveUploadLocation] = useState<{
    accountId: string;
    id: string;
    name: string;
    preferredArtifactKey?: string;
    preferredModule?: "M01" | "M02";
    preferredVendorKey?: string;
    preferredVendorName?: string;
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
            onboardingProgress: wgsOnboardingState[location.id],
            schemaState,
            uploadState,
          }),
        ]),
      ) as Record<string, LocationWorkflowState>,
    [artifactIntakeState, runtimeLocationState, schemaState, uploadState, wgsOnboardingState],
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
        detectedFormatKey: upload.detectedFormatKey,
        detectedFormatName: upload.detectedFormatName,
        uploadId: upload.id,
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
        sourceSystemKey: upload.sourceSystemKey,
        matchPct: upload.matchPct,
        matchedColumns: upload.matchedColumns,
        expectedColumns: upload.expectedColumns,
        metrics: upload.metrics,
        parseWarnings: upload.parseWarnings,
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
                        upload.parseWarnings?.length
                          ? `${upload.fileName} uploaded. ${upload.parseWarnings[0]}`
                          : upload.matchPct !== undefined
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
        detectedFormatKey: upload.detectedFormatKey,
        detectedFormatName: upload.detectedFormatName,
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
        parseWarnings: upload.parseWarnings,
        rows: upload.rows,
        sizeBytes: upload.sizeBytes,
        sourceSystemKey: upload.sourceSystemKey,
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

    const response = await fetch("/api/v1/support/tickets?queue=1", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { tickets?: PersistedSupportTicket[] };

    setWgsQueueState(
      (payload.tickets ?? [])
        .filter((ticket) => ticket.status !== "resolved")
        .map((ticket) => ({
          account: "Portfolio",
          age: "Now",
          id: ticket.id,
          issue: ticket.subject,
          priority: ticket.priority,
        })),
    );
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
    return buildScopedUploadModules(uploadState, accountId);
  }

  function getScopedAccountId() {
    if (supportMode.active && supportMode.accountId) return supportMode.accountId;
    if (effectiveSession?.accountId) return effectiveSession.accountId;
    return null;
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

  function buildOnboardingUploadRecord(
    receipt: UploadReceipt,
    vendorName: string,
  ): WgsOnboardingUpload {
    return {
      docKey: `${receipt.moduleId}:${receipt.artifactKey ?? receipt.fileName}:${receipt.vendorKey ?? "global"}`,
      hash: receipt.hashValue ?? "pending",
      module: receipt.moduleId,
      name: receipt.fileName,
      rows: receipt.rows ?? receipt.pageCount ?? 0,
      vendorName,
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
    moduleId: "M01" | "M02" | "M03",
    artifactKey: string,
    vendorKey?: string,
  ) {
    return `${accountId}:${locationId}:${moduleId}:${artifactKey}:${vendorKey ?? "global"}`;
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

  function handleOpenLocationWorkspace(locationId: string) {
    setActiveWorkspaceLocationId(locationId);
    startTransition(() => setActiveViewOverride("location"));
  }

  async function handleOpenAddLocation() {
    if (!effectiveSession?.accountId && effectiveSession?.role !== "WGS Manager") {
      showToast("Set a real team account in Team & Access before creating a location.");
      startTransition(() => setActiveViewOverride("permissions"));
      return;
    }

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

  function handleOpenLocationUploads(
    locationId: string,
    options?: {
      artifactKey?: string;
      moduleId?: "M01" | "M02";
      vendorKey?: string;
      vendorName?: string;
    },
  ) {
    const location = visibleLocations.find((item) => item.id === locationId);
    if (!location) {
      return;
    }

    setActiveWorkspaceLocationId(locationId);
    setActiveUploadLocation({
      accountId: location.accountId,
      id: location.id,
      name: location.name,
      preferredArtifactKey: options?.artifactKey,
      preferredModule: options?.moduleId,
      preferredVendorKey: options?.vendorKey,
      preferredVendorName: options?.vendorName,
    });
    startTransition(() => setActiveViewOverride("uploads"));
  }

  function handleOpenDiy() {
    startTransition(() => setActiveViewOverride("diy"));
  }

  function handleCompleteUploadSet(locationId: string, moduleId: "M01" | "M02") {
    const location = visibleLocations.find((item) => item.id === locationId);
    if (!location) {
      return;
    }

    const currentProgress = wgsOnboardingState[locationId] ?? createWgsOnboardingProgress();
    void persistLocationState(location, {
      onboardingChecklist: onboardingState,
      onboardingProgress: currentProgress,
    });

    void syncAuditLogs();
    setActiveUploadLocation(null);
    setUploadFeedback(null);
    setActiveWorkspaceLocationId(locationId);
    startTransition(() => setActiveViewOverride("location"));
    showToast(`${moduleId} upload set saved for ${location.name}.`);
  }

  function toggleLocation(id: string) {
    setExpandedLocations((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function handleExpandAll() {
    setExpandedLocations(visibleLocations.map((location) => location.id));
  }

  async function handleAddLocation(draft: AddLocationDraft) {
    const scopedAccountId = getScopedAccountId();
    if (!scopedAccountId && effectiveSession?.role !== "WGS Manager") {
      showToast("A real team account is required before creating a location.");
      startTransition(() => setActiveViewOverride("permissions"));
      return;
    }

    const createResponse = await fetch("/api/restaurants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: scopedAccountId,
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
      accountId: scopedAccountId ?? "",
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
    setActiveWorkspaceLocationId(location.id);
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
    if (target.artifact.key.includes("bank")) {
      const sourceConfig = getLocationSourceConfig(target.locationId);
      const sharedBankTargets = ([
        ...(sourceConfig?.m01Enabled
          ? sourceConfig.m01Vendors.map((configuredVendor) => ({ moduleId: "M01" as const, vendor: configuredVendor }))
          : []),
        ...(sourceConfig?.m02Enabled
          ? sourceConfig.m02Vendors.map((configuredVendor) => ({ moduleId: "M02" as const, vendor: configuredVendor }))
          : []),
      ]).map(({ moduleId, vendor: configuredVendor }) => ({
        artifactKey:
          resolveModuleTemplate(uploadState, target.accountId, moduleId)?.artifacts.find((artifact) =>
            artifact.key.startsWith(moduleId === "M01" ? "m01-bank" : "m02-bank"),
          )?.key ?? (moduleId === "M01" ? "m01-bank" : "m02-bank"),
        moduleId,
        vendorKey: configuredVendor.key,
        vendorName: configuredVendor.name,
      }));
      formData.set("sharedBankTargets", JSON.stringify(sharedBankTargets));
    }

    const response = await fetch("/api/v1/uploads", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; upload?: PersistedUploadRecord; uploads?: PersistedUploadRecord[] }
      | null;

    if (!response.ok || !payload?.upload) {
      const message = payload?.error ?? "Upload failed.";
      showToast(message);
      throw new Error(message);
    }

    const persistedUploads = payload.uploads?.length ? payload.uploads : [payload.upload];
    const appliedUploads = persistedUploads.map((upload) => applyPersistedUpload(upload, target.accountId));
    const receipt =
      appliedUploads.find(({ receipt: candidate }) =>
        candidate.moduleId === target.moduleId && candidate.vendorKey === (vendor?.key ?? target.vendorKey),
      )?.receipt ?? appliedUploads[0].receipt;
    const targetLocation = runtimeLocationState.find((item) => item.id === target.locationId);
    const currentProgress = wgsOnboardingState[target.locationId] ?? createWgsOnboardingProgress();
    const uploadRecord = buildOnboardingUploadRecord(
      receipt,
      vendor?.name ?? target.vendorName ?? target.locationName,
    );
    const nextProgress: WgsOnboardingProgress = {
      ...currentProgress,
      uploads: {
        ...currentProgress.uploads,
        [uploadRecord.docKey ?? `${receipt.moduleId}:${receipt.fileName}`]: uploadRecord,
      },
    };
    setWgsOnboardingState((current) => ({
      ...current,
      [target.locationId]: nextProgress,
    }));
    if (targetLocation) {
      void persistLocationState(targetLocation, {
        onboardingChecklist: onboardingState,
        onboardingProgress: nextProgress,
      });
    }
    void syncAuditLogs();
    setUploadFeedback(receipt);
    showToast(
      persistedUploads.length > 1
        ? `${receipt.fileName} uploaded once and linked to ${persistedUploads.length} provider evidence sets.`
        : `${receipt.fileName} uploaded and stored.`,
    );
    return receipt;
  }

  async function handleRemoveSavedUpload(
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendorKey: string,
  ) {
    const targetLocation = getUploadTargetLocation();
    if (!targetLocation) {
      showToast("Open Upload Data from a valid location first.");
      return;
    }

    const accountId = targetLocation.accountId;
    const intakeKey = getArtifactStateKey(accountId, targetLocation.id, moduleId, artifactKey, vendorKey);
    const intake = artifactIntakeState[intakeKey];
    if (!intake?.uploadId) {
      showToast("No saved upload was found for this document.");
      return;
    }

    const response = await fetch("/api/v1/uploads", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadId: intake.uploadId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; removedUploadIds?: number[] } | null;
    if (!response.ok) {
      showToast(payload?.error ?? "Unable to remove the saved upload.");
      return;
    }

    setArtifactIntakeState((current) => {
      const next = { ...current };
      const removedUploadIds = new Set(payload?.removedUploadIds ?? [intake.uploadId!]);
      for (const [key, value] of Object.entries(next)) {
        if (removedUploadIds.has(value.uploadId ?? -1)) {
          delete next[key];
        }
      }
      return next;
    });

    setUploadState((current) =>
      current.map((module) =>
        module.accountId === accountId && module.id === moduleId
          ? {
              ...module,
              artifacts: module.artifacts.map((artifact) =>
                artifact.key === artifactKey
                  ? {
                      ...artifact,
                      status: "Missing",
                      note: "No upload received yet for this location.",
                    }
                  : artifact,
              ),
            }
          : module,
      ),
    );

    setWgsOnboardingState((current) => {
      const progress = current[targetLocation.id] ?? createWgsOnboardingProgress();
      const nextUploads = Object.fromEntries(
        Object.entries(progress.uploads).filter(([, upload]) => {
          const uploadKey = upload.docKey ?? "";
          return !(
            upload.module === moduleId &&
            uploadKey.includes(artifactKey) &&
            uploadKey.includes(vendorKey)
          );
        }),
      );
      const nextProgress = {
        ...progress,
        uploads: nextUploads,
      };
      void persistLocationState(targetLocation, {
        onboardingChecklist: onboardingState,
        onboardingProgress: nextProgress,
      });
      return {
        ...current,
        [targetLocation.id]: nextProgress,
      };
    });

    setUploadFeedback(null);
    void syncAuditLogs();
    showToast("Saved upload removed.");
  }

  async function handleResetLocationUploads(locationId: string) {
    const targetLocation = runtimeLocationState.find((item) => item.id === locationId);
    if (!targetLocation) {
      showToast("Location could not be resolved.");
      return;
    }

    const response = await fetch("/api/v1/uploads", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locationId,
        resetLocation: true,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      showToast(payload?.error ?? "Unable to reset the current upload set.");
      return;
    }

    setArtifactIntakeState((current) => {
      const prefix = `${targetLocation.accountId}:${locationId}:`;
      return Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(prefix)),
      );
    });

    setUploadState((current) =>
      current.map((module) =>
        module.accountId === targetLocation.accountId
          ? {
              ...module,
              artifacts: module.artifacts.map((artifact) => ({
                ...artifact,
                status: "Missing",
                note: "No upload received yet for this location.",
              })),
            }
          : module,
      ),
    );

    setWgsOnboardingState((current) => {
      const progress = current[locationId] ?? createWgsOnboardingProgress();
      const nextProgress = {
        ...progress,
        uploads: {},
      };
      void persistLocationState(targetLocation, {
        onboardingChecklist: onboardingState,
        onboardingProgress: nextProgress,
      });
      return {
        ...current,
        [locationId]: nextProgress,
      };
    });

    setUploadFeedback(null);
    void syncAuditLogs();
    showToast(`Started a new certification period for ${targetLocation.name}.`);
  }

  async function persistLocationState(
    location: LocationRecord,
    options?: {
      onboardingChecklist?: Record<string, boolean[]>;
      onboardingProgress?: WgsOnboardingProgress;
    },
  ): Promise<boolean> {
    if (locationStatePersistenceStatusRef.current === "missing-table") {
      return false;
    }

    try {
      const response = await fetch("/api/location-states", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationId: location.id,
          modules: location.modules,
          onboardingChecklist: options?.onboardingChecklist ?? onboardingState,
          onboardingProgress: options?.onboardingProgress ?? null,
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
          return false;
        }
        showToast(payload?.error ?? "Location state save failed.");
        return false;
      }

      locationStatePersistenceStatusRef.current = "available";
      return true;
    } catch {
      showToast("Location state save failed.");
      return false;
    }
  }

  async function handleArtifactFileSelected(file: File) {
    if (!activeArtifact) return;
    setArtifactUploadProgress({ fileName: file.name });
    try {
      await processArtifactFileUpload(activeArtifact, file);
    } finally {
      setArtifactUploadProgress(null);
    }
  }

  async function handleDirectArtifactUpload(
    moduleId: "M01" | "M02",
    artifactKey: string,
    file: File,
    vendor?: { key: string; name: string },
  ): Promise<UploadReceipt | null> {
    const targetLocation = activeUploadLocation ?? visibleLocations[0];
    if (!targetLocation) return null;

    const uploadModule =
      resolveUploadModulesForAccount(targetLocation.accountId).find((item) => item.id === moduleId) ??
      buildScopedUploadModules(uploadState, targetLocation.accountId).find((item) => item.id === moduleId) ??
      buildScopedUploadModules(uploadModules, targetLocation.accountId).find((item) => item.id === moduleId) ??
      null;

    const artifact =
      uploadModule?.artifacts.find(
        (item) =>
          item.key === artifactKey ||
          item.key.startsWith(artifactKey) ||
          artifactKey.startsWith(item.key),
      ) ??
      resolveArtifactTemplate(uploadState, targetLocation.accountId, moduleId, artifactKey) ??
      resolveArtifactTemplate(uploadModules, targetLocation.accountId, moduleId, artifactKey) ??
      null;

    if (!uploadModule || !artifact) return null;

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
    setArtifactUploadProgress({ fileName: file.name });
    try {
      return await processArtifactFileUpload(target, file, vendor);
    } finally {
      setArtifactUploadProgress(null);
    }
  }

  async function handleWorkspaceGovernedArtifactUpload(
    workspace: SchemaWorkspace,
    artifactKind: "source" | "agreement",
    file: File,
  ): Promise<UploadReceipt | null> {
    if (!workspace.locationId) {
      showToast("This workspace is not attached to a location yet.");
      return null;
    }

    const targetLocation = runtimeLocationState.find((item) => item.id === workspace.locationId) ?? null;
    const scopedAccountId = targetLocation?.accountId ?? workspace.accountId;
    if (!targetLocation || !scopedAccountId) {
      showToast("The governed workspace location could not be resolved.");
      return null;
    }

    const artifactKey =
      artifactKind === "source"
        ? workspace.module === "M01"
          ? "m01-processor"
          : "m02-settlement"
        : workspace.module === "M01"
          ? "m01-agreement"
          : "m02-agreement";

    const uploadModule =
      resolveUploadModulesForAccount(scopedAccountId).find((item) => item.id === workspace.module) ??
      buildScopedUploadModules(uploadState, scopedAccountId).find((item) => item.id === workspace.module) ??
      buildScopedUploadModules(uploadModules, scopedAccountId).find((item) => item.id === workspace.module) ??
      null;

    const artifact =
      uploadModule?.artifacts.find(
        (item) =>
          item.key === artifactKey ||
          item.key.startsWith(artifactKey) ||
          artifactKey.startsWith(item.key),
      ) ??
      resolveArtifactTemplate(uploadState, scopedAccountId, workspace.module, artifactKey) ??
      resolveArtifactTemplate(uploadModules, scopedAccountId, workspace.module, artifactKey) ??
      null;

    if (!uploadModule || !artifact) {
      showToast("The governed upload slot could not be resolved for this workspace.");
      return null;
    }

    return processArtifactFileUpload(
      {
        accountId: uploadModule.accountId,
        artifact,
        locationId: targetLocation.id,
        locationName: targetLocation.name,
        moduleId: workspace.module,
        vendorKey: resolveVendorKey(workspace.module, workspace.vendor),
        vendorName: workspace.vendor,
      },
      file,
      {
        key: resolveVendorKey(workspace.module, workspace.vendor),
        name: workspace.vendor,
      },
    );
  }

  async function persistWorkspace(workspace: SchemaWorkspace, action: "draft" | "seal") {
    try {
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
        | GovernanceWorkspaceConflictPayload
        | null;

      if (!response.ok || !payload?.workspace) {
        if (
          response.status === 409 &&
          payload?.locationId &&
          payload.locationName &&
          payload.moduleId &&
          payload.error
        ) {
           const documentLabel =
             payload.moduleId === "M01"
               ? `signed ${payload.vendor ?? ""} merchant agreement PDF`.trim()
               : `signed ${payload.vendor ?? ""} DSP agreement PDF`.trim();
          const workflow = workflowByLocation[payload.locationId];
          setCertificationBlocker({
              blockers: [payload.error],
               description:
                 "This workspace cannot be sealed yet. Upload the signed agreement in the Vault Record, then click Seal Contract Config again.",
            eyebrow: "Workspace Sealing Blocked",
            locationId: payload.locationId,
            locationName: payload.locationName,
            nextStepDetail: `Next step: open DIY Access for ${payload.locationName}, switch to ${payload.moduleId}, then upload the ${documentLabel} directly in Schema Editor.`,
            primaryAction: "diy",
            primaryLabel: "Open DIY Access",
            requirements: workflow?.requirements ?? [],
            uploadArtifactKey: payload.artifactKey,
            uploadModuleTarget: payload.moduleId,
            uploadVendorKey:
              payload.vendor && payload.moduleId
                ? resolveVendorKey(payload.moduleId, payload.vendor)
                : undefined,
            uploadVendorName: payload.vendor,
          });
          return null;
        }
        showToast(payload?.error ?? "Unable to save the governance workspace.");
        return null;
      }

      applyPersistedWorkspace(payload.workspace);
      setEditingWorkspace(null);
      return payload.workspace;
    } catch {
      showToast("Unable to save the governance workspace right now.");
      return null;
    }
  }

  async function handleSaveWorkspace(workspace: SchemaWorkspace) {
    const savedWorkspace = await persistWorkspace(workspace, "draft");
    if (!savedWorkspace) {
      return;
    }
    await Promise.all([syncAssignedRestaurants(), syncGovernanceWorkspaces(), syncAuditLogs()]);
    showToast("Schema draft saved.");
  }

  async function handleSealWorkspace(workspace: SchemaWorkspace) {
    const sealedWorkspace = await persistWorkspace(workspace, "seal");
    if (!sealedWorkspace) {
      return;
    }
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

    const savedSourceConfig = getLocationSourceConfig(locationId);
    const configuredVendorName =
      module === "M01"
        ? savedSourceConfig?.m01Vendors?.[0]?.name
        : savedSourceConfig?.m02Vendors?.[0]?.name;
    const vendorName =
      vendor?.trim() ||
      configuredVendorName?.trim() ||
      (module === "M01" ? wgsM01Vendors[0]?.name : wgsM02Vendors[0]?.name) ||
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

    if (current.uploaded && current.hash && current.schema && current.fields) {
      setActiveArtifact(null);
      showToast("All intake steps are already complete for this artifact.");
      return;
    }

    let next: IntakeState;
    const manualValues = artifactContractState[key] ?? {};
    const usingManualMode = activeArtifact.artifact.type === "Manual Entry";

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

    if (isReady) {
      setActiveArtifact(null);
      showToast("Artifact intake is complete.");
    }
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
    setActiveWorkspaceLocationId(locationId);
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

  async function handleManageUploadSources(locationId: string, next: {
    m01Enabled: boolean;
    m01Vendors: string[];
    m02Enabled: boolean;
    m02Vendors: string[];
  }) {
    const targetLocation = runtimeLocationState.find((location) => location.id === locationId);
    if (!targetLocation) {
      throw new Error("The selected location is no longer available.");
    }
    if (next.m01Enabled && next.m01Vendors.length === 0) {
      throw new Error("Select an M01 processor before saving.");
    }
    if (next.m02Enabled && next.m02Vendors.length === 0) {
      throw new Error("Select at least one M02 delivery platform before saving.");
    }
    if (!next.m01Enabled && !next.m02Enabled) {
      throw new Error("At least one certification module must remain enabled.");
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

    const saved = await persistLocationState(updatedLocation, {
      onboardingChecklist: onboardingState,
      onboardingProgress: nextProgress,
    });
    if (!saved) {
      throw new Error("Source settings could not be saved.");
    }

    setWgsOnboardingState((current) => ({
      ...current,
      [targetLocation.id]: nextProgress,
    }));
    updateRuntimeLocation(targetLocation.id, () => updatedLocation);
    await syncAssignedRestaurants();
    showToast("Active source settings updated.");
  }

function handleCompleteOnboarding(locationId: string) {
    const location = runtimeLocationState.find((item) => item.id === locationId);
    const progress = wgsOnboardingState[locationId];
    if (!location || !progress) return;

    updateRuntimeLocation(locationId, (item) => ({
      ...item,
      status: Math.round((item.m01 + item.m02) / 2) >= 85 ? "Certified" : "At Risk",
      lastCertified: new Date().toISOString().slice(0, 10),
      modules: item.modules.map((module) =>
        module.label === "Evidence"
          ? {
              ...module,
              score: Math.max(module.score, 55),
              note: "WGS activation workflow completed. Upload the real certification evidence in Upload Data before running certification.",
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
    setActiveWorkspaceLocationId(locationId);
    setActiveUploadLocation(null);
    setActiveArtifact(null);
    setUploadFeedback(null);
    startTransition(() => setActiveViewOverride("location"));
    const persistedLocation = {
      ...location,
      lastCertified: new Date().toISOString().slice(0, 10),
      modules: location.modules.map((module) =>
        module.label === "Evidence"
          ? {
              ...module,
              score: Math.max(module.score, 55),
              note: "WGS activation workflow completed. Upload the real certification evidence in Upload Data before running certification.",
            }
          : module,
      ),
      status: completedStatus,
    };
    void persistLocationState(persistedLocation, {
      onboardingChecklist: onboardingState,
      onboardingProgress: completedProgress,
    });
    showToast(`${location.name} onboarding complete.`);
  }

  function handleSendPasswordReset(userId: string, email: string) {
    showToast(`Reset link sent to ${email}.`);
  }

  function handleDeactivateWgsUser(userId: string) {
    const user = wgsUserState.find((item) => item.id === userId);
    if (!user) return;
    setWgsUserState((current) =>
      current.map((item) => (item.id === userId ? { ...item, status: "Inactive" } : item)),
    );
    setEditingWgsUser(null);
    showToast(`${user.firstName} ${user.lastName} deactivated.`);
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

  function handleRunCertification(locationId: string) {
    const location = runtimeLocationState.find((item) => item.id === locationId);
    if (!location) return;
    const workflow = workflowByLocation[locationId];
    const selectableModules = (["M01", "M02"] as const).map((moduleId) => ({
      blockers: workflow?.moduleReadiness?.[moduleId]?.blockers ?? [],
      enabled: workflow?.moduleReadiness?.[moduleId]?.enabled ?? false,
      moduleId,
      ready: workflow?.moduleReadiness?.[moduleId]?.ready ?? false,
    }));
    const defaultSelectedModules = selectableModules
      .filter((item) => item.enabled && item.ready)
      .map((item) => item.moduleId)
      .slice(0, 1);

    if (defaultSelectedModules.length === 0) {
      setCertificationBlocker({
        blockers: workflow?.blockers ?? ["No module is ready for certification."],
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
      selectedModules: defaultSelectedModules,
      selectableModules,
      selectableVendors: getLocationSourceConfig(locationId)?.m02Vendors ?? [],
      selectedVendorKey:
        defaultSelectedModules[0] === "M02"
          ? getLocationSourceConfig(locationId)?.m02Vendors[0]?.key
          : undefined,
    });
  }

  async function executeRunCertification(
    cadence: "monthly_final" | "weekly_preliminary",
    certificationMonth: string,
  ) {
    const request = pendingCertificationRequest;
    if (!request) return;
    const location = runtimeLocationState.find((item) => item.id === request.locationId);
    if (!location) return;
    if (request.selectedModules.length !== 1) {
      showToast("Select exactly one ready module. M01 and M02 produce separate CAARs.");
      return;
    }
    const moduleId = request.selectedModules[0];
    const selectedVendorKey =
      moduleId === "M02"
        ? request.selectedVendorKey ?? request.selectableVendors[0]?.key
        : undefined;
    if (moduleId === "M02" && !selectedVendorKey) {
      setCertificationBlocker({
        blockers: [
          "No delivery platform is selected for this M02 certification. Open the location dashboard and configure a delivery source before running certification.",
        ],
        locationId: request.locationId,
        locationName: location.name,
        primaryAction: "uploads",
        primaryLabel: "Open Upload Data",
        requirements: [],
      });
      return;
    }
    setCertificationProgress({
      cadence,
      certificationMonth,
      locationName: location.name,
      moduleId,
      phase: "preparing",
    });
    setPendingCertificationRequest(null);

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      setCertificationProgress((current) => current ? { ...current, phase: "certifying" } : current);
      const response = await fetch("/api/v1/certifications/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cadence,
          certificationMonth,
          locationId: request.locationId,
          modules: request.selectedModules,
          vendorKey: selectedVendorKey,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ({ error?: string } & PersistedCertificationResponse)
        | null;

      if (!response.ok || !payload?.certification || !payload.location) {
        const workflow = workflowByLocation[request.locationId];
        if (response.status === 400 || response.status === 409) {
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

      setCertificationProgress((current) => current ? { ...current, phase: "applying" } : current);
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
      const certifiedModule = certification.record.traceability?.module ?? null;
      setCaarState((current) => [
        certification.record,
        ...current.filter((item) => {
          if (item.locationId !== request.locationId) {
            return true;
          }

          if (!certifiedModule) {
            return false;
          }

          return item.traceability?.module !== certifiedModule;
        }),
      ]);
      setActiveCertification({
        cadence: certification.cadence ?? cadence,
        caarId: certification.record.id,
        locationId: request.locationId,
        locationName: location.name,
        ready: certification.ready,
        steps: certification.steps,
        trustScore: certification.trustScore,
      });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      setCertificationProgress((current) => current ? { ...current, phase: "refreshing" } : current);
      await Promise.all([syncAssignedRestaurants(), syncAssignedCaars(), syncAuditLogs()]);
      showToast(
        cadence === "weekly_preliminary"
          ? `${certification.record.id} preliminary certification saved.`
          : `${certification.record.id} certified and saved.`,
      );
    } catch {
      showToast("The certification request could not be completed. Check your connection and try again.");
    } finally {
      setCertificationProgress(null);
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
        navGroups={getNavigationForRole(effectiveSession.role)}
        onExitSupportMode={() => setSupportMode({ active: false, accountId: null, accountName: null })}
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
          const workflow = workflowByLocation[primaryLocation.id];
          const selectableModules = (["M01", "M02"] as const).map((moduleId) => ({
            blockers: workflow?.moduleReadiness?.[moduleId]?.blockers ?? [],
            enabled: workflow?.moduleReadiness?.[moduleId]?.enabled ?? false,
            moduleId,
            ready: workflow?.moduleReadiness?.[moduleId]?.ready ?? false,
          }));
          setPendingCertificationRequest({
            locationId: primaryLocation.id,
            locationName: primaryLocation.name,
            locations: selectableLocations,
            selectedModules: selectableModules
              .filter((item) => item.enabled && item.ready)
              .map((item) => item.moduleId)
              .slice(0, 1),
            selectableModules,
            selectableVendors: getLocationSourceConfig(primaryLocation.id)?.m02Vendors ?? [],
            selectedVendorKey:
              selectableModules.find((item) => item.enabled && item.ready)?.moduleId === "M02"
                ? getLocationSourceConfig(primaryLocation.id)?.m02Vendors[0]?.key
                : undefined,
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
          activeWorkspaceLocationId={activeWorkspaceLocationId}
          activeUploadLocationId={activeUploadLocation?.id ?? visibleLocations[0]?.id ?? null}
          activeUploadArtifactHint={activeUploadLocation?.preferredArtifactKey ?? null}
          activeUploadModuleHint={activeUploadLocation?.preferredModule ?? null}
          activeUploadModules={activeUploadModules}
          activeUploadLocationName={activeUploadLocation?.name ?? visibleLocations[0]?.name ?? null}
          activeSupportAccountId={getScopedAccountId()}
          activeSupportAccountName={getScopedAccountName()}
          activeUploadSourceConfig={activeUploadSourceConfig}
          activeUploadVendorKeyHint={activeUploadLocation?.preferredVendorKey ?? null}
          activeUploadVendorNameHint={activeUploadLocation?.preferredVendorName ?? null}
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
        hasTeamAccount={Boolean(effectiveSession?.accountId)}
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
          onDirectUpload={handleDirectArtifactUpload}
          onGoToTeamAccess={() => startTransition(() => setActiveViewOverride("permissions"))}
          onRemoveUpload={handleRemoveSavedUpload}
          onResetLocationUploads={handleResetLocationUploads}
          onEnterSupportMode={handleEnterSupportMode}
          onExpandAll={handleExpandAll}
          onFilterChange={setLogFilter}
          onOpenCaar={setSelectedCaar}
          onOpenDiy={handleOpenDiy}
          onOpenLocation={handleOpenLocationWorkspace}
          onOpenOnboarding={handleOpenOnboarding}
          onOpenSchemaEditor={setEditingWorkspace}
          onOpenUploads={handleOpenLocationUploads}
          onOpenUser={setEditingWgsUser}
          onInitializeWorkspace={handleInitializeWorkspace}
          onSupportTicketCreated={() => {
            void syncSupportTickets();
            void syncAuditLogs();
            showToast("Support ticket submitted.");
          }}
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
          uploadProgress={artifactUploadProgress}
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
        (() => {
          const vendorKey = resolveVendorKey(editingWorkspace.module, editingWorkspace.vendor);
          const sourceArtifactKey = editingWorkspace.module === "M01" ? "m01-processor" : "m02-settlement";
          const agreementArtifactKey = editingWorkspace.module === "M01" ? "m01-agreement" : "m02-agreement";
          const sourceIntake =
            editingWorkspace.locationId
              ? artifactIntakeState[
                  getArtifactStateKey(
                    editingWorkspace.accountId,
                    editingWorkspace.locationId,
                    editingWorkspace.module,
                    sourceArtifactKey,
                    vendorKey,
                  )
                ] ?? null
              : null;
          const agreementIntake =
            editingWorkspace.locationId
              ? artifactIntakeState[
                  getArtifactStateKey(
                    editingWorkspace.accountId,
                    editingWorkspace.locationId,
                    editingWorkspace.module,
                    agreementArtifactKey,
                    vendorKey,
                  )
                ] ?? null
              : null;

          return (
        <SchemaEditorModal
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onSave={handleSaveWorkspace}
          onSeal={handleSealWorkspace}
          onUploadGovernedArtifact={handleWorkspaceGovernedArtifactUpload}
          governedSourceIntake={sourceIntake}
          governedAgreementIntake={agreementIntake}
          role={effectiveSession?.role ?? "Viewer"}
        />
          );
        })()
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

      {pendingCertificationRequest ? (
        <CertificationCadenceModal
          locationId={pendingCertificationRequest.locationId}
          locations={pendingCertificationRequest.locations}
          locationName={pendingCertificationRequest.locationName}
          selectedModules={pendingCertificationRequest.selectedModules}
          selectedVendorKey={pendingCertificationRequest.selectedVendorKey}
          selectableModules={pendingCertificationRequest.selectableModules}
          selectableVendors={pendingCertificationRequest.selectableVendors}
          onChangeLocation={(locationId) => {
            const nextLocation =
              pendingCertificationRequest.locations?.find((location) => location.id === locationId) ?? null;
            if (!nextLocation) {
              return;
            }
            const nextWorkflow = workflowByLocation[nextLocation.id];
            const nextSelectableModules = (["M01", "M02"] as const).map((moduleId) => ({
              blockers: nextWorkflow?.moduleReadiness?.[moduleId]?.blockers ?? [],
              enabled: nextWorkflow?.moduleReadiness?.[moduleId]?.enabled ?? false,
              moduleId,
              ready: nextWorkflow?.moduleReadiness?.[moduleId]?.ready ?? false,
            }));
            setPendingCertificationRequest((current) =>
              current
                ? {
                    ...current,
                    locationId: nextLocation.id,
                    locationName: nextLocation.name,
                    selectedModules: nextSelectableModules
                      .filter((item) => item.enabled && item.ready)
                      .map((item) => item.moduleId)
                      .slice(0, 1),
                    selectableModules: nextSelectableModules,
                    selectableVendors: getLocationSourceConfig(nextLocation.id)?.m02Vendors ?? [],
                    selectedVendorKey:
                      nextSelectableModules.find((item) => item.enabled && item.ready)?.moduleId === "M02"
                        ? getLocationSourceConfig(nextLocation.id)?.m02Vendors[0]?.key
                        : undefined,
                  }
                : current,
            );
          }}
          onChangeModules={(modules) =>
            setPendingCertificationRequest((current) =>
              current
                ? {
                    ...current,
                    selectedModules: modules,
                    selectedVendorKey:
                      modules[0] === "M02"
                        ? current.selectedVendorKey ?? current.selectableVendors[0]?.key
                        : undefined,
                  }
                : current,
            )
          }
          onChangeVendor={(vendorKey) =>
            setPendingCertificationRequest((current) =>
              current ? { ...current, selectedVendorKey: vendorKey } : current,
            )
          }
          onClose={() => setPendingCertificationRequest(null)}
          onSubmit={executeRunCertification}
        />
      ) : null}

      {certificationProgress ? (
        <CertificationProgressModal
          cadence={certificationProgress.cadence}
          certificationMonth={certificationProgress.certificationMonth}
          locationName={certificationProgress.locationName}
          moduleId={certificationProgress.moduleId}
          phase={certificationProgress.phase}
        />
      ) : null}

      {activeCertification ? (
        <CertificationRunModal
          cadence={activeCertification.cadence}
          locationName={activeCertification.locationName}
          onClose={() => setActiveCertification(null)}
          openCaar={() => {
            const record = caarState.find((item) => item.id === activeCertification.caarId);
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
          description={certificationBlocker.description}
          eyebrow={certificationBlocker.eyebrow}
          locationName={certificationBlocker.locationName}
          nextStepDetail={certificationBlocker.nextStepDetail}
          onClose={() => setCertificationBlocker(null)}
          onOpenDiy={handleOpenDiy}
          onOpenOnboarding={() => handleOpenOnboarding(certificationBlocker.locationId)}
          onOpenUploads={() =>
            handleOpenLocationUploads(certificationBlocker.locationId, {
              artifactKey: certificationBlocker.uploadArtifactKey,
              moduleId: certificationBlocker.uploadModuleTarget,
              vendorKey: certificationBlocker.uploadVendorKey,
              vendorName: certificationBlocker.uploadVendorName,
            })
          }
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
      const modules = parseStoredModules(restaurant.sentry_state?.modules_json)
        .filter((module) => module.label === "M01" || module.label === "M02")
        .map((module) => ({
          ...module,
          score:
            module.label === "M01"
              ? restaurant.sentry_state?.m01_score ?? module.score
              : restaurant.sentry_state?.m02_score ?? module.score,
        }));
      const persistedStatus = toLocationStatus(restaurant.sentry_state?.status);
      const status =
        restaurant.sentry_state?.completed && persistedStatus === "Onboarding"
          ? Math.round(
              ((restaurant.sentry_state?.m01_score ?? 0) +
                (restaurant.sentry_state?.m02_score ?? 0)) /
                2,
            ) >= 85
            ? "Certified"
            : "At Risk"
          : persistedStatus;

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
        modules,
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
    effective_date: getContractValue(workspace.contract, ["Effective Date", "Contract Effective Date"]),
    chargeback_fee: extractNumericValue(getContractValue(workspace.contract, ["Chargeback Fee", "Chargeback Fee ($)"])),
    markup_bps: extractNumericValue(
      getContractValue(workspace.contract, ["Processor Markup", "Processor Markup (basis pts)"]),
    ),
    monthly_fee: extractNumericValue(
      getContractValue(workspace.contract, ["Monthly Statement Fee", "Monthly Statement Fee ($)", "Monthly Fee"]),
    ),
    pricing_model: getContractValue(workspace.contract, "Pricing Model"),
    processor_name: workspace.vendor,
    txn_fee: extractNumericValue(
      getContractValue(workspace.contract, ["Per Transaction Fee", "Per-Transaction Fee", "Per Transaction Fee ($)"]),
    ),
  };
}

function mapM02WorkspaceContractToArtifactValues(workspace: SchemaWorkspace) {
  const rateFor = (labels: string[]) => extractNumericValue(getContractValue(workspace.contract, labels));

  return {
    __entry_mode: "manual",
    commission_base: getContractValue(workspace.contract, "Commission Base"),
    delivery_active: "true",
    effective_date: getContractValue(workspace.contract, "Effective Date"),
    rate_catering: rateFor(["Catering / Group Orders Rate (%)", "Commission Rate"]),
    rate_delivery: rateFor(["Delivery Commission Rate (%)", "Commission Rate"]),
    rate_member: rateFor(["Member / DashPass Rate (%)", "Commission Rate"]),
    rate_pickup: rateFor(["Pickup / Carryout Rate (%)", "Commission Rate"]),
    rate_sponsored: rateFor(["In-App Sponsored Listing Rate (%)", "Commission Rate"]),
    store_id: getContractValue(workspace.contract, "Restaurant UUID"),
  };
}

function getContractValue(contract: SchemaWorkspace["contract"], labels: string | string[]) {
  const candidates = Array.isArray(labels) ? labels : [labels];
  for (const label of candidates) {
    const value = contract.find((field) => field.label === label)?.value?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function extractNumericValue(value: string) {
  return value.replace(/[^0-9.-]/g, "");
}

function deriveLocationWorkflowState({
  artifactIntakeState,
  location,
  onboardingProgress,
  schemaState,
  uploadState,
}: {
  artifactIntakeState: Record<string, IntakeState>;
  location: LocationRecord;
  onboardingProgress?: WgsOnboardingProgress;
  schemaState: SchemaWorkspace[];
  uploadState: UploadModule[];
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requirements: LocationWorkflowState["requirements"] = [];
  const activeModules = location.modules
    .map((module) => module.label)
    .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");
  const moduleReadiness: NonNullable<LocationWorkflowState["moduleReadiness"]> = {
    M01: { blockers: [], enabled: activeModules.includes("M01"), ready: false, warnings: [] },
    M02: { blockers: [], enabled: activeModules.includes("M02"), ready: false, warnings: [] },
  };

  const onboardingComplete = onboardingProgress?.completed || location.status !== "Onboarding";

  if (!onboardingComplete) {
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
  let anyModuleReady = false;

  for (const moduleId of activeModules) {
    const moduleBlockers: string[] = [];
    const moduleWarnings: string[] = [];
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
      moduleBlockers.push(message);
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
      moduleBlockers.push(message);
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
      moduleWarnings.push(`${moduleId} uploads are older than 31 days. Upload the current period evidence before rerun.`);
    }

    const moduleReady = onboardingComplete && moduleBlockers.length === 0;
    moduleReadiness[moduleId] = {
      blockers: moduleBlockers,
      enabled: true,
      ready: moduleReady,
      warnings: moduleWarnings,
    };
    anyModuleReady ||= moduleReady;

    if (moduleReady) {
      warnings.push(...moduleWarnings);
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

  if (!anyModuleReady) {
    blockers.push(
      ...activeModules.flatMap((moduleId) => moduleReadiness[moduleId].blockers),
    );
  } else {
    warnings.push(
      ...activeModules
        .filter((moduleId) => !moduleReadiness[moduleId].ready)
        .flatMap((moduleId) =>
          moduleReadiness[moduleId].blockers.map((message) => `${moduleId} blocked: ${message}`),
        ),
    );
  }

  const readyForCertification = anyModuleReady;
  const primaryAction = !onboardingComplete
    ? "onboarding"
    : !anyModuleReady && schemaBlocked
      ? "diy"
      : !anyModuleReady && uploadBlocked
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
    moduleReadiness,
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

    const moduleNotes = new Map<string, string>();

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

      const note =
        moduleMissing.length === 0
          ? latestUpdatedAt && isStaleArtifactDate(latestUpdatedAt)
            ? `${moduleId} setup is sealed, but the evidence set is stale and needs a current rerun package.`
            : `${moduleId} setup is sealed and the current period evidence package is ready for rerun.`
          : `${moduleId} rerun blocked by missing ${moduleMissing.join(", ")}.`;

      moduleNotes.set(moduleId, note);
    }

    const nextModules = location.modules
      .filter((module) => module.label === "M01" || module.label === "M02")
      .map((module) => {
        const nextState = moduleNotes.get(module.label);
        if (!nextState) return module;
        if (module.note !== nextState) {
          changed = true;
          locationChanged = true;
          return {
            ...module,
            note: nextState,
          };
        }
        return module;
      });

    if (nextModules.length !== location.modules.length) {
      changed = true;
      locationChanged = true;
    }

    return locationChanged ? { ...location, modules: nextModules } : location;
  });

  return changed ? next : locations;
}

function resolveModuleTemplate(
  modules: UploadModule[],
  accountId: string,
  moduleId: "M01" | "M02",
) {
  return buildScopedUploadModules(modules, accountId).find((module) => module.id === moduleId);
}

function resolveArtifactTemplate(
  modules: UploadModule[],
  accountId: string,
  moduleId: "M01" | "M02",
  artifactKey: string,
) {
  return resolveModuleTemplate(modules, accountId, moduleId)?.artifacts.find(
    (artifact) =>
      artifact.key === artifactKey ||
      artifact.key.startsWith(artifactKey) ||
      artifactKey.startsWith(artifact.key),
  );
}

function buildScopedUploadModules(modules: UploadModule[], accountId: string) {
  const baseTemplates = modules.filter(
    (module) => module.accountId === BASE_UPLOAD_TEMPLATE_ACCOUNT_ID,
  );
  const scopedModules = modules.filter((module) => module.accountId === accountId);

  const mergedBaseModules = baseTemplates.map((baseModule) => {
    const scopedModule = scopedModules.find((module) => module.id === baseModule.id);
    const matchedScopedArtifacts = new Set<string>();

    const artifacts = baseModule.artifacts.map((baseArtifact) => {
      const scopedArtifact = scopedModule?.artifacts.find((artifact) => {
        const matches =
          artifact.key === baseArtifact.key ||
          artifact.key.startsWith(baseArtifact.key) ||
          baseArtifact.key.startsWith(artifact.key);

        if (matches) {
          matchedScopedArtifacts.add(artifact.key);
        }

        return matches;
      });

      if (!scopedArtifact) {
        return {
          ...baseArtifact,
          note: "No upload received yet for this location.",
          status: "Missing" as const,
        };
      }

      return {
        ...baseArtifact,
        ...scopedArtifact,
      };
    });

    const additionalArtifacts =
      scopedModule?.artifacts.filter((artifact) => !matchedScopedArtifacts.has(artifact.key)) ?? [];

    return {
      ...baseModule,
      ...scopedModule,
      accountId,
      artifacts: [...artifacts, ...additionalArtifacts],
    };
  });

  const additionalModules = scopedModules.filter(
    (module) => !mergedBaseModules.some((baseModule) => baseModule.id === module.id),
  );

  return [...mergedBaseModules, ...additionalModules];
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
