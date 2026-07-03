import { roleClass } from "../config";
import type { PermissionRecord } from "../types";
import { HelpTip, SectionCard } from "../ui/primitives";

export function PermissionsView({ records }: { records: PermissionRecord[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard>
        <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
          <span>Role Model</span>
          <HelpTip
            title="Permissions · Role Model"
            sections={[
              {
                label: "What It Is",
                text: "The operational access model separating operator actions from governance-sensitive WGS actions.",
              },
              {
                label: "What It Does",
                text: "Controls who can certify, seal, enter support mode, manage users, or only observe.",
              },
              {
                label: "Why It Matters",
                text: "Role boundaries are part of the integrity model behind legal-grade recovery output.",
              },
            ]}
            footerLabel="Governance"
            footerValue="Role-gated workflow authority"
          />
        </div>
        <div className="mt-2 space-y-3 text-sm leading-6 text-[var(--muted)]">
          <p>Admin has full read/write access including CAAR delivery and user management.</p>
          <p>Manager can operate the workflow but cannot seal contract config or release final legal-grade output.</p>
          <p>Viewer is read-only across dashboard, waterfall, CAAR, and activity log.</p>
          <p>WGS Manager can enter support mode and perform schema governance actions.</p>
        </div>
      </SectionCard>

      <div className="space-y-4">
        {records.length > 0 ? (
          records.map((record) => (
            <SectionCard key={record.email} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{record.name}</div>
                  <div className="text-sm text-[var(--muted)]">{record.email}</div>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] ${roleClass[record.role]}`}
                >
                  {record.role}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-2">
                <div>
                  <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em]">
                    Scope
                  </div>
                  <div className="mt-1">{record.scope}</div>
                </div>
                <div>
                  <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em]">
                    Last Seen
                  </div>
                  <div className="mt-1">{record.lastSeen}</div>
                </div>
              </div>
            </SectionCard>
          ))
        ) : (
          <SectionCard className="p-5 text-sm text-[var(--muted)]">
            No team access records are provisioned for this account yet.
          </SectionCard>
        )}
      </div>
    </div>
  );
}
