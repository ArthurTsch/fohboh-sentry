import type { Dispatch, SetStateAction } from "react";
import type {
  CaarRecord,
  IntakeState,
  LocationSourceConfig,
  LocationRecord,
  LocationWorkflowState,
  LogRecord,
  PermissionRecord,
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
import { BillingView } from "./views/BillingView";
import { DashboardView } from "./views/DashboardView";
import { DiyAccessView } from "./views/DiyAccessView";
import { FaqView } from "./views/FaqView";
import { LogView } from "./views/LogView";
import { LocationWorkspaceView } from "./views/LocationWorkspaceView";
import { OnboardingView } from "./views/OnboardingView";
import { PermissionsView } from "./views/PermissionsView";
import { ProfileView } from "./views/ProfileView";
import { SchemaRegistryView } from "./views/SchemaRegistryView";
import { SupportTicketsView } from "./views/SupportTicketsView";
import { UploadCenterView } from "./views/UploadCenterView";
import { UserGuideView } from "./views/UserGuideView";
import { WaterfallView } from "./views/WaterfallView";
import { WgsAdminView } from "./views/WgsAdminView";

export function SentryViewRouter({
  accounts,
  activeView,
  activeUploadArtifactHint,
  activeUploadLocationId,
  activeUploadModuleHint,
  activeUploadModules,
  activeUploadLocationName,
  activeSupportAccountId,
  activeSupportAccountName,
  activeWorkspaceLocationId,
  activeUploadSourceConfig,
  activeUploadVendorKeyHint,
  activeUploadVendorNameHint,
  diyLocationSourceConfigs,
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
  hasTeamAccount,
  locations,
  logFilter,
  onAddLocation,
  onAddUser,
  onApprove,
  onCompleteUploadSet,
  onManageUploadSources,
  onDirectUpload,
  onGoToTeamAccess,
  onRemoveUpload,
  onResetLocationUploads,
  onEnterSupportMode,
  onExpandAll,
  onFilterChange,
  onOpenCaar,
  onOpenLocation,
  onOpenDiy,
  onOpenOnboarding,
  onOpenSchemaEditor,
  onOpenUploads,
  onOpenUser,
  onInitializeWorkspace,
  onSupportTicketCreated,
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
  permissionRecords,
  totalCaars,
  totalRecovery,
  uploadFeedback,
  uploadModules,
  users,
  workflowByLocation,
}: {
  accounts: WgsAccount[];
  activeView: ViewId;
  activeUploadArtifactHint?: string | null;
  activeUploadLocationId: string | null;
  activeUploadModuleHint?: "M01" | "M02" | null;
  activeUploadModules: Array<"M01" | "M02">;
  activeUploadLocationName: string | null;
  activeSupportAccountId: string | null;
  activeSupportAccountName: string;
  activeWorkspaceLocationId: string | null;
  activeUploadSourceConfig: LocationSourceConfig | null;
  activeUploadVendorKeyHint?: string | null;
  activeUploadVendorNameHint?: string | null;
  diyLocationSourceConfigs: Record<string, LocationSourceConfig>;
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
  hasTeamAccount: boolean;
  locations: LocationRecord[];
  logFilter: "all" | "immutable" | "editable";
  onAddLocation: () => void;
  onAddUser: () => void;
  onApprove: (approvalId: string) => void | Promise<void>;
  onCompleteUploadSet: (locationId: string, moduleId: "M01" | "M02") => void;
  onManageUploadSources: (locationId: string, next: {
    m01Enabled: boolean;
    m01Vendors: string[];
    m02Enabled: boolean;
    m02Vendors: string[];
  }) => void;
  onDirectUpload: (
    moduleId: "M01" | "M02",
    artifactKey: string,
    file: File,
    vendor?: { key: string; name: string },
  ) => Promise<UploadReceipt | null>;
  onGoToTeamAccess: () => void;
  onRemoveUpload: (
    moduleId: "M01" | "M02",
    artifactKey: string,
    vendorKey: string,
  ) => Promise<void>;
  onResetLocationUploads: (locationId: string) => Promise<void>;
  onEnterSupportMode: (accountId: string) => void;
  onExpandAll: () => void;
  onFilterChange: (filter: "all" | "immutable" | "editable") => void;
  onOpenCaar: Dispatch<SetStateAction<CaarRecord | null>>;
  onOpenLocation: (locationId: string) => void;
  onOpenOnboarding: (locationId: string) => void;
  onOpenSchemaEditor: Dispatch<SetStateAction<SchemaWorkspace | null>>;
  onOpenUploads: (locationId: string) => void;
  onOpenUser: Dispatch<SetStateAction<WgsUser | null>>;
  onInitializeWorkspace: (locationId: string, module: "M01" | "M02", vendor?: string) => void;
  onOpenDiy: () => void;
  onSupportTicketCreated: () => void | Promise<void>;
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
  permissionRecords: PermissionRecord[];
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
        hasTeamAccount={hasTeamAccount}
        locations={locations}
        onAddLocation={onAddLocation}
        onGoToTeamAccess={onGoToTeamAccess}
        onOpenLocation={onOpenLocation}
        role={role}
        workflowByLocation={workflowByLocation}
      />
    );
  }

  if (activeView === "location") {
    const activeLocation =
      (activeWorkspaceLocationId
        ? locations.find((location) => location.id === activeWorkspaceLocationId)
        : null) ?? locations[0] ?? null;

    if (!activeLocation) {
      return (
        <WaterfallView
          caars={caars}
          hasTeamAccount={hasTeamAccount}
          locations={locations}
          onAddLocation={onAddLocation}
          onGoToTeamAccess={onGoToTeamAccess}
          onOpenLocation={onOpenLocation}
          role={role}
          workflowByLocation={workflowByLocation}
        />
      );
    }

    return (
      <LocationWorkspaceView
        artifactIntakeState={artifactIntakeState}
        caars={caars}
        location={activeLocation}
        locationSourceConfig={diyLocationSourceConfigs[activeLocation.id] ?? null}
        onEditWorkspace={onOpenSchemaEditor}
        onInitializeWorkspace={onInitializeWorkspace}
        onManageSources={(next) => onManageUploadSources(activeLocation.id, next)}
        onOpenCaar={onOpenCaar}
        onOpenOnboarding={onOpenOnboarding}
        onOpenUploads={onOpenUploads}
        onRunCertification={onRunCertification}
        onSealWorkspace={onSealWorkspace}
        role={role}
        workflow={workflowByLocation[activeLocation.id]}
        workspaces={schemaWorkspaces}
      />
    );
  }

  if (activeView === "caars") {
    return <CaarListView onOpenCaar={onOpenCaar} records={caars} />;
  }

  if (activeView === "billing") {
    return <BillingView caars={caars} locations={locations} />;
  }

  if (activeView === "log") {
    return <LogView entries={filteredLogs} filter={logFilter} onFilterChange={onFilterChange} />;
  }

  if (activeView === "profile") {
    return <ProfileView session={session} visibleLocationCount={locations.length} />;
  }

  if (activeView === "support") {
    return (
      <SupportTicketsView
        accountId={activeSupportAccountId}
        accountName={activeSupportAccountName}
        locations={locations}
        onTicketCreated={onSupportTicketCreated}
        session={session}
      />
    );
  }

  if (activeView === "permissions") {
    return <PermissionsView records={permissionRecords} />;
  }

  if (activeView === "diy") {
    return (
      <DiyAccessView
        locations={locations}
        locationSourceConfigs={diyLocationSourceConfigs}
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
        activeArtifactHint={activeUploadArtifactHint}
        activeLocationId={activeUploadLocationId}
        activeModuleHint={activeUploadModuleHint}
        activeLocationModules={activeUploadModules}
        activeLocationName={activeUploadLocationName}
        activeSourceConfig={activeUploadSourceConfig}
        activeVendorKeyHint={activeUploadVendorKeyHint}
        activeVendorNameHint={activeUploadVendorNameHint}
        contractState={artifactContractState}
        intakeState={artifactIntakeState}
        modules={uploadModules}
        onCompleteUploadSet={onCompleteUploadSet}
        onDirectUpload={onDirectUpload}
        onOpenLocationDashboard={onOpenLocation}
        onRemoveUpload={onRemoveUpload}
        onResetLocationUploads={onResetLocationUploads}
        onOpenSchema={() => onViewChange("schema")}
        schemaWorkspaces={schemaWorkspaces}
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
        role={role}
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
