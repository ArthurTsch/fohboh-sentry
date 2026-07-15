import type { ReactNode } from "react";
import { roleClass } from "./config";
import type { SessionState, SupportModeState, ViewId } from "./types";
import { getInitials } from "./utils";
import { HelpTip } from "./ui/primitives";

const navHelp: Record<
  ViewId | "role" | "support" | "diy" | "profile",
  {
    footerLabel?: string;
    footerValue?: string;
    sections: { label: string; text: string }[];
    title: string;
  }
> = {
  dashboard: {
    title: "Sidebar / Overview",
    sections: [
      { label: "What It Is", text: "Your portfolio command center. Aggregate Trust Scores, recovery MTD, module health, and recent activity across all locations." },
      { label: "What It Does", text: "Refreshes every time Loop A runs a certification cycle. All figures are certified, not estimated." },
      { label: "Why It Matters", text: "The fastest way to spot a Trust Score drop or a missing certification before it becomes a legal gap." },
    ],
    footerLabel: "Refresh",
    footerValue: "Every Loop A certification cycle",
  },
  waterfall: {
    title: "Sidebar / Recovery",
    sections: [
      { label: "What It Is", text: "A per-location grid showing M01 and M02 Trust Scores, certified recovery amounts, IUM, and module status side by side." },
      { label: "What It Does", text: "Lets you compare all locations at a glance, expand any row to see the detail, and launch data uploads or CAAR generation from each row." },
      { label: "Why It Matters", text: "The primary operational view. If a location has a Trust Score gap or a recovery opportunity, it shows up here first." },
    ],
    footerLabel: "Coverage",
    footerValue: "All enrolled locations",
  },
  caars: {
    title: "Sidebar / Recovery",
    sections: [
      { label: "What It Is", text: "Court-Admissible Analysis Reports: every sealed, SHA-256-hashed evidence package your portfolio has produced." },
      { label: "What It Does", text: "Shows CAAR status, certified variance amounts, legal admissibility flags, and download links for the full ExportPack." },
      { label: "Why It Matters", text: "A CAAR is certified evidence that self-authenticates under FRE 803(6), 902(11), and 1002." },
    ],
    footerLabel: "Legal Standard",
    footerValue: "FRE 803(6) / 902(11) / 1002",
  },
  billing: {
    title: "Sidebar / Account",
    sections: [
      { label: "What It Is", text: "The billing surface for subscription pricing, certified CAAR transaction fees, monthly statements, and saved payment methods." },
      { label: "What It Does", text: "Shows what is currently due based on sealed CAAR output and prepares the account for automated monthly invoicing later." },
      { label: "Why It Matters", text: "Billing is based on certified recoverable amounts, not collection contingency, and must remain traceable to specific sealed CAARs." },
    ],
    footerLabel: "Fee Model",
    footerValue: "Monthly plan + certified CAAR transaction fees",
  },
  log: {
    title: "Sidebar / Account",
    sections: [
      { label: "What It Is", text: "Immutable timestamped ledger of certifications, uploads, schema changes, and user actions." },
      { label: "What It Does", text: "Filters into SHA-256-protected and editable records with user ID and timestamp on each event." },
      { label: "Why It Matters", text: "The Activity Log is the chain-of-custody proof used in any dispute review." },
    ],
    footerLabel: "Immutability",
    footerValue: "SHA-256 sealed / cannot be altered",
  },
  permissions: {
    title: "Sidebar / Account",
    sections: [
      { label: "What It Is", text: "Team and access visibility for the current account, including operator authority and governance-sensitive roles." },
      { label: "What It Does", text: "Shows who can operate locations, certification, and governed WGS workflows under the current production access model." },
      { label: "Why It Matters", text: "Sealing, certification, and support-mode actions remain role-gated even when a user can see the surface." },
    ],
    footerLabel: "Role Enforcement",
    footerValue: "Architecture-level, not UI-only",
  },
  userguide: {
    title: "Sidebar / Account",
    sections: [
      { label: "What It Is", text: "Step-by-step platform guide covering onboarding, modules, certification, CAAR, and ExportPack." },
      { label: "What It Does", text: "Walks operators through each stage of the workflow with context on what the step does and why." },
      { label: "Why It Matters", text: "New operators and WGS Advisors use this as their primary reference before the first live certification run." },
    ],
  },
  faq: {
    title: "Sidebar / Help",
    sections: [
      { label: "What It Is", text: "Answers to common questions about Trust Scores, CAAR generation, module unlock requirements, and WGS onboarding." },
      { label: "What It Does", text: "Lets you search by keyword or browse by topic before escalating to support." },
      { label: "Why It Matters", text: "Correct answers to Trust Score and CAAR questions prevent avoidable certification delays." },
    ],
    footerLabel: "Coverage",
    footerValue: "Trust Score / CAAR / Modules / WGS",
  },
  uploads: {
    title: "Sidebar / Workflows",
    sections: [
      { label: "What It Is", text: "Intake center for CSV and PDF evidence artifacts." },
      { label: "What It Does", text: "Tracks evidence readiness before data is allowed into certification." },
      { label: "Why It Matters", text: "Weak intake hygiene quickly destroys downstream trust." },
    ],
    footerLabel: "Intake Gate",
    footerValue: "Upload -> Hash -> Schema -> Fields",
  },
  schema: {
    title: "Sidebar / Workflows",
    sections: [
      { label: "What It Is", text: "Governed field-mapping and contract-truth layer behind every certification run." },
      { label: "What It Does", text: "Lets teams review mappings, contract config, missing fields, and vault state." },
      { label: "Why It Matters", text: "Bad schema or contract truth invalidates recovery output for that vendor." },
    ],
    footerLabel: "Seal Requirement",
    footerValue: "Verified required fields only",
  },
  onboarding: {
    title: "Sidebar / Workflows",
    sections: [
      { label: "What It Is", text: "Guided setup for new locations, vendors, evidence intake, and first certification." },
      { label: "What It Does", text: "Coordinates operator and WGS work before the location is treated as live." },
      { label: "Why It Matters", text: "Most release blockers come from onboarding shortcuts taken too early." },
    ],
  },
  wgs: {
    title: "Sidebar / Admin",
    sections: [
      { label: "What It Is", text: "White Glove Services admin interface for support queue, approvals, customer health, and user management." },
      { label: "What It Does", text: "Lets governance staff enter Support Mode and remediate customer workflows directly." },
      { label: "Why It Matters", text: "The WGS team uses this surface to keep customer trust above release threshold across accounts." },
    ],
    footerLabel: "Role Required",
    footerValue: "WGS Manager only",
  },
  role: {
    title: "Topbar / Access",
    sections: [
      { label: "What It Is", text: "Your current role for this session, which controls governance-sensitive actions." },
      { label: "What It Does", text: "Determines access to user management, support mode, certification, and schema sealing." },
      { label: "Why It Matters", text: "The role boundary is part of the evidentiary control model, not just UI decoration." },
    ],
    footerLabel: "Enforcement",
    footerValue: "Architecture-level workflow gating",
  },
  profile: {
    title: "Sidebar / Account",
    sections: [
      { label: "What It Is", text: "Your account settings surface for identity, password, notification preferences, and session scope." },
      { label: "What It Does", text: "Opens the settings screen for the logged-in operator or WGS user." },
      { label: "Why It Matters", text: "Access and data visibility are tied to this identity record." },
    ],
    footerLabel: "Identity Source",
    footerValue: "Current authenticated session",
  },
  support: {
    title: "Sidebar / Help",
    sections: [
      { label: "What It Is", text: "Opens a support request to your dedicated WGS Advisor, not a generic helpdesk." },
      { label: "What It Does", text: "Creates a timestamped support path so the WGS team can triage trust or certification issues." },
      { label: "Why It Matters", text: "If Trust Score dropped or certification failed, support should review the issue before new data is processed." },
    ],
    footerLabel: "Response Target",
    footerValue: "Next business day (High: same day)",
  },
  diy: {
    title: "Sidebar / Advanced",
    sections: [
      { label: "What It Is", text: "Direct access to the Schema Registry column mapping editor and Contract Config for your own locations." },
      { label: "What It Does", text: "Allows trained operators to edit mappings and review contract layer configurations without routing through the WGS team." },
      { label: "Why It Matters", text: "DIY Access is a privilege, not a default. Incorrect column mapping systematically distorts every certified figure for the entire period." },
    ],
    footerLabel: "Approval Required",
    footerValue: "WGS Advisor sign-off",
  },
};

export function SentryShell({
  activeView,
  children,
  meta,
  navGroups,
  onExitSupportMode,
  onOpenSupport,
  onRunPrimaryCertification,
  onSignOut,
  onViewChange,
  session,
  supportMode,
  visibleLocationCount,
}: {
  activeView: ViewId;
  children: ReactNode;
  meta: { eyebrow: string; sub: string; title: string };
  navGroups: { items: { icon: string; id: ViewId; label: string }[]; section: string }[];
  onExitSupportMode: () => void;
  onOpenSupport: () => void;
  onRunPrimaryCertification: () => void;
  onSignOut: () => void;
  onViewChange: (view: ViewId) => void;
  session: SessionState;
  supportMode: SupportModeState;
  visibleLocationCount: number;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--surface)] text-[var(--text)]">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-[var(--border)] bg-white lg:flex">
        <div className="border-b border-[var(--border)] px-5 py-5">
          <button type="button" onClick={() => onViewChange("dashboard")} className="flex items-center gap-3 text-left">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            <div>
              <div className="font-[family-name:var(--font-display)] text-base font-bold tracking-[-0.03em]">
                FohBoh <span className="text-[var(--muted)]">|</span>
              </div>
              <div className="text-sm italic text-[var(--accent)]">Sentry</div>
            </div>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.section} className="mb-5">
              <div className="px-3 pb-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                {group.section}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    active={item.id === activeView}
                    help={navHelp[item.id]}
                    icon={item.icon}
                    label={item.label}
                    onClick={() => onViewChange(item.id)}
                  />
                ))}

                {group.section === "Help" ? (
                  <SidebarItem
                    active={false}
                    help={navHelp.support}
                    icon="support"
                    label="Contact Support"
                    onClick={onOpenSupport}
                  />
                ) : null}
              </div>
            </div>
          ))}

          <div className="mb-5">
            <div className="px-3 pb-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Advanced
            </div>
            <div className="space-y-1">
              <div
                className={`rounded-xl ${
                  activeView === "diy" ? "bg-[rgba(214,48,49,0.08)]" : "opacity-80 hover:bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-start gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onViewChange("diy")}
                    className={`flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-2 text-left text-sm ${
                      activeView === "diy" ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0" aria-hidden="true">
                      <SidebarGlyph name="diy" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block leading-5">DIY Access</span>
                      <span className="mt-1 inline-flex rounded-full bg-[rgba(214,48,49,0.08)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                        WGS Only
                      </span>
                    </span>
                  </button>
                  <span className="mt-2 mr-2 shrink-0">
                    <HelpTip
                      title={navHelp.diy.title}
                      sections={navHelp.diy.sections}
                      footerLabel={navHelp.diy.footerLabel}
                      footerValue={navHelp.diy.footerValue}
                    />
                  </span>
                </div>
              </div>

              {session.role === "WGS Manager" ? (
                <SidebarItem
                  active={activeView === "wgs"}
                  help={navHelp.wgs}
                  icon="wgs"
                  label="WGS Admin Panel"
                  onClick={() => onViewChange("wgs")}
                />
              ) : null}
            </div>
          </div>
        </nav>

        <div className="mt-auto border-t border-[var(--border)] p-4">
          <div className="mb-3 rounded-xl hover:bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => onViewChange("profile")}
              className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--text)] text-sm font-bold text-white">
                {getInitials(session.name?.trim() || session.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm leading-5 text-[var(--text)]">
                  {session.name?.trim() || session.email}
                </div>
                {session.name?.trim() ? (
                  <div className="truncate text-xs leading-5 text-[var(--muted)]">{session.email}</div>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.16em] ${roleClass[session.role]}`}
                  >
                    {session.role}
                  </span>
                </div>
              </div>
            </button>
            <div className="flex justify-end px-2 pb-2">
              <HelpTip
                title={navHelp.profile.title}
                sections={navHelp.profile.sections}
                footerLabel={navHelp.profile.footerLabel}
                footerValue={navHelp.profile.footerValue}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-3 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {supportMode.active ? (
          <div className="border-b border-[var(--border)] bg-[rgba(0,97,255,0.08)] px-5 py-3 text-sm text-[var(--info)]">
            Support Mode: {supportMode.accountName}
            <button
              type="button"
              onClick={onExitSupportMode}
              className="ml-3 rounded-lg border border-[rgba(0,97,255,0.16)] px-2 py-1 text-xs"
            >
              Exit
            </button>
          </div>
        ) : null}

        <header className="border-b border-[var(--border)] bg-white">
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 lg:px-7">
            <div className="flex-1">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                {meta.eyebrow}
              </div>
              <div className="mt-1 text-xl font-semibold tracking-[-0.03em]">{meta.title}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{meta.sub}</div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] ${roleClass[session.role]}`}
              >
                {session.role}
              </span>
              <HelpTip
                title={navHelp.role.title}
                sections={navHelp.role.sections}
                footerLabel={navHelp.role.footerLabel}
                footerValue={navHelp.role.footerValue}
              />
            </div>
            <button
              type="button"
              onClick={onRunPrimaryCertification}
              disabled={visibleLocationCount === 0}
              className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Run Certification
            </button>
          </div>
          <div className="overflow-x-auto border-t border-[var(--border)] px-4 py-2 lg:hidden">
            <div className="flex gap-2">
              {navGroups.flatMap((group) => group.items).map((item) => {
                const active = item.id === activeView;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onViewChange(item.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-sm ${
                      active ? "bg-[var(--text)] text-white" : "bg-[var(--surface)] text-[var(--muted)]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-7">{children}</main>
      </div>
    </div>
  );
}

function SidebarItem({
  active,
  help,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  help: {
    footerLabel?: string;
    footerValue?: string;
    sections: { label: string; text: string }[];
    title: string;
  };
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl ${active ? "bg-[rgba(214,48,49,0.08)]" : "hover:bg-[var(--surface)]"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
          active ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
      >
        <span className="shrink-0" aria-hidden="true">
          <SidebarGlyph name={icon} />
        </span>
        <span className="truncate">{label}</span>
      </button>
      <span className="mr-3 shrink-0">
        <HelpTip
          title={help.title}
          sections={help.sections}
          footerLabel={help.footerLabel}
          footerValue={help.footerValue}
        />
      </span>
    </div>
  );
}

function SidebarGlyph({ name }: { name: string }) {
  const shared = "h-4 w-4 text-current";

  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="2" width="5" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="12" width="5" height="2" rx="1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "waterfall") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <path d="M2.5 4.5h3v3h-3zM6.5 8.5h3v3h-3zM10.5 4.5h3v7h-3z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "caars") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1.5 1.5 0 0 1 1-1.5Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "log") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.8V8l2.1 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "permissions") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <circle cx="6" cy="5.4" r="2.1" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="11.1" cy="6.1" r="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.8 12.8c.5-2.2 2.2-3.6 4.3-3.6 2 0 3.7 1.4 4.2 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M10.1 11.8c.2-1.3 1.1-2.2 2.3-2.5.5-.1.8-.1 1.2 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "userguide") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2H13v11.5H4.5A1.5 1.5 0 0 0 3 15V3.5Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 5.5H10.5M5.5 8H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "faq") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6.8 6.3A1.4 1.4 0 1 1 9 7.5c-.7.4-1 .8-1 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11.6" r=".8" fill="currentColor" />
      </svg>
    );
  }

  if (name === "support") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v4A1.5 1.5 0 0 1 11.5 10H8l-2.5 2V10h-1A1.5 1.5 0 0 1 3 8.5v-4Z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "diy") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <path d="M5.5 7V5.8A2.5 2.5 0 0 1 8 3.3a2.5 2.5 0 0 1 2.5 2.5V7" stroke="currentColor" strokeWidth="1.4" />
        <rect x="4" y="7" width="8" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "wgs") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <path d="M8 2.5 13 5.2v5.6L8 13.5 3 10.8V5.2L8 2.5Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5.2v5.6M5.2 6.7 8 8.2l2.8-1.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "billing") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 6.2h11" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.2 10.2h2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={shared}>
        <circle cx="8" cy="5.3" r="2.3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3.7 13c.6-2 2.3-3.2 4.3-3.2 2 0 3.7 1.2 4.3 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" className={shared}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
