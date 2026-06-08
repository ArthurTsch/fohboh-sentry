"use client";

import { startTransition, useDeferredValue, useState } from "react";
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
  Role,
  SchemaWorkspace,
  SessionState,
  SupportModeState,
  UploadArtifact,
  ViewId,
  WgsOnboardingProgress,
  WgsUser,
} from "./types";
import { formatCurrency, getSupportReply } from "./utils";
import { LandingPage } from "./views/LandingPage";

type ActiveArtifactState = {
  accountId: string;
  artifact: UploadArtifact;
  moduleId: "M01" | "M02";
};

type ActiveCertificationState = {
  locationId: string;
  locationName: string;
  ready: boolean;
  steps: { detail: string; done: boolean; label: string }[];
  trustScore: number;
};

export function SentryApp() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
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
  const [supportMode, setSupportMode] = useState<SupportModeState>({
    active: false,
    accountId: null,
    accountName: null,
  });

  const deferredFaqQuery = useDeferredValue(faqQuery);

  useSentryPersistence(
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
    locationState,
    schemaState,
    supportMode,
    uploadState,
  });

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

  function getArtifactStateKey(accountId: string, moduleId: "M01" | "M02", artifactKey: string) {
    return `${accountId}:${moduleId}:${artifactKey}`;
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

  function deriveModuleScore(accountId: string, moduleId: "M01" | "M02") {
    const module = uploadState.find((item) => item.accountId === accountId && item.id === moduleId);
    if (!module) return 0;

    const artifacts = module.artifacts.length;
    const readyCount = module.artifacts.filter((artifact) => artifact.status === "Ready").length;
    const reviewCount = module.artifacts.filter((artifact) => artifact.status === "Needs Review").length;
    const uploadBonus = module.artifacts.reduce((sum, artifact) => {
      const intake = artifactIntakeState[getArtifactStateKey(accountId, moduleId, artifact.key)];
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

  function handleLogin(email: string, role: Role) {
    startTransition(() => {
      setSession({ email, role });
      setActiveView(role === "WGS Manager" ? "wgs" : "dashboard");
    });
  }

  function handleSignOut() {
    startTransition(() => {
      setSession(null);
      setSelectedCaar(null);
      setChatOpen(false);
      setMessages(initialMessages);
      setActiveView("dashboard");
      setShowAddLocation(false);
      setShowRequestAccess(false);
      setActiveOnboardingLocation(null);
      setEditingWorkspace(null);
      setEditingWgsUser(null);
      setCreatingWgsUser(false);
      setActiveArtifact(null);
      setActiveChecklist(null);
      setActiveCertification(null);
      setSupportMode({ active: false, accountId: null, accountName: null });
    });
  }

  function handleViewChange(view: ViewId) {
    startTransition(() => setActiveView(view));
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

  function handleAddLocation(draft: AddLocationDraft) {
    const newId = draft.locId.trim() || `LOC-${100 + locationState.length + 1}`;
    const location = {
      accountId: supportMode.accountId ?? "C001",
      id: newId,
      name: draft.name,
      market: draft.address || "New market",
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

    setLocationState((current) => [...current, location]);
    setWgsOnboardingState((current) => ({
      ...current,
      [location.id]: createWgsOnboardingProgress(),
    }));
    setShowAddLocation(false);
    setActiveView("onboarding");
    setActiveOnboardingLocation(location.id);
    appendLog({
      accountId: location.accountId,
      action: `Location added for onboarding: ${location.name}`,
      immutable: false,
      location: location.name,
    });
    showToast(`${draft.name} added. WGS onboarding plan created.`);
  }

  async function handleArtifactFileSelected(file: File) {
    if (!activeArtifact) return;
    const key = getArtifactStateKey(
      activeArtifact.accountId,
      activeArtifact.moduleId,
      activeArtifact.artifact.key,
    );
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashValue = Array.from(new Uint8Array(hashBuffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 12);
    const text = activeArtifact.artifact.type === "CSV" ? await file.text() : "";
    const rows =
      activeArtifact.artifact.type === "CSV"
        ? Math.max(text.split(/\r?\n/).filter(Boolean).length - 1, 0)
        : undefined;

    setArtifactIntakeState((state) => ({
      ...state,
      [key]: {
        uploaded: true,
        hash: false,
        schema: false,
        fields: false,
        fileName: file.name,
        rows,
        hashValue,
      },
    }));
    setUploadState((current) =>
      current.map((module) =>
        module.accountId === activeArtifact.accountId && module.id === activeArtifact.moduleId
          ? {
              ...module,
              artifacts: module.artifacts.map((artifact) =>
                artifact.key === activeArtifact.artifact.key
                  ? {
                      ...artifact,
                      status: "Needs Review",
                      note: `${file.name} uploaded. ${rows ?? "PDF"} rows/pages recorded, awaiting hash and schema validation.`,
                    }
                  : artifact,
              ),
            }
          : module,
      ),
    );
    appendLog({
      accountId: activeArtifact.accountId,
      action: `${activeArtifact.artifact.label} uploaded into ${activeArtifact.moduleId}`,
      immutable: true,
      location: supportMode.accountName ?? "Portfolio",
    });
    showToast(`${file.name} uploaded and hashed.`);
  }

  function handleArtifactAction(moduleId: "M01" | "M02", artifactKey: string) {
    const module = visibleUploadModules.find((item) => item.id === moduleId);
    const artifact = module?.artifacts.find((item) => item.key === artifactKey);
    if (!module || !artifact) return;
    setActiveArtifact({ accountId: module.accountId, artifact, moduleId });
  }

  function handleArtifactChecklist(moduleId: "M01" | "M02", artifactKey: string) {
    const module = visibleUploadModules.find((item) => item.id === moduleId);
    const artifact = module?.artifacts.find((item) => item.key === artifactKey);
    if (!module || !artifact) return;
    setActiveChecklist({ accountId: module.accountId, artifact, moduleId });
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
      accountId: "C001",
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
      activeArtifact.moduleId,
      activeArtifact.artifact.key,
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
      location: supportMode.accountName ?? "Portfolio",
    });
  }

  function handleArtifactContractFieldChange(fieldId: string, value: string) {
    if (!activeArtifact) return;
    const key = getArtifactStateKey(
      activeArtifact.accountId,
      activeArtifact.moduleId,
      activeArtifact.artifact.key,
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
    setActiveView("dashboard");
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
    const location = locationState.find((item) => item.id === locationId);
    const progress = wgsOnboardingState[locationId];
    if (!location || !progress) return;

    const uploadCount = Object.keys(progress.uploads).length;
    setLocationState((current) =>
      current.map((item) =>
        item.id === locationId
          ? {
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
            }
          : item,
      ),
    );
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
      accountId: "C001",
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
      accountId: "C001",
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
    setWgsApprovalState((current) => [
      {
        id: nextId,
        account: draft.company,
        type: "Access Request",
        summary: `${draft.email} requested ${draft.modules.join(" + ")} access for ${draft.locations} location(s).`,
      },
      ...current,
    ]);
    appendLog({
      accountId: "C001",
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
    const accountName = supportMode.accountName ?? "Dominos NTX - Dallas";
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
      accountId: supportMode.accountId ?? "C001",
      action: `Support ticket created: ${message}`,
      immutable: false,
      location: accountName,
    });
    showToast("Support ticket added to the WGS queue.");
  }

  function handleRunCertification(locationId: string) {
    const location = locationState.find((item) => item.id === locationId);
    if (!location) return;

    const m01Score = deriveModuleScore(location.accountId, "M01");
    const m02Score = deriveModuleScore(location.accountId, "M02");
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

    setLocationState((current) =>
      current.map((item) =>
        item.id === locationId
          ? {
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
            }
          : item,
      ),
    );
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

  if (!session) {
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
  const navGroups =
    session.role === "WGS Manager"
      ? [...navigation, { section: "Admin", items: [{ id: "wgs" as ViewId, label: "WGS Admin", icon: "🛠" }] }]
      : navigation;

  const activeOnboardingRecord =
    (activeOnboardingLocation
      ? locationState.find((item) => item.id === activeOnboardingLocation)
      : null) ?? null;

  const activeArtifactStateKey = activeArtifact
    ? getArtifactStateKey(activeArtifact.accountId, activeArtifact.moduleId, activeArtifact.artifact.key)
    : null;
  const activeChecklistStateKey = activeChecklist
    ? getArtifactStateKey(activeChecklist.accountId, activeChecklist.moduleId, activeChecklist.artifact.key)
    : null;

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
        session={session}
        supportMode={supportMode}
        visibleLocationCount={visibleLocations.length}
      >
        <SentryViewRouter
          accounts={wgsAccountState}
          activeView={activeView}
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
          onEnterSupportMode={handleEnterSupportMode}
          onExpandAll={handleExpandAll}
          onFilterChange={setLogFilter}
          onOpenCaar={setSelectedCaar}
          onOpenChecklist={handleArtifactChecklist}
          onOpenOnboarding={handleOpenOnboarding}
          onOpenSchemaEditor={setEditingWorkspace}
          onOpenUploads={() => handleViewChange("uploads")}
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
          role={session.role}
          schemaWorkspaces={visibleSchemaWorkspaces}
          totalCaars={totalCaars}
          totalRecovery={totalRecovery}
          uploadModules={visibleUploadModules}
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
          uploadModules={visibleUploadModules}
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
