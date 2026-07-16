export type Role = "Admin" | "SuperAdmin" | "Manager" | "Viewer" | "WGS Manager";
export type TeamRole = "Owner" | "Finance" | "Location Manager" | "Read-only";
export type TeamAccessScope = "all_locations" | "selected_locations";

export type ViewId =
  | "dashboard"
  | "waterfall"
  | "caars"
  | "billing"
  | "log"
  | "support"
  | "profile"
  | "permissions"
  | "diy"
  | "userguide"
  | "faq"
  | "uploads"
  | "schema"
  | "onboarding"
  | "wgs";

export type DemoAccount = {
  email: string;
  role: Role;
  label: string;
};

export type ModuleSummary = {
  id: "M01" | "M02" | "M03";
  icon: string;
  name: string;
  status: "ACTIVE" | "BETA" | "LOCKED";
  trustScore: number;
  rules: number;
  summary: string;
};

export type LocationModuleState = {
  label: string;
  score: number;
  note: string;
};

export type LocationRecord = {
  accountId: string;
  id: string;
  name: string;
  market: string;
  governanceInitializedAt?: string | null;
  governanceSealedAt?: string | null;
  governanceStatus?: "uninitialized" | "draft" | "sealed";
  ownerEmail?: string;
  ownerManagerId?: number | null;
  m01: number;
  m02: number;
  ium: string;
  recovery: string;
  status: "Certified" | "At Risk" | "Onboarding";
  lastCertified: string;
  modules: LocationModuleState[];
};

export type CaarDimension = {
  name: string;
  score: number;
  weight: string;
};

export type CaarProvenanceKind = "direct_upload" | "sealed_config" | "rule_engine" | "synthetic";

export type CaarFieldAudit = {
  field: string;
  provenance: CaarProvenanceKind;
  supported: boolean;
  trace: string;
  value: string;
};

export type CaarEvidenceTrace = {
  artifactKey: string;
  fileName: string | null;
  label: string;
  matchPct: number | null;
  notes: string[];
  pageCount: number | null;
  provenance: CaarProvenanceKind;
  rows: number | null;
  schemaOk: boolean;
  sha256: string | null;
  status: "missing" | "provided" | "review";
  trace: string;
  uploadedAt: string | null;
  vendor: string | null;
};

export type CaarRuleCitationSummary = {
  firedCount: number;
  ruleId: string;
  ruleVersion: string;
  sampleEvidenceCount: number;
  varianceDisplay: string;
};

export type CaarTraceability = {
  certCompletedAt: string | null;
  certRunId: number | null;
  courtAdmissible: boolean | null;
  evidence: CaarEvidenceTrace[];
  fieldAudit: CaarFieldAudit[];
  module: "M01" | "M02" | null;
  ruleCitations: CaarRuleCitationSummary[];
  ruleSetVersion: string | null;
  sealedAt: string | null;
};

export type CaarRecord = {
  accountId: string;
  id: string;
  locationId: string;
  locationName: string;
  period: string;
  trustScore: number;
  amount: string;
  status: "Court Admissible" | "Needs Remediation";
  exhibits: number;
  narrative: string;
  findings: string[];
  dimensions: CaarDimension[];
  traceability?: CaarTraceability;
};

export type LogRecord = {
  accountId: string;
  ts: string;
  location: string;
  action: string;
  hash: string;
  user: string;
  immutable: boolean;
};

export type PermissionRecord = {
  name: string;
  email: string;
  role: Role;
  scope: string;
  lastSeen: string;
};

export type TeamLocationOption = {
  id: number;
  label: string;
  locationId: string;
  name: string;
};

export type TeamMemberRecord = {
  accountHolder: boolean;
  accessScope: TeamAccessScope;
  email: string;
  id: number;
  invitedAt: string | null;
  lastActive: string | null;
  locationAccess: TeamLocationOption[];
  name: string;
  status: "active" | "revoked";
  teamRole: TeamRole;
};

export type TeamInviteRecord = {
  accessScope: TeamAccessScope;
  createdAt: string;
  email: string;
  id: number;
  locationAccess: TeamLocationOption[];
  role: TeamRole;
  status: "pending" | "cancelled" | "accepted" | "revoked";
};

export type TeamAccessPayload = {
  canBootstrapOwnerAccount: boolean;
  canManageTeam: boolean;
  currentAccountId: string | null;
  currentMemberId: number | null;
  invites: TeamInviteRecord[];
  locations: TeamLocationOption[];
  members: TeamMemberRecord[];
  usesLegacyAccountModel: boolean;
};

export type GuideStep = {
  id: string;
  title: string;
  text: string;
  where: string;
};

export type GuidePhase = {
  id: string;
  title: string;
  subtitle: string;
  callout?: string;
  steps: GuideStep[];
};

export type FaqItem = {
  question: string;
  answer: string;
  topic: string;
};

export type UploadArtifact = {
  key: string;
  label: string;
  type: "CSV" | "PDF" | "Manual Entry";
  status: "Ready" | "Missing" | "Needs Review";
  note: string;
};

export type IntakeStepKey = "uploaded" | "hash" | "schema" | "fields";

export type IntakeState = {
  uploadId?: number;
  uploaded: boolean;
  hash: boolean;
  schema: boolean;
  fields: boolean;
  fileName?: string;
  rows?: number;
  hashValue?: string;
  vendorKey?: string;
  vendorName?: string;
  sizeBytes?: number;
  matchPct?: number;
  matchedColumns?: number;
  expectedColumns?: number;
  unmatchedHeaders?: string[];
  parseWarnings?: string[];
  updatedAt?: string;
  metrics?: {
    adjustmentAmount?: number;
    basisAmount?: number;
    chargebackCount?: number;
    commissionRateAppliedAvg?: number;
    depositAmount?: number;
    deliveryFeeAmount?: number;
    deliveryOrderCount?: number;
    errorChargeAmount?: number;
    feeAmount?: number;
    interchangeFeeAmount?: number;
    marketingFeeAmount?: number;
    memberOrderCount?: number;
    otherFeeAmount?: number;
    orderCount?: number;
    pickupOrderCount?: number;
    promoOrderCount?: number;
    payoutAmount?: number;
    refundCount?: number;
    serviceFeeAmount?: number;
    taxRemittedAmount?: number;
    tipAmount?: number;
    transactionCount?: number;
    voidCount?: number;
    visaCreditAmount?: number;
    visaCreditFeeAmount?: number;
    visaDebitAmount?: number;
    visaDebitFeeAmount?: number;
    mcCreditAmount?: number;
    mcCreditFeeAmount?: number;
    mcDebitAmount?: number;
    mcDebitFeeAmount?: number;
  };
};

export type UploadReceipt = {
  artifactKey?: string;
  expectedColumns?: number;
  fileName: string;
  hashValue?: string;
  locationId: string;
  locationName: string;
  matchedColumns?: number;
  matchPct?: number;
  metrics?: IntakeState["metrics"];
  moduleId: "M01" | "M02";
  pageCount?: number;
  parseWarnings?: string[];
  rows?: number;
  sizeBytes: number;
  status: "ready" | "review";
  unmatchedHeaders?: string[];
  updatedAt?: string;
  uploadId?: number;
  uploaded?: boolean;
  vendorKey?: string;
  vendorName?: string;
};

export type UploadModule = {
  accountId: string;
  id: "M01" | "M02";
  title: string;
  subtitle: string;
  artifacts: UploadArtifact[];
};

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  checklist: string[];
};

export type WgsOnboardingChecklistItem = {
  label: string;
  note: string;
};

export type WgsOnboardingStep = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  desc: string;
  type: "checklist" | "upload-m01" | "upload-m02";
  items?: WgsOnboardingChecklistItem[];
};

export type WgsVendorOption = {
  key: string;
  name: string;
  module: "M01" | "M02";
};

export type WgsOnboardingUpload = {
  docKey?: string;
  hash: string;
  module: "M01" | "M02";
  name: string;
  rows: number;
  vendorName: string;
};

export type WgsOnboardingProgress = {
  checks: Record<string, boolean[]>;
  completed: boolean;
  selectedVendors: {
    m01: string[];
    m02: string[];
  };
  stepIndex: number;
  uploads: Record<string, WgsOnboardingUpload>;
};

export type SchemaField = {
  canonical: string;
  source: string;
  required: boolean;
  confidence: "Verified" | "Needs Review" | "Missing";
};

export type ContractField = {
  label: string;
  value: string;
  source: string;
};

export type ContractInputDefinition = {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "number" | "date" | "email" | "textarea" | "select";
  required: boolean;
  options?: string[];
  help: string;
};

export type PosSchemaGovernance = {
  extractedAt?: string;
  extractedHeaders: string[];
  manualHeaders: string[];
  sourceFileName?: string;
  status: "missing" | "draft" | "validated";
  validatedHeaders: string[];
};

export type SchemaWorkspace = {
  accountId: string;
  module: "M01" | "M02";
  vendor: string;
  account: string;
  locationId?: string;
  locationName?: string;
  status?: "draft" | "sealed";
  fields: SchemaField[];
  contract: ContractField[];
  posSchema?: PosSchemaGovernance;
  vault: {
    state?: "draft" | "sealed";
    version: string;
    hash: string;
    sealedBy: string;
    sealedAt: string;
  };
};

export type WgsQueueItem = {
  id: string;
  account: string;
  issue: string;
  priority: "High" | "Medium" | "Low";
  age: string;
};

export type WgsApproval = {
  id: string;
  account: string;
  type: string;
  summary: string;
};

export type WgsAccount = {
  id: string;
  name: string;
  locations: number;
  modules: string;
  avgTrust: number;
  status: string;
  lastActivity: string;
};

export type AddLocationDraft = {
  name: string;
  address: string;
  locId: string;
  posSystem: string;
  m01: boolean;
  m02: boolean;
  processor: string;
  dsps: string[];
};

export type RequestAccessDraft = {
  company: string;
  email: string;
  name: string;
  phone: string;
  locations: string;
  monthlyVolume: string;
  modules: string[];
  modulePlan: "bundle" | "m01" | "m02";
  notes: string;
  processors: string[];
  dsps: string[];
};

export type WgsUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "Super Admin" | "WGS Manager" | "Advisor" | "Analyst";
  status: "Active" | "Inactive";
  twoFA: "None" | "SMS" | "Authenticator" | "Hardware Key";
  customers: string[];
  lastLogin: string;
};

export type ChatMessage = {
  from: "assistant" | "user";
  text: string;
};

export type SupportTicketCategory =
  | "Certification"
  | "Upload / Schema"
  | "Team & Access"
  | "Billing"
  | "Account / Login"
  | "Other";

export type SupportTicketUrgency = "Low" | "Medium" | "High" | "Critical";

export type SupportTicketRecord = {
  id: string;
  accountId: string | null;
  accountName: string;
  category: SupportTicketCategory;
  createdAt: string | null;
  description: string;
  emailDelivery: "not_configured" | "prepared" | "queued" | "sent" | "failed";
  lastUpdatedAt: string | null;
  locationId: string | null;
  locationName: string | null;
  priority: "High" | "Medium" | "Low";
  requesterEmail: string;
  requesterName: string | null;
  requesterRole: string | null;
  status: "open" | "in_review" | "waiting_on_customer" | "resolved";
  subject: string;
  urgency: SupportTicketUrgency;
  workflow: string | null;
};

export type SessionState = {
  accountId: string | null;
  email: string;
  managerId?: number | null;
  name?: string;
  role: Role;
  teamRole?: TeamRole | null;
};

export type LocationWorkflowAction = "onboarding" | "uploads" | "diy" | "certification";

export type WorkflowRequirementKey = "onboarding" | "governance" | "evidence";

export type WorkflowRequirementStatus = {
  action: LocationWorkflowAction;
  detail: string;
  key: WorkflowRequirementKey;
  label: string;
  status: "complete" | "action_required" | "not_applicable";
};

export type LocationWorkflowState = {
  blockers: string[];
  moduleReadiness?: Record<
    "M01" | "M02",
    {
      blockers: string[];
      enabled: boolean;
      ready: boolean;
      warnings: string[];
    }
  >;
  primaryAction: LocationWorkflowAction;
  primaryLabel: string;
  readyForCertification: boolean;
  requirements: WorkflowRequirementStatus[];
  warnings: string[];
};

export type LocationSourceConfig = {
  m01Enabled: boolean;
  m01Vendors: { key: string; name: string }[];
  m02Enabled: boolean;
  m02Vendors: { key: string; name: string }[];
};

export type SupportModeState = {
  active: boolean;
  accountId: string | null;
  accountName: string | null;
};

export type PersistedSentryState = {
  artifactContractState: Record<string, Record<string, string>>;
  artifactIntakeState: Record<string, IntakeState>;
  caarState: CaarRecord[];
  locationState: LocationRecord[];
  logState: LogRecord[];
  onboardingState: Record<string, boolean[]>;
  schemaState: SchemaWorkspace[];
  supportMode: SupportModeState;
  uploadState: UploadModule[];
  wgsApprovalState: WgsApproval[];
  wgsOnboardingState: Record<string, WgsOnboardingProgress>;
  wgsQueueState: WgsQueueItem[];
  wgsUserState: WgsUser[];
};
