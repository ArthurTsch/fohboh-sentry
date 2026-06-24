import type { ReactNode } from "react";
import { roleClass } from "./config";
import type { SessionState, SupportModeState, ViewId } from "./types";
import { getInitials } from "./utils";
import { HelpTip } from "./ui/primitives";

const navHelp: Record<
  ViewId | "role" | "support" | "diy",
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
  log: {
    title: "Sidebar / Recovery",
    sections: [
      { label: "What It Is", text: "Immutable timestamped ledger of certifications, uploads, schema changes, and user actions." },
      { label: "What It Does", text: "Filters into SHA-256-protected and editable records with user ID and timestamp on each event." },
      { label: "Why It Matters", text: "The Activity Log is the chain-of-custody proof used in any dispute review." },
    ],
    footerLabel: "Immutability",
    footerValue: "SHA-256 sealed / cannot be altered",
  },
  permissions: {
    title: "Sidebar / Settings",
    sections: [
      { label: "What It Is", text: "Team access management. Three roles: Admin, Manager, and Viewer." },
      { label: "What It Does", text: "Assigns roles per user. Role-based controls are enforced at the architecture level, not just the UI." },
      { label: "Why It Matters", text: "Sealing and governed actions remain restricted regardless of what the interface displays." },
    ],
    footerLabel: "Role Enforcement",
    footerValue: "Architecture-level, not UI-only",
  },
  userguide: {
    title: "Sidebar / Help",
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
      { label: "What It Is", text: "Intake center for CSV, PDF, and manual-entry artifacts." },
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
    title: "Sidebar / Profile",
    sections: [
      { label: "What It Is", text: "Your current session identity, role boundary, and account scope." },
      { label: "What It Does", text: "Opens the profile surface for the logged-in operator or WGS user." },
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
                {group.items.map((item) => {
                  const active = item.id === activeView;
                  const help = navHelp[item.id];

                  return (
                    <SidebarItem
                      key={item.id}
                      active={active}
                      icon={item.icon}
                      label={item.label}
                      help={help}
                      onClick={() => onViewChange(item.id)}
                    />
                  );
                })}

                {group.section === "Settings & Help" ? (
                  <SidebarItem
                    active={false}
                    icon="💬"
                    label="Contact Support"
                    help={navHelp.support}
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
                className={`flex items-center gap-2 rounded-xl ${
                  activeView === "diy" ? "bg-[rgba(214,48,49,0.08)]" : "opacity-80 hover:bg-[var(--surface)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onViewChange("diy")}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                    activeView === "diy" ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"
                  }`}
                >
                  <span>🔒</span>
                  <span className="truncate">DIY Access</span>
                  <span className="ml-auto rounded-full bg-[rgba(214,48,49,0.08)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
                    WGS Only
                  </span>
                </button>
                <span className="mr-3 shrink-0">
                  <HelpTip
                    title={navHelp.diy.title}
                    sections={navHelp.diy.sections}
                    footerLabel={navHelp.diy.footerLabel}
                    footerValue={navHelp.diy.footerValue}
                  />
                </span>
              </div>

              {session.role === "WGS Manager" ? (
                <SidebarItem
                  active={activeView === "wgs"}
                  icon="🛠"
                  label="WGS Admin Panel"
                  help={navHelp.wgs}
                  onClick={() => onViewChange("wgs")}
                />
              ) : null}
            </div>
          </div>
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          <div className="mb-3 flex items-center gap-2 rounded-xl hover:bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => onViewChange("profile")}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--text)] text-sm font-bold text-white">
                {getInitials(session.email)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm text-[var(--text)]">{session.email}</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.16em] ${roleClass[session.role]}`}
                  >
                    {session.role}
                  </span>
                </div>
              </div>
            </button>
            <span className="mr-1 shrink-0">
              <HelpTip
                title={navHelp.profile.title}
                sections={navHelp.profile.sections}
                footerLabel={navHelp.profile.footerLabel}
                footerValue={navHelp.profile.footerValue}
              />
            </span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
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
        <span>{icon}</span>
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
