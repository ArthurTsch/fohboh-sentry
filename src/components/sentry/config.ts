import type { Role, ViewId } from "./types";

export const viewMeta: Record<ViewId, { eyebrow: string; title: string; sub: string }> = {
  dashboard: {
    eyebrow: "Overview",
    title: "Portfolio Dashboard",
    sub: "Certified recovery, Trust Score health, and module readiness across the active portfolio.",
  },
  waterfall: {
    eyebrow: "Recovery",
    title: "Location Waterfall",
    sub: "Per-location Trust Score, certified recovery, and evidence readiness side by side.",
  },
  caars: {
    eyebrow: "Recovery",
    title: "CAARs",
    sub: "Court-admissible reports and remediation candidates generated from sealed evidence packages.",
  },
  billing: {
    eyebrow: "Account",
    title: "Billing",
    sub: "Plan, payment methods, monthly statements, and certified CAAR transaction fees for this account.",
  },
  log: {
    eyebrow: "Account",
    title: "Activity Log",
    sub: "Timestamped operational events with immutable and draft-state separation.",
  },
  profile: {
    eyebrow: "Account",
    title: "Account Settings",
    sub: "Current session identity, profile preferences, password, and visible account footprint.",
  },
  permissions: {
    eyebrow: "Account",
    title: "Team & Access",
    sub: "Account access, role scope, and who can operate locations, governance, and certification workflows.",
  },
  diy: {
    eyebrow: "Advanced",
    title: "DIY Access",
    sub: "Schema Registry editor and guided operator reference for approved self-service teams.",
  },
  userguide: {
    eyebrow: "Help",
    title: "Platform User Guide",
    sub: "Operator and WGS reference covering onboarding, schema sealing, certification, and CAAR delivery.",
  },
  faq: {
    eyebrow: "Help",
    title: "FAQ",
    sub: "Common questions about Trust Score, CAAR eligibility, schema control, and evidence readiness.",
  },
  uploads: {
    eyebrow: "Workflows",
    title: "Upload Center",
    sub: "Source-file intake across M01 and M02 with evidence readiness tracking.",
  },
  schema: {
    eyebrow: "Workflows",
    title: "Schema Registry",
    sub: "Column mapping, contract configuration, and vault-sealed schema state.",
  },
  onboarding: {
    eyebrow: "Workflows",
    title: "Onboarding",
    sub: "Guided operational setup for locations, source systems, and certification readiness.",
  },
  wgs: {
    eyebrow: "Admin",
    title: "WGS Admin",
    sub: "Support queue, approvals, account health, and governed support-mode operations.",
  },
};

export const navigation = [
  {
    section: "Overview",
    items: [{ id: "dashboard" as ViewId, label: "Dashboard", icon: "dashboard" }],
  },
  {
    section: "Recovery",
    items: [
      { id: "waterfall" as ViewId, label: "Location Waterfall", icon: "waterfall" },
      { id: "caars" as ViewId, label: "CAARs", icon: "caars" },
    ],
  },
  {
    section: "Account",
    items: [
      { id: "billing" as ViewId, label: "Billing", icon: "billing" },
      { id: "permissions" as ViewId, label: "Team & Access", icon: "permissions" },
      { id: "log" as ViewId, label: "Activity Log", icon: "log" },
      { id: "profile" as ViewId, label: "Account Settings", icon: "profile" },
      { id: "userguide" as ViewId, label: "User Guide", icon: "userguide" },
    ],
  },
  {
    section: "Help",
    items: [
      { id: "faq" as ViewId, label: "FAQ", icon: "faq" },
    ],
  },
];

export const roleClass: Record<Role, string> = {
  Admin: "bg-[rgba(214,48,49,0.08)] text-[var(--accent)] border border-[rgba(214,48,49,0.2)]",
  SuperAdmin:
    "bg-[rgba(17,17,17,0.08)] text-[var(--text)] border border-[rgba(17,17,17,0.16)]",
  Manager: "bg-[rgba(255,152,0,0.1)] text-[#b86a00] border border-[rgba(255,152,0,0.24)]",
  Viewer: "bg-[var(--panel-soft)] text-[var(--muted)] border border-[var(--border)]",
  "WGS Manager":
    "bg-[rgba(0,97,255,0.08)] text-[var(--info)] border border-[rgba(0,97,255,0.18)]",
};
