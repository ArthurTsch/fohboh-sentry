"use client";

import { useMemo, useState } from "react";
import type { Role, SchemaWorkspace } from "../types";
import { Badge, HelpTip, MetaBlock, SectionCard } from "../ui/primitives";
import { UserGuideView } from "./UserGuideView";

type DiyTab = "m01" | "m02" | "guide";
type RegistryTab = "mappings" | "missing" | "contract" | "vault";

export function DiyAccessView({
  onEditWorkspace,
  onSealWorkspace,
  role,
  workspaces,
}: {
  onEditWorkspace: (workspace: SchemaWorkspace) => void;
  onSealWorkspace: (workspace: SchemaWorkspace) => void;
  role: Role;
  workspaces: SchemaWorkspace[];
}) {
  const [tab, setTab] = useState<DiyTab>("m01");
  const [m01Panel, setM01Panel] = useState<RegistryTab>("mappings");
  const [m02Panel, setM02Panel] = useState<RegistryTab>("mappings");
  const unlocked = role === "Admin" || role === "SuperAdmin" || role === "WGS Manager";

  const m01Workspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.module === "M01"),
    [workspaces],
  );
  const m02Workspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.module === "M02"),
    [workspaces],
  );

  const [m01Vendor, setM01Vendor] = useState(m01Workspaces[0]?.vendor ?? "");
  const [m02Vendor, setM02Vendor] = useState(m02Workspaces[0]?.vendor ?? "");

  const activeM01 = m01Workspaces.find((workspace) => workspace.vendor === m01Vendor) ?? m01Workspaces[0] ?? null;
  const activeM02 = m02Workspaces.find((workspace) => workspace.vendor === m02Vendor) ?? m02Workspaces[0] ?? null;

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionCard className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.08)] text-3xl text-[var(--accent)]">
            🔒
          </div>
          <div className="mt-5 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
            DIY Access is locked
          </div>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            DIY Access grants you direct access to the M01 and M02 Schema Registry pages and unlocks the User Guide.
            It requires written approval and a completed training session with your FohBoh WGS Manager before
            activation.
          </p>
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left">
            <div className="mb-4 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Requirements to Unlock
            </div>
            <div className="space-y-3">
              {[
                ["1", "WGS Manager approval", "Your account must be reviewed and approved by a FohBoh WGS Manager."],
                [
                  "2",
                  "Schema training session",
                  "Complete a 60-minute training on M01 and M02 schema structure and field validation rules.",
                ],
                [
                  "3",
                  "Signed DIY acknowledgment",
                  "Confirms you understand that schema edits affect live certification accuracy.",
                ],
              ].map(([step, title, body]) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[10px] font-bold text-[var(--accent)]">
                    {step}
                  </span>
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--text)]">{title}</div>
                    <div className="text-[12px] text-[var(--muted)]">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              DIY Access
            </div>
            <HelpTip
              title="Sidebar / Advanced"
              sections={[
                {
                  label: "What It Is",
                  text: "Direct access to the Schema Registry column mapping editor and Contract Config for approved locations.",
                },
                {
                  label: "What It Does",
                  text: "Allows trained operators to review mappings, missing fields, contract truth, and sealed vault state without routing every inspection through WGS.",
                },
                {
                  label: "Why It Matters",
                  text: "Incorrect schema edits systematically distort every certified figure for the entire period.",
                },
              ]}
              footerLabel="Approval Required"
              footerValue="WGS Advisor sign-off"
            />
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Schema Registry editor and User Guide for approved self-service teams.
          </div>
        </div>
        <span className="rounded-full border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--success)]">
          Approved & Trained
        </span>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        <DiyTabButton active={tab === "m01"} label="M01 Schema Registry" onClick={() => setTab("m01")} />
        <DiyTabButton active={tab === "m02"} label="M02 Schema Registry" onClick={() => setTab("m02")} />
        <DiyTabButton active={tab === "guide"} label="User Guide" onClick={() => setTab("guide")} />
      </div>

      {tab === "guide" ? <UserGuideView /> : null}
      {tab === "m01" && activeM01 ? (
        <RegistryWorkspacePanel
          workspace={activeM01}
          workspaces={m01Workspaces}
          activePanel={m01Panel}
          onChangePanel={setM01Panel}
          onChangeVendor={(vendor) => {
            setM01Vendor(vendor);
            setM01Panel("mappings");
          }}
          onEditWorkspace={onEditWorkspace}
          onSealWorkspace={onSealWorkspace}
        />
      ) : null}
      {tab === "m02" && activeM02 ? (
        <RegistryWorkspacePanel
          workspace={activeM02}
          workspaces={m02Workspaces}
          activePanel={m02Panel}
          onChangePanel={setM02Panel}
          onChangeVendor={(vendor) => {
            setM02Vendor(vendor);
            setM02Panel("mappings");
          }}
          onEditWorkspace={onEditWorkspace}
          onSealWorkspace={onSealWorkspace}
        />
      ) : null}
    </div>
  );
}

function RegistryWorkspacePanel({
  activePanel,
  onChangePanel,
  onChangeVendor,
  onEditWorkspace,
  onSealWorkspace,
  workspace,
  workspaces,
}: {
  activePanel: RegistryTab;
  onChangePanel: (panel: RegistryTab) => void;
  onChangeVendor: (vendor: string) => void;
  onEditWorkspace: (workspace: SchemaWorkspace) => void;
  onSealWorkspace: (workspace: SchemaWorkspace) => void;
  workspace: SchemaWorkspace;
  workspaces: SchemaWorkspace[];
}) {
  const requiredFields = workspace.fields.filter((field) => field.required);
  const missingFields = workspace.fields.filter((field) => field.confidence === "Missing");
  const reviewFields = workspace.fields.filter((field) => field.confidence === "Needs Review");
  const commissionBase = requiredFields[0]?.source ?? workspace.fields[0]?.source ?? "source column";

  return (
    <SectionCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-[var(--text)]">
            {workspace.module} - {workspace.module === "M01" ? "Merchant Fee Recovery Schema" : "Delivery Fee Recovery Schema"}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">
            {workspace.module === "M01"
              ? "Card processor column mapping | Contract Config | Sealed by WGS Manager"
              : "DSP column mapping | Contract Config | Sealed by WGS Manager"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {workspaces.map((item) => (
              <button
                key={`${item.module}:${item.vendor}`}
                type="button"
                onClick={() => onChangeVendor(item.vendor)}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                  item.vendor === workspace.vendor
                    ? "border-[var(--accent)] bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
                }`}
              >
                {item.vendor}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => downloadWorkspaceTemplate(workspace)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            CSV Template
          </button>
          <button
            type="button"
            onClick={() => onEditWorkspace(workspace)}
            className="rounded-lg bg-[rgba(214,48,49,0.08)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[rgba(214,48,49,0.14)]"
          >
            Edit Schema
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-4">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Commission Base Field
        </div>
        <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--accent)]">
            Expected Fee = [{commissionBase}] x (contracted_rate / 100)
          </span>{" "}
          - {workspace.contract[0]?.source ?? "Active sealed configuration drives deterministic fee reconstruction."}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4">
        {(["mappings", "missing", "contract", "vault"] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => onChangePanel(panel)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              activePanel === panel
                ? "border-[var(--text)] bg-[var(--text)] text-white"
                : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
            }`}
          >
            {panel === "mappings"
              ? "Column Mappings"
              : panel === "missing"
                ? "Missing Fields"
                : panel === "contract"
                  ? "Contract Config"
                  : "Vault Record"}
          </button>
        ))}
      </div>

      {activePanel === "mappings" ? (
        <div className="space-y-3">
          {workspace.fields.map((field) => (
            <div
              key={field.canonical}
              className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[1fr_1fr_140px]"
            >
              <div>
                <div className="font-medium text-[var(--text)]">{field.canonical}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {field.required ? "Required canonical field" : "Optional canonical field"}
                </div>
              </div>
              <div className="font-[family-name:var(--font-mono)] text-sm text-[var(--info)]">{field.source}</div>
              <div className="md:text-right">
                <Badge
                  tone={
                    field.confidence === "Verified"
                      ? "success"
                      : field.confidence === "Needs Review"
                        ? "warning"
                        : "danger"
                  }
                >
                  {field.confidence}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activePanel === "missing" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Missing Fields" value={String(missingFields.length)} tone="danger" />
            <MetricCard label="Needs Review" value={String(reviewFields.length)} tone="warning" />
            <MetricCard label="Required Fields" value={String(requiredFields.length)} tone="success" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
            {missingFields.length > 0
              ? "Fields missing from the native export must be resolved before certification. This is the fastest place to see what still blocks D1 and D5."
              : "No canonical fields are currently marked missing. Review items may still require WGS confirmation before the next seal."}
          </div>
          <div className="space-y-3">
            {workspace.fields
              .filter((field) => field.confidence !== "Verified")
              .map((field) => (
                <div key={field.canonical} className="rounded-xl border border-[var(--border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-[var(--text)]">{field.canonical}</div>
                    <Badge tone={field.confidence === "Missing" ? "danger" : "warning"}>{field.confidence}</Badge>
                  </div>
                  <div className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                    Source column: {field.source}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {activePanel === "contract" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {workspace.contract.map((field) => (
              <div key={field.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {field.label}
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--text)]">{field.value}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">Source: {field.source}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEditWorkspace(workspace)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Edit Schema
            </button>
            <button
              type="button"
              onClick={() => onSealWorkspace(workspace)}
              className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
            >
              Seal Contract Config
            </button>
          </div>
        </div>
      ) : null}

      {activePanel === "vault" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <MetaBlock label="Version" value={workspace.vault.version} />
            <MetaBlock label="Hash" value={workspace.vault.hash} />
            <MetaBlock label="Sealed By" value={workspace.vault.sealedBy} />
            <MetaBlock label="Sealed At" value={workspace.vault.sealedAt} />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
            The Vault Record is the sealed, SHA-256-hashed version of this Schema Registry entry. It is the immutable
            proof of what schema state was used during certification.
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "success" | "warning";
  value: string;
}) {
  const toneClass = {
    danger: "text-[var(--accent)]",
    success: "text-[var(--success)]",
    warning: "text-[#b86a00]",
  }[tone];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.05em] ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function DiyTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-xl px-4 py-3 text-sm transition ${
        active
          ? "border border-b-white border-[var(--border)] bg-white font-semibold text-[var(--text)]"
          : "text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </button>
  );
}

function downloadWorkspaceTemplate(workspace: SchemaWorkspace) {
  if (typeof window === "undefined") return;
  const headers = workspace.fields.map((field) => field.source).join(",");
  const blob = new Blob([`${headers}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `FohBoh_${workspace.module}_${workspace.vendor.replace(/\s+/g, "_")}_Template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
