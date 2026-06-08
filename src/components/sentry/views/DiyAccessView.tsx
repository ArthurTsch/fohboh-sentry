import { useState } from "react";
import type { Role, SchemaWorkspace } from "../types";
import { HelpTip, SectionCard } from "../ui/primitives";
import { SchemaRegistryView } from "./SchemaRegistryView";
import { UserGuideView } from "./UserGuideView";

type DiyTab = "m01" | "m02" | "guide";

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
  const unlocked = role === "Admin" || role === "WGS Manager";
  const filteredWorkspaces = workspaces.filter((workspace) =>
    tab === "m01" ? workspace.module === "M01" : workspace.module === "M02",
  );

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
            DIY Access grants direct access to the M01 and M02 Schema Registry pages and the guided operating
            reference. It requires written approval and completed training with your FohBoh WGS Manager before
            activation.
          </p>

          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left">
            <div className="mb-4 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Requirements To Unlock
            </div>
            <div className="space-y-3">
              {[
                ["1", "WGS Manager approval", "Your account must be reviewed and approved by a FohBoh WGS Manager."],
                ["2", "Schema training session", "Complete a 60-minute training on M01 and M02 schema structure and field validation rules."],
                ["3", "Signed DIY acknowledgment", "Confirms you understand schema edits affect live certification accuracy."],
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
              title="DIY Access / Advanced"
              sections={[
                {
                  label: "What It Is",
                  text: "Direct access to the Schema Registry editor and contract review flow for approved self-service teams.",
                },
                {
                  label: "What It Does",
                  text: "Lets trained teams review mappings, contract truth, and guided operating reference without routing every change through WGS.",
                },
                {
                  label: "Why It Matters",
                  text: "Incorrect schema or contract truth affects live certifications, so this surface should stay explicit and review-oriented.",
                },
              ]}
              footerLabel="Access State"
              footerValue="Approved and trained"
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

      <div className="flex gap-2 border-b border-[var(--border)]">
        <DiyTabButton active={tab === "m01"} label="M01 Schema Registry" onClick={() => setTab("m01")} />
        <DiyTabButton active={tab === "m02"} label="M02 Schema Registry" onClick={() => setTab("m02")} />
        <DiyTabButton active={tab === "guide"} label="User Guide" onClick={() => setTab("guide")} />
      </div>

      {tab === "guide" ? (
        <UserGuideView />
      ) : (
        <SchemaRegistryView
          workspaces={filteredWorkspaces}
          onEditWorkspace={onEditWorkspace}
          onSealWorkspace={onSealWorkspace}
        />
      )}
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
