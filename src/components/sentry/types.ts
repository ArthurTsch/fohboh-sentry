export type Role = "Admin" | "Manager" | "Viewer" | "WGS Manager";

export type ViewId =
  | "dashboard"
  | "waterfall"
  | "caars"
  | "log"
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

export type SchemaWorkspace = {
  accountId: string;
  module: "M01" | "M02";
  vendor: string;
  account: string;
  fields: SchemaField[];
  contract: ContractField[];
  vault: {
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
  locations: string;
  modules: string[];
  notes: string;
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

export type SessionState = {
  email: string;
  role: Role;
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
