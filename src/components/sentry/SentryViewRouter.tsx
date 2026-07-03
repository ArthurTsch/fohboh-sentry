import type { Dispatch, SetStateAction } from "react";
import type {
  CaarRecord,
  IntakeState,
  LocationRecord,
  LocationWorkflowState,
  LogRecord,
  Role,
  SchemaWorkspace,
  SessionState,
  UploadModule,
  UploadReceipt,
  ViewId,
  WgsAccount,
  WgsApproval,
  WgsQueueItem,
  WgsUser,
} from "./types";
import { CaarListView } from "./views/CaarListView";
import { DashboardView } from "./views/DashboardView";
import { DiyAccessView } from "./views/DiyAccessView";
import { FaqView } from "./views/FaqView";
import { LogView } from "./views/LogView";
import { OnboardingView } from "./views/OnboardingView";
import { PermissionsView } from "./views/PermissionsView";
import { ProfileView } from "./views/ProfileView";
import { SchemaRegistryView } from "./views/SchemaRegistryView";
import { UploadCenterView } from "./views/UploadCenterView";
import { UserGuideView } from "./views/UserGuideView";
import { WaterfallView } from "./views/WaterfallView";
import { WgsAdminView } from "./views/WgsAdminView";

export function SentryViewRouter({
  accounts,
  activeView,
  activeUploadLocationId,
  activeUploadLocationName,
  approvals,
  averageTrust,
  artifactContractState,
  artifactIntakeState,
  caars,
  completed,
  expandedLocations,
  faqOpen,
  faqQuery,
  filteredFaq,
  filteredLogs,
  locations,
  logFilter,
  onAddLocation,
  onAddUser,
  onApprove,
  onArtifactAction,
  onDirectUpload,
  onEnterSupportMode,
  onExpandAll,
  onFilterChange,
  onOpenCaar,
  onDownloadPdf,
  onOpenDiy,
  onOpenOnboarding,
  onOpenSchemaEditor,
  onOpenUploads,
  onOpenUser,
  onInitializeWorkspace,
  onQueryChange,
  onResolveQueue,
  onRunCertification,
  onSealWorkspace,
  onToggleChecklist,
  onToggleLocation,
  onToggleQuestion,
  onViewChange,
  queue,
  role,
  schemaWorkspaces,
  session,
  totalCaars,
  totalRecovery,
  uploadFeedback,
  uploadModules,
  users,
  workflowByLocation,
}: {
  accounts: WgsAccount[];
  activeView: ViewId;
  activeUploadLocationId: string | null;
  activeUploadLocationName: string | null;
  approvals: WgsApproval[];
  averageTrust: number;
  artifactContractState: Record<string, Record<string, string>>;
  artifactIntakeState: Record<string, IntakeState>;
  caars: CaarRecord[];
  completed: Record<string, boolean[]>;
  expandedLocations: string[];
  faqOpen: string | null;
  faqQuery: string;
  filteredFaq: { answer: string; question: string; topic: string }[];
  filteredLogs: LogRecord[];
  locations: LocationRecord[];
  logFilter: "all" | "immutable" | "editable";
  onAddLocation: () => void;
  onAddUser: () => void;
  onApprove: (approvalId: string) => void | Promise<void>;
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
  onEnterSupportMode: (accountId: string) => void;
  onExpandAll: () => void;
  onFilterChange: (filter: "all" | "immutable" | "editable") => void;
  onOpenCaar: Dispatch<SetStateAction<CaarRecord | null>>;
  onDownloadPdf: (record: CaarRecord) => void;
  onOpenOnboarding: (locationId: string) => void;
  onOpenSchemaEditor: Dispatch<SetStateAction<SchemaWorkspace | null>>;
  onOpenUploads: (locationId: string) => void;
  onOpenUser: Dispatch<SetStateAction<WgsUser | null>>;
  onInitializeWorkspace: (locationId: string, module: "M01" | "M02", vendor?: string) => void;
  onOpenDiy: () => void;
  onQueryChange: Dispatch<SetStateAction<string>>;
  onResolveQueue: (ticketId: string) => void | Promise<void>;
  onRunCertification: (locationId: string) => void;
  onSealWorkspace: (workspace: SchemaWorkspace) => void | Promise<void>;
  onToggleChecklist: (stepId: string, itemIndex: number) => void;
  onToggleLocation: (id: string) => void;
  onToggleQuestion: (question: string) => void;
  onViewChange: (view: ViewId) => void;
  queue: WgsQueueItem[];
  role: Role;
  schemaWorkspaces: SchemaWorkspace[];
  session: SessionState;
  totalCaars: number;
  totalRecovery: string;
  uploadFeedback: UploadReceipt | null;
  uploadModules: UploadModule[];
  users: WgsUser[];
  workflowByLocation: Record<string, LocationWorkflowState>;
}) {
  if (activeView === "dashboard") {
    return (
      <DashboardView
        averageTrust={averageTrust}
        locations={locations}
        logs={filteredLogs}
        openLog={() => onViewChange("log")}
        totalRecovery={totalRecovery}
        totalCaars={totalCaars}
        openWaterfall={() => onViewChange("waterfall")}
      />
    );
  }

  if (activeView === "waterfall") {
    return (
      <WaterfallView
        caars={caars}
        expandedLocations={expandedLocations}
        locations={locations}
        onAddLocation={onAddLocation}
        onExpandAll={onExpandAll}
        onOpenCaar={onOpenCaar}
        onOpenDiy={onOpenDiy}
        onOpenOnboarding={onOpenOnboarding}
        onOpenSchema={() => onViewChange("schema")}
        onRunCertification={onRunCertification}
        onToggleLocation={onToggleLocation}
        onOpenUploads={onOpenUploads}
        role={role}
        workflowByLocation={workflowByLocation}
      />
    );
  }

  if (activeView === "caars") {
    return <CaarListView onDownloadPdf={onDownloadPdf} onOpenCaar={onOpenCaar} records={caars} />;
  }

  if (activeView === "log") {
    return <LogView entries={filteredLogs} filter={logFilter} onFilterChange={onFilterChange} />;
  }

  if (activeView === "profile") {
    return <ProfileView session={session} visibleLocationCount={locations.length} />;
  }

  if (activeView === "permissions") {
    return <PermissionsView />;
  }

  if (activeView === "diy") {
    return (
        <DiyAccessView
        locations={locations}
          onEditWorkspace={onOpenSchemaEditor}
          onInitializeWorkspace={onInitializeWorkspace}
          onSealWorkspace={onSealWorkspace}
          role={role}
        workspaces={schemaWorkspaces}
      />
    );
  }

  if (activeView === "userguide") {
    return <UserGuideView />;
  }

  if (activeView === "faq") {
    return (
      <FaqView
        items={filteredFaq}
        query={faqQuery}
        openQuestion={faqOpen}
        onQueryChange={onQueryChange}
        onToggleQuestion={onToggleQuestion}
      />
    );
  }

  if (activeView === "uploads") {
    return (
      <UploadCenterView
        activeLocationId={activeUploadLocationId}
        activeLocationName={activeUploadLocationName}
        contractState={artifactContractState}
        intakeState={artifactIntakeState}
        modules={uploadModules}
        onArtifactAction={onArtifactAction}
        onDirectUpload={onDirectUpload}
        onOpenSchema={() => onViewChange("schema")}
        uploadFeedback={uploadFeedback}
      />
    );
  }

  if (activeView === "schema") {
    return (
      <SchemaRegistryView
        workspaces={schemaWorkspaces}
        onEditWorkspace={onOpenSchemaEditor}
        onSealWorkspace={onSealWorkspace}
      />
    );
  }

  if (activeView === "onboarding") {
    return (
      <OnboardingView
        completed={completed}
        onToggleChecklist={onToggleChecklist}
        onOpenSchema={() => onViewChange("schema")}
        onOpenUploads={() => {
          if (activeUploadLocationId) {
            onOpenUploads(activeUploadLocationId);
          } else if (locations[0]) {
            onOpenUploads(locations[0].id);
          } else {
            onViewChange("uploads");
          }
        }}
      />
    );
  }

  return (
    <WgsAdminView
      accounts={accounts}
      approvals={approvals}
      onAddUser={onAddUser}
      onApprove={onApprove}
      onEnterSupportMode={onEnterSupportMode}
      onOpenUser={onOpenUser}
      onResolveQueue={onResolveQueue}
      queue={queue}
      users={users}
    />
  );
}
