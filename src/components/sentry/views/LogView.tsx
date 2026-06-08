import type { LogRecord } from "../types";
import { Badge, HelpTip, SectionCard } from "../ui/primitives";

export function LogView({
  entries,
  filter,
  onFilterChange,
}: {
  entries: LogRecord[];
  filter: "all" | "immutable" | "editable";
  onFilterChange: (filter: "all" | "immutable" | "editable") => void;
}) {
  const filters: { id: "all" | "immutable" | "editable"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "immutable", label: "SHA-256 Protected" },
    { id: "editable", label: "Editable" },
  ];

  return (
    <SectionCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-5 py-4">
        <HelpTip
          title="Activity Log · Chain of Custody"
          sections={[
            {
              label: "What It Is",
              text: "A ledger of operator, certification, upload, schema, and admin actions across the active account scope.",
            },
            {
              label: "What It Does",
              text: "Separates SHA-256 protected entries from editable drafts for provenance review.",
            },
            {
              label: "Why It Matters",
              text: "In any later dispute, the activity log is part of the operational proof that the workflow was controlled.",
            },
          ]}
          footerLabel="Immutability"
          footerValue="Protected vs draft-state events"
        />
        {filters.map((item) => {
          const active = item.id === filter;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={`rounded-full px-3 py-2 text-sm ${
                active ? "bg-[var(--text)] text-white" : "bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="hidden grid-cols-[130px_160px_1fr_140px_140px_120px] gap-3 bg-[var(--panel-soft)] px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
        <span>Timestamp</span>
        <span>Location</span>
        <span>Action</span>
        <span>Hash</span>
        <span>User</span>
        <span>Status</span>
      </div>
      {entries.map((entry) => (
        <div
          key={entry.hash}
          className="grid gap-3 border-t border-[var(--border)] px-5 py-4 text-sm first:border-t-0 lg:grid-cols-[130px_160px_1fr_140px_140px_120px]"
        >
          <div>{entry.ts}</div>
          <div>{entry.location}</div>
          <div>{entry.action}</div>
          <div className="font-[family-name:var(--font-mono)] text-[var(--info)]">{entry.hash}</div>
          <div>{entry.user}</div>
          <div>
            <Badge tone={entry.immutable ? "success" : "neutral"}>
              {entry.immutable ? "Immutable" : "Editable"}
            </Badge>
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
