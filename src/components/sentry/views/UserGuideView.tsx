type GuideStep = {
  id: string;
  text: string;
  title: string;
  where: string;
};

type GuidePhase = {
  badge?: string;
  callout?: string;
  id: string;
  steps: GuideStep[];
  subtitle: string;
  title: string;
};

const guidePhases: GuidePhase[] = [
  {
    callout:
      "Have your signed DSP agreements, signed merchant services agreement, and bank statements ready. These are required for Contract Config sealing. Certification cannot run until schemas are sealed.",
    id: "1",
    subtitle: "Complete once per organisation - your WGS Manager handles this with you",
    title: "Account Setup & Onboarding",
    steps: [
      {
        id: "1.1",
        text:
          "On the Sentry landing page, click Request Access and complete the intake form. Your WGS Manager will review and set up your account within one business day.",
        title: "Request Access",
        where: "Where: Landing page -> Request Access ->",
      },
      {
        id: "1.2",
        text:
          "After your first login, the 6-step Onboarding Wizard opens automatically. Enter your organisation name, locations, active delivery platforms, and card processor. Each step unlocks the next - don't skip.",
        title: "Complete the Onboarding Wizard",
        where: "Where: Auto-launched on first login",
      },
      {
        id: "1.3",
        text:
          "Each physical location is tracked separately - its own Trust Score, its own Schema Registry, its own CAAR history. Add all active locations in Step 2 of the wizard. You can add more later from the Location Waterfall view.",
        title: "Register Your Locations",
        where: "Where: Wizard Step 2 -> or Location Waterfall -> Add Location",
      },
    ],
  },
  {
    badge: "M01",
    id: "2",
    subtitle: "Card processor interchange certification - 107 MFR rules",
    title: "M01 - Merchant Fee Recovery Setup",
    steps: [
      {
        id: "2.1",
        text:
          "Go to Upload Data and upload your card processor's transaction-level CSV export. Use the exact file downloaded from the processor portal - never open and resave in Excel, as this changes the file hash. Maximum file size: 100MB.",
        title: "Upload Your Processor Statement",
        where: "Where: Upload Data -> M01 -> Processor Statement CSV",
      },
      {
        id: "2.2",
        text:
          "Upload a channel-level POS export for the same period. This is used for the cross-system reconciliation gate (D3). Without it, the Trust Score cannot exceed 74 and CAAR is not possible.",
        title: "Upload Your POS Transaction Export",
        where: "Where: Upload Data -> M01 -> POS Export CSV",
      },
      {
        id: "2.3",
        text:
          "Upload your executed merchant services agreement as a PDF. This is the source document for the contracted rates in Contract Config. The PDF is SHA-256 hashed on upload - the hash becomes your court-admissible chain-of-custody anchor.",
        title: "Upload Your Signed Merchant Agreement",
        where: "Where: Upload Data -> M01 -> Merchant Agreement PDF",
      },
      {
        id: "2.4",
        text:
          "In the Upload Data modal, switch to Manual Entry and enter your contracted rates. Required fields: Merchant ID, Pricing Model, Effective Date, Processor Markup (BPS), and Per-Transaction Fee. Each field has a ? tooltip explaining exactly where to find the value in your agreement.",
        title: "Enter M01 Contract Config",
        where: "Where: Upload Data -> M01 -> Manual Entry tab",
      },
      {
        id: "2.5",
        text:
          "Upload your business bank statement PDF for the matching period. This enables the External Reconciliation (ER) gate - the 3-way reconciliation between POS, processor settlement, and bank deposit. Without it, the D3 dimension scores 0 and CAAR is blocked.",
        title: "Upload Bank Statement",
        where: "Where: Upload Data -> M01 -> Bank Statement PDF",
      },
    ],
  },
  {
    badge: "M02",
    id: "3",
    subtitle: "DSP commission certification - 83 DFR rules · One setup per DSP",
    title: "M02 - Delivery Fee Recovery Setup",
    callout:
      "The Commission Base Field is the single most important field in M02 setup. It determines what column the MGE multiplies your contracted rate against. Each DSP uses a different native column name. Wrong field = every variance understated for the entire period. Read your signed agreement, find the commission base definition, then select the matching column.",
    steps: [
      {
        id: "3.1",
        text:
          "Download the settlement export from your DSP merchant portal. Upload it exactly as downloaded - no formatting, no column additions. The MGE validates the column names against your Schema Registry. 4-step intake confirmation appears after upload.",
        title: "Upload DSP Settlement CSV",
        where: "Where: Upload Data -> M02 -> [DSP Name] -> Settlement CSV",
      },
      {
        id: "3.2",
        text:
          "Upload the executed DSP merchant agreement PDF including the rate schedule. The commission rate and commission base definition in this document are the source of truth for your Contract Config. If your agreement has been updated, upload the latest signed version.",
        title: "Upload Signed DSP Agreement",
        where: "Where: Upload Data -> M02 -> [DSP Name] -> DSP Agreement PDF",
      },
      {
        id: "3.3",
        text:
          "Switch to Manual Entry and enter your DSP rates. Required fields: Restaurant UUID, Agreement Effective Date, Commission Base Field, and Delivery Commission Rate. The Commission Base Field dropdown shows all available options - hover the ? icon on each for a description of what it represents and which DSPs use it.",
        title: "Enter M02 Contract Config",
        where: "Where: Upload Data -> M02 -> Manual Entry tab",
      },
      {
        id: "3.4",
        text:
          "Each DSP (DoorDash, Uber Eats, Grubhub, etc.) has its own Schema Registry entry, its own Contract Config, and its own settlement upload. Complete steps 3.1-3.3 for each DSP you operate with.",
        title: "Repeat for Each Active DSP",
        where: "",
      },
    ],
  },
  {
    id: "4",
    subtitle: "Cryptographic lock - required before any certification run",
    title: "Schema Sealing",
    steps: [
      {
        id: "4.1",
        text:
          "Your WGS Manager reviews the Schema Registry column mappings - verifying that every native CSV column is correctly mapped to the MGE canonical field. This step requires human judgment and cannot be automated. The commission base field requires explicit attestation.",
        title: "WGS Manager Reviews Column Mappings",
        where: "",
      },
      {
        id: "4.2",
        text:
          "Once all required fields have green dot indicators, your WGS Manager seals the Contract Config. This writes a SHA-256 hash of the complete schema state to the KPI Vault. From this moment the schema is immutable - no one can change the contracted rates without breaking the hash and starting a new version.",
        title: "Seal Contract Config",
        where: "",
      },
      {
        id: "4.3",
        text:
          "After sealing, open the Vault Record tab in the Schema Registry. Confirm the schema version, DCLS lock ID, and SHA-256 hash are present. This is the permanent record that makes your CAAR self-authenticating under FRE 902(11).",
        title: "Verify Vault Record",
        where: "Where: DIY Access -> Schema Registry -> Vault Record tab",
      },
    ],
  },
  {
    id: "5",
    subtitle: "The MGE SEN-01 4-step pipeline - runs monthly",
    title: "Running Certification",
    steps: [
      {
        id: "5.1",
        text:
          "Before running certification, verify that every uploaded file shows 4 green dots: File received · SHA-256 verified · Schema columns matched · Required fields confirmed. An amber or red indicator means the MGE cannot use that file - resolve it before proceeding.",
        title: "Confirm All 4 Intake Indicators Are Green",
        where: "",
      },
      {
        id: "5.2",
        text:
          "Click the Run Certification button in the top bar (or the Run Cert button in the Location Waterfall row). The 4-step MGE pipeline overlay opens: Semantic Truths -> Deterministic Law -> Loop A -> Certify & Lock. Each step shows a green check when complete.",
        title: "Click Run Certification",
        where: "Where: Topbar -> Run Certification (or Location Waterfall -> Run Cert)",
      },
      {
        id: "5.3",
        text:
          "After the run completes, your Trust Score updates on the Dashboard and Location Waterfall. The score is a composite of 6 MQ6 dimensions (D1-D6). 85 is the gate to CAAR. If you're below 85, the most common fix is uploading the missing bank statement (which raises D3 Reconciliation from 55 to 92).",
        title: "Review Your Trust Score",
        where: "Where: Dashboard -> Trust Score · or Location Waterfall -> Trust Score column",
      },
    ],
  },
  {
    id: "6",
    subtitle: "Court-admissible output - Trust Score >= 85 required · State S3 required",
    title: "CAAR & ExportPack",
    callout:
      "FohBoh certifies the evidence. Your legal team pursues recovery. A legal opinion engagement is required before any CAAR or ExportPack is formally submitted to a court, arbitrator, or opposing party.",
    steps: [
      {
        id: "6.1",
        text:
          "Navigate to the CAARs view. Locate the entry with Court Admissible: Yes and a Trust Score >= 85. Click View Report to open the full CAAR viewer - 7 sections including the narrative findings, Trust Score breakdown, evidence chain, and chain of custody.",
        title: "Open Your CAAR",
        where: "Where: CAARs -> View Report",
      },
      {
        id: "6.2",
        text:
          "In the CAAR viewer, click DOWNLOAD PDF. Your browser print dialog opens - select Save as PDF as the destination. The resulting PDF is SHA-256 hashed, self-authenticating under FRE 902(11), and does not require a live FohBoh witness.",
        title: "Download the CAAR PDF",
        where: "Where: CAAR viewer -> DOWNLOAD PDF -> browser Save as PDF",
      },
      {
        id: "6.3",
        text:
          "Verify all 3 status indicators show READY: Claim Pack Status · Evidence Coverage · Submission Readiness. Then click GENERATE CLAIM PACK. Nine artifacts are bundled: CAAR PDF, truth source CSV, claim source CSV, signed contract, bank statement, evidence manifest, audit trail, rule citations, and SHA-256 integrity manifest.",
        title: "Generate ExportPack",
        where: "Where: CAAR viewer -> GENERATE CLAIM PACK",
      },
      {
        id: "6.4",
        text:
          "Share the ExportPack and CAAR PDF with your attorney. The CAAR self-authenticates - no FohBoh representative needs to appear. Your attorney can use it as the evidentiary basis for a formal demand letter, dispute filing, or litigation exhibit.",
        title: "Deliver to Legal Counsel",
        where: "",
      },
    ],
  },
  {
    id: "7",
    subtitle: "Ongoing - first of each month",
    title: "Monthly Certification Cycle",
    steps: [
      {
        id: "7.1",
        text:
          "On the first of each month, download new settlement CSVs from all active DSP portals and a new processor statement CSV. Download the matching bank statement PDF.",
        title: "Download Fresh Statements",
        where: "",
      },
      {
        id: "7.2",
        text:
          "Upload each file (exact portal download, no reformatting). Confirm 4 green intake indicators per file. Run Certification. If Trust Score >= 85, a new CAAR is generated automatically. Download the ExportPack and deliver to legal counsel if the variance exceeds your action threshold.",
        title: "Upload and Run",
        where: "",
      },
      {
        id: "7.3",
        text:
          "Common causes: (1) Missing bank statement -> upload it, rerun. (2) Schema column mismatch -> DSP changed their export format, contact your WGS Manager to update column mappings. (3) Missing POS export -> upload it, rerun. Check the MQ6 dimension scores in the CAAR viewer to identify which gate is failing.",
        title: "If Trust Score Drops",
        where: "",
      },
    ],
  },
];

export function UserGuideView() {
  return (
    <div className="space-y-8">
      <div className="border-b border-[var(--border)] pb-5">
        <div className="font-[family-name:var(--font-display)] text-[36px] font-bold tracking-[-0.05em] text-[var(--text)]">
          Platform User Guide
        </div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          Step-by-step reference for operators and WGS Advisors - from onboarding to CAAR delivery.
        </div>
      </div>

      {guidePhases.map((phase) => (
        <div key={phase.id} className="space-y-4">
          <div className="border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] font-[family-name:var(--font-mono)] text-[11px] font-bold text-white">
                {phase.id}
              </div>
              <div className="flex items-center gap-2">
                <div className="font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[-0.03em] text-[var(--text)]">
                  {phase.title}
                </div>
                {phase.badge ? (
                  <span className="rounded-full border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                    {phase.badge}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-1 pl-10 text-sm text-[var(--muted)]">{phase.subtitle}</div>
          </div>

          {phase.callout ? (
            <div className="border border-[rgba(214,48,49,0.18)] border-l-[3px] border-l-[var(--accent)] bg-[rgba(214,48,49,0.04)] px-4 py-4">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                Before You Start
              </div>
              <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{phase.callout}</div>
            </div>
          ) : null}

          <div className="space-y-3">
            {phase.steps.map((step) => (
              <div key={step.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="flex gap-4">
                  <div className="pt-1 font-[family-name:var(--font-mono)] text-[12px] font-bold text-[var(--accent)]">
                    {step.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-[family-name:var(--font-display)] text-[16px] font-bold tracking-[-0.02em] text-[var(--text)]">
                      {step.title}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--muted)]">{step.text}</div>
                    {step.where ? (
                      <div className="mt-4 inline-flex rounded-xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-3 py-2 text-[12px] font-semibold text-[var(--accent)]">
                        {step.where}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
