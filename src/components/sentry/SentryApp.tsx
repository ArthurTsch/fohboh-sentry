"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  useSyncExternalStore,
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
import { formatCurrency, getSupportReply } from "./utils";
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

const vendorTemplateHeaders: Record<string, string[]> = {
  heartland:
    "trans_date,trans_id,card_type,trans_amount,fee_amount,disc_rate,disc_amount,auth_code,terminal_id,batch_id,card_number_last4,trans_type".split(","),
  toast:
    "date,batch_date,pos_merchant_sales,platform_net_sales,transaction_fees,processing_fees,other_merchant_fees,calculated_recovery_variance,bank_deposit_amount,card_type,entry_method,interchange_rate_applied,transaction_count,notes".split(","),
  square:
    "date,transaction_id,amount,fee,net_total,card_brand,pan_suffix,device_name,location_name,description,refund_id,dispute_id".split(","),
  worldpay:
    "txn_date,txn_id,card_brand,txn_amount,disc_rate,disc_amount,interchange_amount,assessment,terminal_id,batch_number,auth_number".split(","),
  chase:
    "transaction_date,transaction_id,card_type,transaction_amount,disc_rate,disc_amount,interchange_fee,service_fee,authorization_number,mid".split(","),
  ubereats:
    "date,order_id,item_subtotal,commission_charged,commission_rate_applied,platform_gross_sales,order_status,delivery_fee,tip,tax,settlement_date,menu_item_count,channel,notes".split(","),
  doordash:
    "order_date,store_id,order_id,order_subtotal,dd_commission_rate,dd_commission_amount,dd_marketing_fee,error_charge,consumer_fee,payout_amount,order_status".split(","),
  grubhub:
    "date,restaurant_id,order_id,restaurant_food_sales,grubhub_commission,marketing_fee,tax_remitted,adjustment_amount,net_payout,order_type".split(","),
  slice:
    "order_date,store_id,order_id,order_subtotal,slice_commission,marketing_contribution,adjustment,tax,net_payout".split(","),
};

type ActiveCertificationState = {
  locationId: string;
  locationName: string;
  ready: boolean;
  steps: { detail: string; done: boolean; label: string }[];
  trustScore: number;
};

const SESSION_STORAGE_KEY = "sentry-session";
const SESSION_CHANGE_EVENT = "sentry-session-change";
let cachedSessionRaw: string | null = null;
let cachedSessionValue: SessionState | null = null;
const BASE_UPLOAD_TEMPLATE_ACCOUNT_ID = "C001";

function readSavedSession(): SessionState | null {
  if (typeof window === "undefined") return null;

  const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!savedSession) {
    cachedSessionRaw = null;
    cachedSessionValue = null;
    return null;
  }

  if (savedSession === cachedSessionRaw) {
    return cachedSessionValue;
  }

  try {
    cachedSessionRaw = savedSession;
    cachedSessionValue = JSON.parse(savedSession) as SessionState;
    return cachedSessionValue;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    cachedSessionRaw = null;
    cachedSessionValue = null;
    return null;
  }
}

function subscribeToSessionStore(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SESSION_STORAGE_KEY) {
      callback();
    }
  };

  const handleSessionChange = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SESSION_CHANGE_EVENT, handleSessionChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SESSION_CHANGE_EVENT, handleSessionChange);
  };
}

type DatabaseRestaurant = {
  city: string | null;
  country: string | null;
  created_by: number | null;
  id: number;
  location: string | null;
  name: string;
  state: string | null;
  store_id: string | null;
  unit_id: string | null;
};

export function SentryApp() {
  const persistedSession = useSyncExternalStore(
    subscribeToSessionStore,
    readSavedSession,
    () => null,
  );
  const [session, setSession] = useState<SessionState | null>(null);
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

  const effectiveSession = session ?? persistedSession;
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

  async function syncAssignedRestaurants(
    sessionState: SessionState | null = effectiveSession,
  ) {
    if (!sessionState || !persistenceHydrated) {
      return;
    }

    const params = new URLSearchParams({
      email: sessionState.email,
      role: sessionState.role,
    });

    if (typeof sessionState.managerId === "number") {
      params.set("managerId", String(sessionState.managerId));
    }

    const response = await fetch(`/api/restaurants?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      restaurants?: DatabaseRestaurant[];
    };

    setAssignedLocationState(
      mapAssignedRestaurantsToLocations(payload.restaurants ?? [], sessionState),
    );
  }

  useEffect(() => {
    if (!effectiveSession || !persistenceHydrated) return;

    let cancelled = false;

    async function run() {
      const sessionState = effectiveSession;
      if (!sessionState) {
        return;
      }
      const params = new URLSearchParams({
        email: sessionState.email,
        role: sessionState.role,
      });

      if (typeof sessionState.managerId === "number") {
        params.set("managerId", String(sessionState.managerId));
      }

      const response = await fetch(`/api/restaurants?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok || cancelled) {
        return;
      }

      const payload = (await response.json()) as {
        restaurants?: DatabaseRestaurant[];
      };

      if (cancelled) {
        return;
      }

      setAssignedLocationState(
        mapAssignedRestaurantsToLocations(payload.restaurants ?? [], sessionState),
      );
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [effectiveSession, persistenceHydrated]);

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

  function deriveModuleScore(accountId: string, locationId: string, moduleId: "M01" | "M02") {
    const uploadModule = uploadState.find((item) => item.accountId === accountId && item.id === moduleId);
    if (!uploadModule) return 0;

    const artifacts = uploadModule.artifacts.length;
    const artifactStates = uploadModule.artifacts.map((artifact) => {
      const prefix = `${accountId}:${locationId}:${moduleId}:${artifact.key}:`;
      const matches = Object.entries(artifactIntakeState)
        .filter(([key, value]) => key.startsWith(prefix) && value.uploaded)
        .map(([, value]) => value);
      const bestMatch = matches.find((value) => value.hash && value.schema && value.fields) ?? matches[0] ?? null;
      return { artifact, intake: bestMatch };
    });
    const readyCount = artifactStates.filter(
      ({ intake }) => intake?.uploaded && intake.hash && intake.schema && intake.fields,
    ).length;
    const reviewCount = artifactStates.filter(
      ({ intake }) => intake?.uploaded && !(intake.hash && intake.schema && intake.fields),
    ).length;
    const uploadBonus = uploadModule.artifacts.reduce((sum, artifact) => {
      const prefix = `${accountId}:${locationId}:${moduleId}:${artifact.key}:`;
      const intake =
        Object.entries(artifactIntakeState).find(([key, value]) => key.startsWith(prefix) && value.uploaded)?.[1] ??
        null;
      return sum + (intake?.uploaded ? 4 : 0) + (intake?.hash ? 4 : 0);
    }, 0);

    const base = readyCount * 18 + reviewCount * 8 + uploadBonus + 20;
    return Math.max(48, Math.min(98, Math.round(base / Math.max(artifacts, 1))));
  }

  function buildCaarDimensions(m01Score: number, m02Score: number, ready: boolean) {
    const avg = Math.round((m01Score + m02Score) / 2);
    return [
      { name: "Data Completeness", score: Math.min(98, avg + 3), weight: "25%" },
      { name: "Rule Integrity", score: Math.min(97, avg + 1), weight: "20%" },
      {
        name: "Cross-System Reconciliation",
        score: ready ? Math.min(95, avg) : Math.max(55, avg - 12),
        weight: "25%",
      },
      {
        name: "Source Authenticity",
        score: ready ? Math.min(96, avg + 2) : Math.max(50, avg - 8),
        weight: "15%",
      },
      { name: "Auditability", score: Math.min(94, avg), weight: "10%" },
      { name: "Data Freshness", score: Math.min(92, avg + 4), weight: "5%" },
    ];
  }

  function handleLogin(nextSession: SessionState) {
    startTransition(() => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
      setSession(nextSession);
      if (nextSession.role !== "WGS Manager") {
        setSupportMode({ active: false, accountId: null, accountName: null });
      }
      setActiveViewOverride(nextSession.role === "WGS Manager" ? "wgs" : "dashboard");
    });
  }

  function handleSignOut() {
    startTransition(() => {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
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
        name: string;
        unitId?: string | null;
      };
    };
    const createdRestaurant = payload.restaurant;
    const locationId =
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
    const resolvedVendorKey = vendor?.key ?? target.vendorKey;
    const resolvedVendorName = vendor?.name ?? target.vendorName;
    const locationScopedKey = getArtifactStateKey(
      target.accountId,
      target.locationId,
      target.moduleId,
      target.artifact.key,
      resolvedVendorKey,
    );
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashValue = Array.from(new Uint8Array(hashBuffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 12);
    const text = target.artifact.type === "CSV" ? await file.text() : "";
    const rows =
      target.artifact.type === "CSV"
        ? Math.max(text.split(/\r?\n/).filter(Boolean).length - 1, 0)
        : undefined;
    const headers =
      target.artifact.type === "CSV"
        ? (text.split(/\r?\n/, 1)[0] ?? "")
            .split(",")
            .map((header) => header.trim())
            .filter(Boolean)
        : [];
    const expectedHeaders = resolvedVendorKey ? vendorTemplateHeaders[resolvedVendorKey] ?? [] : [];
    const matchedColumns = expectedHeaders.filter((header) => headers.includes(header));
    const unmatchedHeaders = expectedHeaders.filter((header) => !headers.includes(header));
    const matchPct =
      expectedHeaders.length > 0 ? Math.round((matchedColumns.length / expectedHeaders.length) * 100) : undefined;
    const schemaOk = target.artifact.type === "CSV" ? (matchPct === undefined ? false : matchPct >= 60) : true;
    const fieldsOk = target.artifact.type === "CSV" ? schemaOk && (rows ?? 0) > 0 : true;

    setArtifactIntakeState((state) => ({
      ...state,
      [locationScopedKey]: {
        uploaded: true,
        hash: true,
        schema: schemaOk,
        fields: fieldsOk,
        fileName: file.name,
        rows,
        hashValue,
        vendorKey: resolvedVendorKey,
        vendorName: resolvedVendorName,
        sizeBytes: file.size,
        matchPct,
        matchedColumns: matchedColumns.length || undefined,
        expectedColumns: expectedHeaders.length || undefined,
        unmatchedHeaders: unmatchedHeaders.length > 0 ? unmatchedHeaders : undefined,
      },
    }));
    setUploadState((current) =>
      current.map((module) =>
        module.accountId === target.accountId && module.id === target.moduleId
          ? {
              ...module,
              artifacts: module.artifacts.map((artifact) =>
                artifact.key === target.artifact.key
                  ? {
                      ...artifact,
                      status: schemaOk && fieldsOk ? "Ready" : "Needs Review",
                      note:
                        target.artifact.type === "CSV" && matchPct !== undefined
                          ? `${file.name} uploaded. Schema match ${matchPct}%. ${
                              fieldsOk ? "Ready for certification intake." : "WGS review required."
                            }`
                          : `${file.name} uploaded. PDF sealed with intake hash and ready for downstream review.`,
                    }
                  : artifact,
              ),
            }
          : module,
      ),
    );
    appendLog({
      accountId: target.accountId,
      action: `${target.artifact.label} uploaded into ${target.moduleId}`,
      immutable: true,
      location: target.locationName,
    });
    const receipt: UploadReceipt = {
      fileName: file.name,
      locationId: target.locationId,
      locationName: target.locationName,
      matchPct,
      moduleId: target.moduleId,
      rows,
      sizeBytes: file.size,
      status: schemaOk && fieldsOk ? "ready" : "review",
      vendorName: resolvedVendorName,
    };
    setUploadFeedback(receipt);
    showToast(`${file.name} uploaded and hashed.`);
    return receipt;
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

  function handleArtifactChecklist(
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendor?: { key: string; name: string },
  ) {
    const targetLocation = activeUploadLocation ?? visibleLocations[0];
    const uploadModule = targetLocation
      ? resolveUploadModulesForAccount(targetLocation.accountId).find((item) => item.id === moduleId)
      : null;
    const artifact = uploadModule?.artifacts.find((item) => item.key === artifactKey);
    if (!uploadModule || !artifact || !targetLocation) return;
    setActiveChecklist({
      accountId: uploadModule.accountId,
      artifact,
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
    setOnboardingState((current) => ({
      ...current,
      [stepId]: current[stepId].map((item, index) => (index === itemIndex ? !item : item)),
    }));
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
      next = {
        ...current,
        uploaded: true,
        hash: requiredSatisfied,
        schema: requiredSatisfied,
        fields: requiredSatisfied,
      };
    } else {
      next = current.uploaded
        ? current.hash
          ? current.schema
            ? {
                ...current,
                fields: true,
              }
            : {
                ...current,
                schema: true,
              }
          : {
              ...current,
              hash: true,
            }
        : {
            uploaded: true,
            hash: false,
            schema: false,
            fields: false,
            fileName: `${activeArtifact.artifact.key}.csv`,
            rows: Math.floor(Math.random() * 1800) + 120,
            hashValue: Math.random().toString(16).slice(2, 14),
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
    setActiveOnboardingLocation(null);
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

    const m01Score = deriveModuleScore(location.accountId, location.id, "M01");
    const m02Score = deriveModuleScore(location.accountId, location.id, "M02");
    const trustScore = Math.round((m01Score + m02Score) / 2);
    const ready = trustScore >= 85;
    const amountValue = Math.max(12000, Math.round((m01Score * 180 + m02Score * 160) * 1.3));
    const dimensions = buildCaarDimensions(m01Score, m02Score, ready);
    const period = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const caarId = `CAAR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${location.id.replace("LOC-", "")}`;
    const nextRecord: CaarRecord = {
      accountId: location.accountId,
      amount: formatCurrency(amountValue),
      dimensions,
      exhibits: uploadState
        .filter((module) => module.accountId === location.accountId)
        .reduce((sum, module) => sum + module.artifacts.length, 0),
      findings: ready
        ? [
            `Certification run cleared release gates for ${location.name}.`,
            `Cross-system reconciliation now supports a legal-grade recovery position.`,
            `Current recovery variance is supported by the active sealed schema and intake evidence.`,
          ]
        : [
            `Certification completed for ${location.name}, but release is blocked by evidence or reconciliation gaps.`,
            `Trust Score remains below the CAAR threshold and requires further intake remediation.`,
            `Review missing upload readiness and schema controls before external delivery.`,
          ],
      id: caarId,
      locationId,
      locationName: location.name,
      narrative: ready
        ? "The certification engine completed all four phases and produced a release-grade CAAR candidate."
        : "The certification engine completed, but one or more evidence gates still block court-admissible release.",
      period,
      status: ready ? "Court Admissible" : "Needs Remediation",
      trustScore,
    };

    updateRuntimeLocation(locationId, (item) => ({
      ...item,
      lastCertified: new Date().toISOString().slice(0, 10),
      m01: m01Score,
      m02: m02Score,
      modules: item.modules.map((module) =>
        module.label === "M01"
          ? {
              ...module,
              score: m01Score,
              note: ready
                ? "Certification run completed and locked."
                : "Certification completed with unresolved release controls.",
            }
          : module.label === "M02"
            ? {
                ...module,
                score: m02Score,
                note: ready
                  ? "Delivery evidence package cleared release."
                  : "Delivery evidence package still requires remediation.",
              }
            : {
                ...module,
                score: ready ? 94 : 76,
                note: ready
                  ? "Evidence chain and intake verification are complete."
                  : "Evidence chain is present but still missing one or more release checks.",
              },
      ),
      recovery: formatCurrency(amountValue),
      status: ready ? "Certified" : "At Risk",
    }));
    setCaarState((current) => [nextRecord, ...current.filter((item) => item.locationId !== locationId)]);
    appendLog({
      accountId: location.accountId,
      action: `Certification completed for ${location.name}`,
      immutable: true,
      location: location.name,
    });
    setActiveCertification({
      locationId,
      locationName: location.name,
      ready,
      steps: [
        {
          done: true,
          label: "Define Semantic Truths",
          detail: "Native uploads and contract evidence were validated against the active schema.",
        },
        {
          done: true,
          label: "Define Deterministic Law",
          detail: "Governed rules and sealed contract config were bound for this run.",
        },
        {
          done: true,
          label: "Execute Loop A",
          detail: "M01 and M02 module scoring completed with deterministic rule application.",
        },
        {
          done: true,
          label: "Certify & Lock",
          detail: ready
            ? "Vault write and CAAR candidate generation completed."
            : "Run completed, but release remains blocked pending remediation.",
        },
      ],
      trustScore,
    });
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
          onOpenChecklist={handleArtifactChecklist}
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
        restaurant.unit_id?.trim() ||
        restaurant.store_id?.trim() ||
        `LOC-DB-${restaurant.id}`;

      return {
        accountId:
          session.role === "WGS Manager"
            ? `mgr:${restaurant.created_by ?? restaurant.id}`
            : session.accountId ?? `mgr:${session.email.toLowerCase()}`,
        id: locationId,
        name: restaurant.name,
        market,
        ownerEmail: session.role === "WGS Manager" ? undefined : session.email,
        ownerManagerId: restaurant.created_by,
        m01: 0,
        m02: 0,
        ium: "--",
        recovery: "$0",
        status: "Onboarding" as const,
        lastCertified: "Pending",
        modules: [
          {
            label: "Evidence",
            score: 0,
            note: "Assigned from admin. Onboarding, uploads, and first certification are still pending.",
          },
        ],
      };
    });
}

function getRestaurantMarket(restaurant: Pick<DatabaseRestaurant, "city" | "country" | "location" | "state">) {
  return (
    [restaurant.city, restaurant.state].filter(Boolean).join(", ") ||
    restaurant.location?.trim() ||
    restaurant.country?.trim() ||
    "New market"
  );
}
