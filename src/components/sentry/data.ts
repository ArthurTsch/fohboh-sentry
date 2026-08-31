import type {
  AddLocationDraft,
  CaarRecord,
  ChatMessage,
  ContractInputDefinition,
  ContractField,
  DemoAccount,
  FaqItem,
  GuidePhase,
  LocationRecord,
  LogRecord,
  ModuleSummary,
  OnboardingStep,
  PermissionRecord,
  RequestAccessDraft,
  SchemaField,
  SchemaWorkspace,
  UploadModule,
  WgsAccount,
  WgsApproval,
  WgsOnboardingStep,
  WgsVendorOption,
  WgsQueueItem,
  WgsUser,
} from "./types";

export const demoAccounts: DemoAccount[] = [
  {
    email: "demo@fohboh.ai",
    role: "Admin",
    label: "Admin - full access",
  },
  {
    email: "s.chen@dominosntx.com",
    role: "Manager",
    label: "Manager",
  },
  {
    email: "j.ortega@dominosntx.com",
    role: "Viewer",
    label: "Viewer (read-only)",
  },
  {
    email: "wgs@fohboh.ai",
    role: "WGS Manager",
    label: "WGS Manager",
  },
];

export const moduleSummaries: ModuleSummary[] = [
  {
    id: "M01",
    icon: "🧾",
    name: "Merchant Fee Recovery",
    status: "ACTIVE",
    trustScore: 92,
    rules: 107,
    summary: "Processor markup, downgrade, and interchange padding controls.",
  },
  {
    id: "M02",
    icon: "🚚",
    name: "Delivery Fee Recovery",
    status: "ACTIVE",
    trustScore: 91,
    rules: 83,
    summary: "DSP commission drift, commission base, and payout variance logic.",
  },
  {
    id: "M03",
    icon: "📋",
    name: "Royalty Fee Recovery",
    status: "BETA",
    trustScore: 74,
    rules: 27,
    summary: "Enterprise royalty logic for multi-unit and franchise reporting.",
  },
];

export const locations: LocationRecord[] = [
  {
    accountId: "C001",
    id: "LOC-104",
    name: "Dallas Uptown",
    market: "Dallas, TX",
    m01: 94,
    m02: 91,
    ium: "$18.4K",
    recovery: "$42,180",
    status: "Certified",
    lastCertified: "2026-06-01",
    modules: [
      { label: "M01", score: 94, note: "Processor statement, POS, bank all sealed." },
      { label: "M02", score: 91, note: "DoorDash and Uber Eats reconciled." },
      { label: "Evidence", score: 96, note: "All source files hash-verified." },
    ],
  },
  {
    accountId: "C001",
    id: "LOC-118",
    name: "Plano Legacy",
    market: "Plano, TX",
    m01: 88,
    m02: 84,
    ium: "$11.1K",
    recovery: "$27,940",
    status: "At Risk",
    lastCertified: "2026-05-29",
    modules: [
      { label: "M01", score: 88, note: "Minor downgrade variance remains." },
      { label: "M02", score: 84, note: "Missing latest bank statement blocks CAAR." },
      { label: "Evidence", score: 79, note: "One upload still pending reconciliation." },
    ],
  },
  {
    accountId: "C001",
    id: "LOC-121",
    name: "Fort Worth West",
    market: "Fort Worth, TX",
    m01: 79,
    m02: 72,
    ium: "$8.7K",
    recovery: "$15,630",
    status: "Onboarding",
    lastCertified: "Pending",
    modules: [
      { label: "M01", score: 79, note: "Contract config not sealed yet." },
      { label: "M02", score: 72, note: "Settlement upload mapped, bank still missing." },
      { label: "Evidence", score: 68, note: "Intake chain not complete." },
    ],
  },
  {
    accountId: "C001",
    id: "LOC-133",
    name: "Arlington South",
    market: "Arlington, TX",
    m01: 90,
    m02: 89,
    ium: "$13.6K",
    recovery: "$31,220",
    status: "Certified",
    lastCertified: "2026-06-02",
    modules: [
      { label: "M01", score: 90, note: "Card processor rates verified." },
      { label: "M02", score: 89, note: "Cross-system reconciliation cleared." },
      { label: "Evidence", score: 92, note: "Vault lineage confirmed." },
    ],
  },
];

export const caarRecords: CaarRecord[] = [
  {
    accountId: "C001",
    id: "CAAR-240601-104",
    locationId: "LOC-104",
    locationName: "Dallas Uptown",
    period: "May 2026",
    trustScore: 91,
    amount: "$42,180",
    status: "Certified",
    exhibits: 9,
    narrative:
      "All required source systems were hash-verified and reconciled. The certified variance is appropriate for external vendor submission.",
    findings: [
      "DoorDash commission base drift produced a certified overcharge of $18,440.",
      "Processor statement review identified interchange padding across 3 MID groups.",
      "Bank reconciliation confirms settlement-to-deposit continuity for the full period.",
    ],
    dimensions: [
      { name: "Data Completeness", score: 94, weight: "25%" },
      { name: "Rule Integrity", score: 92, weight: "20%" },
      { name: "Cross-System Reconciliation", score: 90, weight: "25%" },
      { name: "Source Authenticity", score: 93, weight: "15%" },
      { name: "Auditability", score: 89, weight: "10%" },
      { name: "Data Freshness", score: 88, weight: "5%" },
    ],
  },
  {
    accountId: "C001",
    id: "CAAR-240529-118",
    locationId: "LOC-118",
    locationName: "Plano Legacy",
    period: "May 2026",
    trustScore: 84,
    amount: "$27,940",
    status: "Needs Remediation",
    exhibits: 7,
    narrative:
      "The portal identified recoverable variance, but certified release is blocked by incomplete bank-level reconciliation.",
    findings: [
      "M02 evidence package is missing one bank statement needed for D3 validation.",
      "Certified fee variance remains visible, but final ExportPack generation is blocked.",
      "A rerun after bank upload is expected to clear the CAAR threshold.",
    ],
    dimensions: [
      { name: "Data Completeness", score: 86, weight: "25%" },
      { name: "Rule Integrity", score: 91, weight: "20%" },
      { name: "Cross-System Reconciliation", score: 74, weight: "25%" },
      { name: "Source Authenticity", score: 89, weight: "15%" },
      { name: "Auditability", score: 84, weight: "10%" },
      { name: "Data Freshness", score: 85, weight: "5%" },
    ],
  },
  {
    accountId: "C001",
    id: "CAAR-240602-133",
    locationId: "LOC-133",
    locationName: "Arlington South",
    period: "May 2026",
    trustScore: 89,
    amount: "$31,220",
    status: "Certified",
    exhibits: 9,
    narrative:
      "Evidence chain, contract config, and rule lineage are complete. The report is suitable for legal review and vendor escalation.",
    findings: [
      "DSP statement variance attributable to delivery commission uplift outside contracted band.",
      "M01 processor recovery supported by signed agreement and statement export.",
      "All exhibit hashes matched the evidence manifest at export time.",
    ],
    dimensions: [
      { name: "Data Completeness", score: 91, weight: "25%" },
      { name: "Rule Integrity", score: 88, weight: "20%" },
      { name: "Cross-System Reconciliation", score: 87, weight: "25%" },
      { name: "Source Authenticity", score: 92, weight: "15%" },
      { name: "Auditability", score: 90, weight: "10%" },
      { name: "Data Freshness", score: 86, weight: "5%" },
    ],
  },
];

export const logRecords: LogRecord[] = [
  {
    accountId: "C001",
    ts: "2026-06-02 14:16",
    location: "Dallas Uptown",
    action: "CAAR generated and ExportPack sealed",
    hash: "sha256:6e8a19f1",
    user: "demo@fohboh.ai",
    immutable: true,
  },
  {
    accountId: "C001",
    ts: "2026-06-02 11:02",
    location: "Arlington South",
    action: "Certification completed for M01 and M02",
    hash: "sha256:ab117c2d",
    user: "demo@fohboh.ai",
    immutable: true,
  },
  {
    accountId: "C001",
    ts: "2026-06-01 16:48",
    location: "Plano Legacy",
    action: "Bank statement required before rerun",
    hash: "draft:bank-gap-118",
    user: "s.chen@dominosntx.com",
    immutable: false,
  },
  {
    accountId: "C001",
    ts: "2026-05-31 09:12",
    location: "Fort Worth West",
    action: "Contract config draft saved for M02",
    hash: "draft:m02-config-121",
    user: "wgs@fohboh.ai",
    immutable: false,
  },
  {
    accountId: "C001",
    ts: "2026-05-30 18:26",
    location: "Dallas Uptown",
    action: "Settlement CSV uploaded and hash-verified",
    hash: "sha256:2fa7bc18",
    user: "demo@fohboh.ai",
    immutable: true,
  },
];

export const permissionRecords: PermissionRecord[] = [
  {
    name: "Daphne Reed",
    email: "demo@fohboh.ai",
    role: "Admin",
    scope: "All locations, all modules",
    lastSeen: "2 minutes ago",
  },
  {
    name: "Sarah Chen",
    email: "s.chen@dominosntx.com",
    role: "Manager",
    scope: "Dallas + Plano portfolio",
    lastSeen: "18 minutes ago",
  },
  {
    name: "Javier Ortega",
    email: "j.ortega@dominosntx.com",
    role: "Viewer",
    scope: "Read-only, portfolio reports",
    lastSeen: "Yesterday",
  },
  {
    name: "WGS Operations",
    email: "wgs@fohboh.ai",
    role: "WGS Manager",
    scope: "Support mode, schema seal authority",
    lastSeen: "Online",
  },
];

export const guidePhases: GuidePhase[] = [
  {
    id: "01",
    title: "Account Setup & Onboarding",
    subtitle: "Complete once per organisation with your WGS Manager",
    callout:
      "Have signed DSP agreements, merchant services agreement, and bank statements ready before onboarding begins.",
    steps: [
      {
        id: "1.1",
        title: "Request access",
        text: "Complete the intake form from the landing page. Your WGS Manager reviews the account and enables your first session.",
        where: "Landing page -> Request Access",
      },
      {
        id: "1.2",
        title: "Register locations",
        text: "Each location gets its own Trust Score, schema state, CAAR history, and evidence chain.",
        where: "Onboarding wizard -> Location step",
      },
    ],
  },
  {
    id: "02",
    title: "M01 Merchant Fee Recovery",
    subtitle: "Card processor certification workflow",
    steps: [
      {
        id: "2.1",
        title: "Upload processor statement",
        text: "Use the native transaction-level CSV export exactly as downloaded so the hash and schema remain valid.",
        where: "Upload Data -> M01",
      },
      {
        id: "2.2",
        title: "Upload POS and bank source files",
        text: "These are required for the three-way reconciliation gate that supports certified output.",
        where: "Upload Data -> M01",
      },
    ],
  },
  {
    id: "03",
    title: "M02 Delivery Fee Recovery",
    subtitle: "DSP commission certification workflow",
    callout:
      "Commission base is the critical field. Wrong commission base selection systematically understates or overstates every certified finding.",
    steps: [
      {
        id: "3.1",
        title: "Upload settlement CSV and agreement PDF",
        text: "Every DSP is tracked separately and must maintain its own sealed schema and contract config.",
        where: "Upload Data -> M02",
      },
      {
        id: "3.2",
        title: "Seal schema before certification",
        text: "Once verified, the schema and contract config are sealed to the vault and become the reference state for all certified output.",
        where: "Schema Registry -> Vault Record",
      },
    ],
  },
  {
    id: "04",
    title: "Certification & CAAR Delivery",
    subtitle: "Run Loop A and review legal-grade output",
    steps: [
      {
        id: "4.1",
        title: "Run certification",
        text: "A Trust Score of 85 or higher is the release gate for CAAR and ExportPack generation.",
        where: "Dashboard or Waterfall -> Run Certification",
      },
      {
        id: "4.2",
        title: "Open CAAR and deliver ExportPack",
        text: "Once all evidence gates are ready, download the CAAR PDF and generate the ExportPack for legal review.",
        where: "CAARs -> View Report",
      },
    ],
  },
];

export const faqItems: FaqItem[] = [
  {
    topic: "CAAR",
    question: "What is a CAAR?",
    answer:
      "A Certified Automated Audit & Recovery report (CAAR) is the output produced after Sentry completes certification. It documents reconciliation findings, the exact rules evaluated, and the certified recovery amount. Each CAAR is sealed with a SHA-256 hash so the downloaded file can be checked for alteration.",
  },
  {
    topic: "CAAR",
    question: 'What does "Certified Automated Audit & Recovery" mean?',
    answer:
      "It means the CAAR is formatted and evidence-chained to meet the evidentiary standards for use in arbitration, dispute resolution, or civil litigation. The SHA-256 seal hash creates an unbroken chain of custody from the original data to the final document - a requirement for legal standing.",
  },
  {
    topic: "Vault",
    question: "Why can't I modify a sealed certification record?",
    answer:
      "SHA-256 immutability is an architectural constraint, not a permission. Once a certification run produces a vault record, the cryptographic hash makes any modification detectable and therefore invalid. If you discover an error in the input data, run a new certification with corrected data. The original record remains as a permanent audit entry.",
  },
  {
    topic: "M03",
    question: "Why is M03 Royalty Recovery locked?",
    answer:
      "M03 requires M01 and M02 to have been active for at least 90 days and both Trust Scores to be at 85 or above. This dependency exists because royalty recovery relies on the certified baseline data that M01 and M02 establish. It also ensures the franchisor-facing evidence package is built on a mature, validated data history.",
  },
  {
    topic: "Trust Score",
    question: "What is the M02 Trust Score?",
    answer:
      "The Trust Score (0-100) reflects how completely and accurately your M02 delivery fee data has been validated against your DSP contracts. A score of 91 means the engine has high confidence in the certified figures. Scores below 70 typically indicate missing data or unresolved DSP contract ambiguities - your WGS Advisor will flag these during onboarding.",
  },
  {
    topic: "WGS",
    question: "Who is my WGS Advisor and what do they do?",
    answer:
      "WGS (White Glove Services) Advisors are FohBoh specialists who handle your initial setup: reviewing your processor and DSP contracts, configuring your Schema Registry, sealing your Contract Config, and running your first certification. They are the only role that can seal Contract Config - this is an architectural requirement to ensure a qualified human reviews every contract before it governs a live certification.",
  },
  {
    topic: "Locations",
    question: "How do I add a new location?",
    answer:
      "Admins and WGS Managers can add locations from the Location Waterfall view. Each new location requires its own Contract Config to be sealed by a WGS Manager before its first certification run. This ensures every location's fee structures are reviewed before Sentry begins certifying against them.",
  },
];

export const supportQuickPrompts = [
  "How do I run a certification?",
  "What is a CAAR?",
  "Why is my Trust Score low?",
];

export const initialMessages: ChatMessage[] = [
  {
    from: "assistant",
    text: "Hi. Ask about certification, CAAR readiness, schema setup, or why a Trust Score is blocked.",
  },
];

export const uploadModules: UploadModule[] = [
  {
    accountId: "C001",
    id: "M01",
    title: "Merchant Fee Recovery",
    subtitle: "Processor statements, POS exports, bank statements, and contract config.",
    artifacts: [
      {
        key: "m01-processor",
        label: "Processor Statement CSV",
        type: "CSV",
        status: "Ready",
        note: "Transaction-level statement uploaded and hash-verified against the intake manifest.",
      },
      {
        key: "m01-pos",
        label: "POS Transaction Export",
        type: "CSV",
        status: "Ready",
        note: "Cross-system source aligned with the processor period used in the current run.",
      },
      {
        key: "m01-agreement",
        label: "Signed Merchant Agreement",
        type: "PDF",
        status: "Ready",
        note: "Executed merchant services agreement is linked to the active contract configuration.",
      },
      {
        key: "m01-bank",
        label: "Bank Statement",
        type: "PDF",
        status: "Needs Review",
        note: "Latest statement was uploaded but reconciliation confidence still needs confirmation.",
      },
      {
        key: "m01-contract",
        label: "Contract Config",
        type: "Manual Entry",
        status: "Ready",
        note: "Processor markup, transaction fee, and pricing model have been entered and verified.",
      },
    ],
  },
  {
    accountId: "C001",
    id: "M02",
    title: "Delivery Fee Recovery",
    subtitle: "DSP settlement exports, agreement PDFs, and commission-base contract data.",
    artifacts: [
      {
        key: "m02-settlement",
        label: "DSP Settlement CSV",
        type: "CSV",
        status: "Ready",
        note: "DoorDash and Uber Eats files match the active schema mapping set.",
      },
      {
        key: "m02-pos",
        label: "POS Summary by Channel CSV",
        type: "CSV",
        status: "Needs Review",
        note: "POS channel summary is required for cross-system variance reconciliation against DSP settlement and bank payout.",
      },
      {
        key: "m02-agreement",
        label: "Signed DSP Agreement",
        type: "PDF",
        status: "Ready",
        note: "Executed agreement is present and tied to the commission-base definition used in contract config.",
      },
      {
        key: "m02-bank",
        label: "Bank Deposit Evidence",
        type: "PDF",
        status: "Missing",
        note: "This gap blocks D3 reconciliation and prevents CAAR release for at-risk locations.",
      },
      {
        key: "m02-contract",
        label: "Contract Config",
        type: "Manual Entry",
        status: "Needs Review",
        note: "Commission base is entered but still needs governance review before vault sealing.",
      },
    ],
  },
  {
    accountId: "C001",
    id: "M03",
    title: "Royalty Fee Recovery",
    subtitle: "Franchise remittance, POS gross-sales support, agreement PDFs, and royalty contract data.",
    artifacts: [
      {
        key: "m03-royalty",
        label: "Royalty Remittance Source",
        type: "CSV",
        status: "Missing",
        note: "Franchisee royalty and marketing-remittance source for the governed certification period.",
      },
      {
        key: "m03-pos",
        label: "POS Gross Sales Export",
        type: "CSV",
        status: "Missing",
        note: "Restaurant-side gross-sales export used to certify the royalty base and exclusions.",
      },
      {
        key: "m03-agreement",
        label: "Signed Franchise Agreement",
        type: "PDF",
        status: "Missing",
        note: "Executed franchise agreement establishing royalty rate, marketing fund rate, waivers, and effective dates.",
      },
      {
        key: "m03-contract",
        label: "Royalty Contract Config",
        type: "Manual Entry",
        status: "Missing",
        note: "Governed royalty model sealed from the franchise agreement and supporting exhibits.",
      },
    ],
  },
  {
    accountId: "C002",
    id: "M02",
    title: "Delivery Fee Recovery",
    subtitle: "Whataburger TX delivery evidence with one major reconciliation blocker.",
    artifacts: [
      {
        key: "m02-settlement-c002",
        label: "DSP Settlement CSV",
        type: "CSV",
        status: "Ready",
        note: "Settlement export uploaded and schema-matched for the current period.",
      },
      {
        key: "m02-pos-c002",
        label: "POS Summary by Channel CSV",
        type: "CSV",
        status: "Missing",
        note: "POS summary has not been uploaded for this period, so channel-level reconciliation is blocked.",
      },
      {
        key: "m02-agreement-c002",
        label: "Signed DSP Agreement",
        type: "PDF",
        status: "Ready",
        note: "Signed DoorDash agreement is present and linked to the current contract config.",
      },
      {
        key: "m02-bank-c002",
        label: "Bank Deposit Evidence",
        type: "PDF",
        status: "Missing",
        note: "Missing bank evidence blocks D3 reconciliation and keeps the Trust Score under release threshold.",
      },
      {
        key: "m02-contract-c002",
        label: "Contract Config",
        type: "Manual Entry",
        status: "Needs Review",
        note: "Commission base needs WGS verification before sealing.",
      },
    ],
  },
  {
    accountId: "C003",
    id: "M01",
    title: "Merchant Fee Recovery",
    subtitle: "Raising Canes processor evidence with contract renewal work in progress.",
    artifacts: [
      {
        key: "m01-processor-c003",
        label: "Processor Statement CSV",
        type: "CSV",
        status: "Ready",
        note: "Processor statements uploaded and hashed for the quarterly review period.",
      },
      {
        key: "m01-pos-c003",
        label: "POS Transaction Export",
        type: "CSV",
        status: "Needs Review",
        note: "POS export exists but still needs field-level validation against the active schema.",
      },
      {
        key: "m01-agreement-c003",
        label: "Signed Merchant Agreement",
        type: "PDF",
        status: "Needs Review",
        note: "Renewal agreement PDF is present but addendum linkage still needs confirmation.",
      },
      {
        key: "m01-bank-c003",
        label: "Bank Statement",
        type: "PDF",
        status: "Ready",
        note: "Bank evidence has been received and tied to the same certification window.",
      },
      {
        key: "m01-contract-c003",
        label: "Contract Config",
        type: "Manual Entry",
        status: "Needs Review",
        note: "Renewal pricing amendment still needs to be entered before sealing.",
      },
    ],
  },
];

const sharedM01Fields: SchemaField[] = [
  {
    canonical: "gross_sales_amount",
    source: "gross_amount",
    required: true,
    confidence: "Verified",
  },
  {
    canonical: "processor_markup_bps",
    source: "processor_bps",
    required: true,
    confidence: "Verified",
  },
  {
    canonical: "network_fee_amount",
    source: "network_fees",
    required: false,
    confidence: "Needs Review",
  },
];

const sharedM02Fields: SchemaField[] = [
  {
    canonical: "commission_base_amount",
    source: "subtotal_before_promotions",
    required: true,
    confidence: "Verified",
  },
  {
    canonical: "delivery_commission_rate",
    source: "commission_pct",
    required: true,
    confidence: "Verified",
  },
  {
    canonical: "marketing_fee_amount",
    source: "promo_fee",
    required: false,
    confidence: "Needs Review",
  },
];

const sharedM01Contract: ContractField[] = [
  { label: "Pricing Model", value: "Interchange Plus", source: "Signed merchant agreement" },
  { label: "Processor Markup", value: "25 bps", source: "Rate schedule page 2" },
  { label: "Per Transaction Fee", value: "$0.08", source: "Signed merchant agreement" },
  { label: "Effective Date", value: "2025-10-01", source: "Executed amendment" },
];

const sharedM02Contract: ContractField[] = [
  { label: "Commission Base", value: "Subtotal before tax", source: "DSP agreement schedule A" },
  { label: "Delivery Commission Rate (%)", value: "22.00%", source: "Executed DSP agreement" },
  { label: "Pickup / Carryout Rate (%)", value: "6.00%", source: "Executed DSP agreement" },
  { label: "Restaurant UUID", value: "REST-DFW-118", source: "Merchant portal profile" },
  { label: "Effective Date", value: "2026-01-15", source: "Latest signed addendum" },
];

export const schemaWorkspaces: SchemaWorkspace[] = [
  {
    accountId: "C001",
    account: "Dominos NTX — Dallas",
    module: "M01",
    vendor: "Chase Paymentech",
    fields: sharedM01Fields,
    contract: sharedM01Contract,
    vault: {
      version: "m01-v12",
      hash: "sha256:1af9d4e2110b",
      sealedBy: "wgs@fohboh.ai",
      sealedAt: "2026-06-01 09:24",
    },
  },
  {
    accountId: "C001",
    account: "Dominos NTX — Dallas",
    module: "M02",
    vendor: "DoorDash",
    fields: sharedM02Fields,
    contract: sharedM02Contract,
    vault: {
      version: "m02-v18",
      hash: "sha256:8bb4e7ac9130",
      sealedBy: "demo@fohboh.ai",
      sealedAt: "2026-05-30 16:05",
    },
  },
  {
    accountId: "C002",
    account: "Whataburger Franchisee TX",
    module: "M02",
    vendor: "DoorDash",
    fields: sharedM02Fields.map((field) =>
      field.canonical === "marketing_fee_amount"
        ? { ...field, confidence: "Missing" }
        : field,
    ),
    contract: sharedM02Contract.map((field) =>
      field.label === "Commission Base"
        ? { ...field, value: "Needs WGS confirmation" }
        : field,
    ),
    vault: {
      version: "m02-v08",
      hash: "sha256:1c29af40e9b2",
      sealedBy: "wgs@fohboh.ai",
      sealedAt: "2026-05-18 10:12",
    },
  },
  {
    accountId: "C003",
    account: "Raising Canes DFW",
    module: "M01",
    vendor: "Worldpay",
    fields: sharedM01Fields.map((field) =>
      field.canonical === "network_fee_amount"
        ? { ...field, confidence: "Verified", source: "network_service_fee" }
        : field,
    ),
    contract: sharedM01Contract.map((field) =>
      field.label === "Processor Markup"
        ? { ...field, value: "18 bps", source: "2026 renewal addendum" }
        : field,
    ),
    vault: {
      version: "m01-v21",
      hash: "sha256:77de4abfe201",
      sealedBy: "maya.chen@fohboh.ai",
      sealedAt: "2026-06-03 15:44",
    },
  },
];

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "account",
    title: "Register account and locations",
    description:
      "Capture organisation identity, active locations, and the initial operational scope before any schema or evidence work begins.",
    checklist: [
      "Confirm legal entity and billing ownership",
      "Add all active restaurant locations",
      "Map each location to its operating market",
    ],
  },
  {
    id: "vendors",
    title: "Declare processors and delivery platforms",
    description:
      "Each processor and DSP becomes its own schema workspace with separate evidence, contract data, and Trust Score dependencies.",
    checklist: [
      "Select active card processor",
      "Select active DSPs per location",
      "Confirm agreement versions for every vendor",
    ],
  },
  {
    id: "evidence",
    title: "Collect source evidence",
    description:
      "Upload native exports and signed agreements exactly as downloaded so the intake hash and chain-of-custody record remain valid.",
    checklist: [
      "Upload processor or settlement CSV files",
      "Upload POS exports for the same period",
      "Upload matching bank statements and signed agreements",
    ],
  },
  {
    id: "schema",
    title: "Verify schema mappings and contract config",
    description:
      "Review canonical field mappings and confirm contract values directly against the signed documents before sealing.",
    checklist: [
      "Verify all required mapped fields",
      "Confirm commission base or pricing model",
      "Resolve missing or amber fields",
    ],
  },
  {
    id: "seal",
    title: "Seal to vault",
    description:
      "Sealing locks the schema and contract state used to generate future certified output. This step is governance-sensitive.",
    checklist: [
      "Review vault version and hash plan",
      "Confirm contract source documents",
      "Seal the verified schema set",
    ],
  },
  {
    id: "certify",
    title: "Run first certification",
    description:
      "After the evidence package and schema are complete, run the first certification cycle and review release readiness.",
    checklist: [
      "Verify upload readiness indicators",
      "Run M01 and M02 certification",
      "Inspect Trust Score and CAAR eligibility",
    ],
  },
];

export const wgsOnboardingSteps: WgsOnboardingStep[] = [
  {
    id: "data-package",
    label: "Data Package",
    eyebrow: "Step 1 of 6 · WGS Action",
    title: "Send Data Collection Package",
    desc: "Before real certification evidence is uploaded in Upload Data, the operator must receive and return a complete source package. Confirm each item below as received.",
    type: "checklist",
    items: [
      {
        label: "M01 - Processor monthly statements (minimum 90 days)",
        note: "CSV export from the processor merchant portal with no reformatting.",
      },
      {
        label: "M01 - Signed merchant processing agreement",
        note: "Original executed contract with all card-brand rate schedules.",
      },
      {
        label: "M01 - Terminal serial number list",
        note: "Required for the MGE terminal registry, one row per terminal.",
      },
      {
        label: "M02 - DSP settlement CSV exports (minimum 90 days per platform)",
        note: "Order-level CSV from each active DSP merchant portal with no reformatting.",
      },
      {
        label: "M02 - POS summary by channel for the same period",
        note: "Channel-level summary covering sales, settlements, tax remittance, and bank-deposit comparison.",
      },
      {
        label: "M02 - Signed DSP merchant agreement(s)",
        note: "One PDF per active DSP including commission rate schedules by channel.",
      },
      {
        label: "M02 - Bank statement(s) for the matching period",
        note: "Deposit evidence used to tie platform settlement to the actual bank deposit.",
      },
    ],
  },
  {
    id: "upload-m01",
    label: "Upload M01",
    eyebrow: "Step 2 of 6 · Data Intake",
    title: "Upload M01 Processor Statements",
    desc: "Select the processor and upload the transaction-level CSV exactly as downloaded. The MGE validates column names against the active Schema Registry.",
    type: "upload-m01",
  },
  {
    id: "upload-m02",
    label: "Upload M02",
    eyebrow: "Step 3 of 6 · Data Intake",
    title: "Upload M02 DSP Documents",
    desc: "Four documents are required per active DSP. Work through each DSP in sequence until all required upload slots are filled.",
    type: "upload-m02",
  },
  {
    id: "contract-config",
    label: "Contract Config",
    eyebrow: "Step 4 of 6 · WGS Action",
    title: "Complete Contract Config",
    desc: "Enter the contracted rates from the signed agreements. These values become the vault-locked reference state for all future certification runs.",
    type: "checklist",
    items: [
      {
        label: "M01 - Key all 9 card-brand interchange rates from the signed processor agreement",
        note: "Dual-entry attestation required across HITL checkpoints 1-3.",
      },
      {
        label: "M01 - Set effective date, override clauses, chargeback terms, and non-qual surcharge",
        note: "Captures the remaining M01 governance checkpoints before sealing.",
      },
      {
        label: "M01 - Verify Schema Registry mappings against uploaded CSV",
        note: "All required columns must be mapped and verified.",
      },
      {
        label: "M02 - Key contracted commission rates by channel per DSP",
        note: "Delivery, pickup, and member-rate terms require explicit attestation.",
      },
      {
        label: "M02 - Confirm the commission base field for every DSP",
        note: "Critical control: wrong base field invalidates every computed variance.",
      },
      {
        label: "M02 - Verify DSP column mappings and seal Contract Config",
        note: "Once sealed, the full contract state becomes immutable evidence.",
      },
    ],
  },
  {
    id: "certification",
    label: "First Cert Run",
    eyebrow: "Step 5 of 6 · Engine",
    title: "Trigger First Certification Run",
    desc: "Run the MGE for the first time and review calibration flags before the operator sees any results.",
    type: "checklist",
    items: [
      {
        label: "Trigger the first M01 Loop A certification run",
        note: "Run Cert -> select location -> M01.",
      },
      {
        label: "Trigger the first M02 Loop A certification run",
        note: "Run immediately after M01 and keep the output in WGS review only.",
      },
      {
        label: "Review first-run Trust Scores and calibration flags",
        note: "Score below 70 means calibration work is still required before operator review.",
      },
      {
        label: "Triage all data-quality or schema warnings in WGS Admin",
        note: "Resolve mismatches before the operator's first live session.",
      },
      {
        label: "Schedule the first Trust Score review call with the operator",
        note: "Walk through certified figures live before any email delivery.",
      },
    ],
  },
  {
    id: "activate",
    label: "Activate",
    eyebrow: "Step 6 of 6 · Launch",
    title: "Grant Operator Access & Activate",
    desc: "Final step: confirm all prerequisites are met, grant portal access, and mark the location as live.",
    type: "checklist",
    items: [
      {
        label: "First Trust Score review call completed",
        note: "The operator has seen and acknowledged the initial certified figures.",
      },
      {
        label: "Operator portal credentials sent",
        note: "Include login link and walkthrough handoff.",
      },
      {
        label: "Trust Score >= 85 reviewed for CAAR eligibility",
        note: "If not yet over threshold, set a remediation timeline before handoff.",
      },
      {
        label: "Location marked live in WGS Customer Accounts",
        note: "This activates weekly summaries and normal support operations.",
      },
    ],
  },
];

export const wgsM01Vendors: WgsVendorOption[] = [
  { key: "heartland", name: "Heartland", module: "M01" },
  { key: "toast", name: "Toast", module: "M01" },
  { key: "chase", name: "Chase Paymentech", module: "M01" },
  { key: "worldpay", name: "Worldpay", module: "M01" },
  { key: "fiserv", name: "Fiserv / First Data", module: "M01" },
  { key: "square", name: "Square", module: "M01" },
  { key: "other", name: "Other", module: "M01" },
];

export const wgsM02Vendors: WgsVendorOption[] = [
  { key: "doordash", name: "DoorDash", module: "M02" },
  { key: "ubereats", name: "Uber Eats", module: "M02" },
  { key: "grubhub", name: "Grubhub", module: "M02" },
  { key: "slice", name: "Slice", module: "M02" },
  { key: "postmates", name: "Postmates", module: "M02" },
  { key: "other", name: "Other", module: "M02" },
];

export const wgsAccounts: WgsAccount[] = [
  {
    id: "C001",
    name: "Dominos NTX — Dallas",
    locations: 4,
    modules: "M01 + M02",
    avgTrust: 89,
    status: "Healthy",
    lastActivity: "2h ago",
  },
  {
    id: "C002",
    name: "Whataburger Franchisee TX",
    locations: 3,
    modules: "M02",
    avgTrust: 82,
    status: "At Risk",
    lastActivity: "Today",
  },
  {
    id: "C003",
    name: "Raising Canes DFW",
    locations: 5,
    modules: "M01",
    avgTrust: 87,
    status: "Healthy",
    lastActivity: "Yesterday",
  },
];

export const wgsQueue: WgsQueueItem[] = [
  {
    id: "TCK-118",
    account: "Whataburger Franchisee TX",
    issue: "Bank statement missing for M02 release",
    priority: "High",
    age: "4h",
  },
  {
    id: "TCK-211",
    account: "Dominos NTX — Dallas",
    issue: "DIY schema edit awaiting verification",
    priority: "Medium",
    age: "1d",
  },
  {
    id: "TCK-322",
    account: "Raising Canes DFW",
    issue: "Contract renewal upload requested",
    priority: "Low",
    age: "2d",
  },
];

export const wgsApprovals: WgsApproval[] = [
  {
    id: "APR-011",
    account: "Whataburger Franchisee TX",
    type: "DIY Access Request",
    summary: "Operations lead requested direct schema access for Uber Eats commission base maintenance.",
  },
  {
    id: "APR-019",
    account: "Dominos NTX — Dallas",
    type: "Onboarding Completion",
    summary: "Final review required before enabling first live certification on new Fort Worth location.",
  },
];

export const wgsUsers: WgsUser[] = [
  {
    id: "U001",
    firstName: "Nora",
    lastName: "Bennett",
    email: "nora.bennett@fohboh.ai",
    role: "Super Admin",
    status: "Active",
    twoFA: "Hardware Key",
    customers: ["All"],
    lastLogin: "2026-06-05 13:14",
  },
  {
    id: "U002",
    firstName: "Evan",
    lastName: "Lopez",
    email: "evan.lopez@fohboh.ai",
    role: "WGS Manager",
    status: "Active",
    twoFA: "Authenticator",
    customers: ["Dominos NTX — Dallas", "Whataburger Franchisee TX"],
    lastLogin: "2026-06-05 09:42",
  },
  {
    id: "U003",
    firstName: "Maya",
    lastName: "Chen",
    email: "maya.chen@fohboh.ai",
    role: "Advisor",
    status: "Active",
    twoFA: "SMS",
    customers: ["Raising Canes DFW"],
    lastLogin: "2026-06-04 17:08",
  },
];

export const emptyAddLocationDraft: AddLocationDraft = {
  name: "",
  address: "",
  bankProviderKey: "prosperity",
  locId: "",
  posSystem: "Toast",
  m01: true,
  m02: true,
  processor: "Toast",
  dsps: ["DoorDash", "Uber Eats"],
};

export const emptyRequestAccessDraft: RequestAccessDraft = {
  company: "",
  email: "",
  name: "",
  phone: "",
  locations: "",
  monthlyVolume: "",
  modules: ["M01", "M02"],
  modulePlan: "bundle",
  notes: "",
  processors: [],
  dsps: [],
};

export const contractInputDefinitions: Record<"M01" | "M02", ContractInputDefinition[]> = {
  M01: [
    {
      id: "merchant_id",
      label: "Merchant ID (MID)",
      placeholder: "e.g. 4890221834",
      type: "text",
      required: true,
      help: "Unique processor merchant identifier used to tie fee statements and contract terms together.",
    },
    {
      id: "pricing_model",
      label: "Pricing Model",
      placeholder: "",
      type: "select",
      required: true,
      options: ["Interchange Plus", "Tiered", "Flat Rate", "Subscription"],
      help: "Determines which rule family applies when building the expected fee baseline.",
    },
    {
      id: "effective_date",
      label: "Contract Effective Date",
      placeholder: "",
      type: "date",
      required: true,
      help: "The date the signed processor rate schedule begins to govern expected fee calculations.",
    },
    {
      id: "markup_bps",
      label: "Processor Markup (basis pts)",
      placeholder: "e.g. 25",
      type: "number",
      required: true,
      help: "Processor markup in basis points above interchange. Core expected-fee input for M01.",
    },
    {
      id: "txn_fee",
      label: "Per-Transaction Fee ($)",
      placeholder: "e.g. 0.08",
      type: "number",
      required: true,
      help: "Flat per-transaction processor fee from the signed agreement.",
    },
    {
      id: "monthly_fee",
      label: "Monthly Statement Fee ($)",
      placeholder: "e.g. 9.95",
      type: "number",
      required: false,
      help: "Recurring monthly platform or statement fee if contracted.",
    },
    {
      id: "notes",
      label: "Contract Notes / Addenda",
      placeholder: "Rate amendments or special terms",
      type: "textarea",
      required: false,
      help: "Use for rate overrides, addenda, or exceptions the WGS team should preserve in the vault record.",
    },
  ],
  M02: [
    {
      id: "store_id",
      label: "Restaurant UUID / Store ID",
      placeholder: "e.g. a3f9e221-...",
      type: "text",
      required: true,
      help: "DSP-side restaurant identifier used to connect settlement rows to the correct contract config.",
    },
    {
      id: "effective_date",
      label: "Agreement Effective Date",
      placeholder: "",
      type: "date",
      required: true,
      help: "The signed DSP agreement start date used when validating rate applicability.",
    },
    {
      id: "expiry_date",
      label: "Expiry / Renewal Date",
      placeholder: "",
      type: "date",
      required: false,
      help: "Tracks renewals and determines whether an amended rate schedule should supersede the current agreement.",
    },
    {
      id: "market",
      label: "Market / Region",
      placeholder: "e.g. Dallas-Fort Worth",
      type: "text",
      required: false,
      help: "Regional scope of the DSP agreement when the same operator uses different contract territories.",
    },
    {
      id: "commission_base",
      label: "Commission Base Field",
      placeholder: "",
      type: "select",
      required: true,
      options: ["platform_gross_sales", "order_subtotal", "restaurant_food_sales", "other"],
      help: "Critical field: this is the native value the contracted commission rate is multiplied against.",
    },
    {
      id: "rate_delivery",
      label: "Delivery Commission Rate (%)",
      placeholder: "e.g. 20.0",
      type: "number",
      required: true,
      help: "Primary commission rate from the DSP agreement used to build the shadow record.",
    },
    {
      id: "rate_pickup",
      label: "Pickup / Carryout Rate (%)",
      placeholder: "e.g. 6.0",
      type: "number",
      required: false,
      help: "Pickup-specific commission rate if lower than delivery.",
    },
    {
      id: "rate_member",
      label: "Member / DashPass Rate (%)",
      placeholder: "e.g. 15.0",
      type: "number",
      required: false,
      help: "Reduced rate for member orders such as DashPass or Uber One.",
    },
    {
      id: "rate_catering",
      label: "Catering / Group Orders Rate (%)",
      placeholder: "e.g. 12.0",
      type: "number",
      required: false,
      help: "Channel-specific contracted commission rate for catering or large-format DSP orders.",
    },
    {
      id: "rate_sponsored",
      label: "In-App Sponsored Listing Rate (%)",
      placeholder: "e.g. 5.0",
      type: "number",
      required: false,
      help: "Sponsored-listing or promoted-placement fee rate if charged separately from the core DSP commission.",
    },
    {
      id: "marketing_fee_pct",
      label: "Marketing Opt-In Fee (%)",
      placeholder: "e.g. 0.0",
      type: "number",
      required: false,
      help: "Additional marketing fee percentage for DSP advertising or boosted-visibility participation.",
    },
    {
      id: "error_charge_cap",
      label: "Error Charge Cap ($)",
      placeholder: "e.g. 0.00",
      type: "number",
      required: false,
      help: "Cap for DSP error or dispute charges where the contract limits restaurant exposure.",
    },
    {
      id: "tax_remit",
      label: "Tax Remittance by DSP?",
      placeholder: "",
      type: "select",
      required: false,
      options: ["yes", "no", "partial"],
      help: "Matches the original HTML manual-entry flow: whether the DSP remits tax, the restaurant remits it, or the arrangement is split.",
    },
    {
      id: "payout_freq",
      label: "Payout Frequency",
      placeholder: "",
      type: "select",
      required: false,
      options: ["Weekly", "Bi-weekly", "Daily", "Monthly"],
      help: "Settlement cadence used when evaluating payout timing and reconciliation expectations.",
    },
    {
      id: "override_notes",
      label: "Override / Special Terms",
      placeholder: "Non-standard rates, side agreements, promotional discounts, DashPass exclusions...",
      type: "textarea",
      required: false,
      help: "Capture non-standard rate treatments, side agreements, promotional discounts, and exclusions that change agreement interpretation.",
    },
    {
      id: "notes",
      label: "Rate Amendments / Addenda",
      placeholder: "Promotional rates, exclusions, amendments",
      type: "textarea",
      required: false,
      help: "Capture negotiated exceptions or amendments that change the base agreement interpretation.",
    },
  ],
};
