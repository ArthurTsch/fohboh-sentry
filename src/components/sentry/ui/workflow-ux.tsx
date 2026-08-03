import type { ReactNode } from "react";

export type WorkflowStageStatus = "blocked" | "complete" | "current" | "pending";

export function WorkflowContextBar({
  locationId,
  locationName,
  moduleId,
  period,
  providerName,
  trailing,
}: {
  locationId?: string | null;
  locationName: string;
  moduleId?: "M01" | "M02" | null;
  period?: string | null;
  providerName?: string | null;
  trailing?: ReactNode;
}) {
  const context = [moduleId, providerName, period].filter(Boolean);
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
      aria-label="Current workflow context"
    >
      <div className="min-w-0 flex-1">
        <div className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          Current workflow
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-[var(--text)]">{locationName}</span>
          {locationId ? <span className="text-[var(--muted)]">{locationId}</span> : null}
          {context.map((item) => (
            <span key={item} className="inline-flex items-center gap-2 text-[var(--muted)]">
              <span aria-hidden="true">/</span>
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-medium text-[var(--text)]">{item}</span>
            </span>
          ))}
        </div>
      </div>
      {trailing}
    </div>
  );
}

export function WorkflowProgress({
  stages,
}: {
  stages: Array<{ detail?: string; label: string; status: WorkflowStageStatus }>;
}) {
  return (
    <ol className="grid gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Certification workflow progress">
      {stages.map((stage, index) => (
        <li
          key={stage.label}
          className={`rounded-2xl border p-3 ${
            stage.status === "complete"
              ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.06)]"
              : stage.status === "blocked"
                ? "border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)]"
                : stage.status === "current"
                  ? "border-[rgba(0,97,255,0.2)] bg-[rgba(0,97,255,0.06)]"
                  : "border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                stage.status === "complete"
                  ? "bg-[var(--success)] text-white"
                  : stage.status === "blocked"
                    ? "bg-[var(--accent)] text-white"
                    : stage.status === "current"
                      ? "bg-[var(--info)] text-white"
                      : "bg-white text-[var(--muted)]"
              }`}
              aria-hidden="true"
            >
              {stage.status === "complete" ? "✓" : stage.status === "blocked" ? "!" : index + 1}
            </span>
            <span className="text-xs font-semibold text-[var(--text)]">{stage.label}</span>
          </div>
          {stage.detail ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{stage.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function ReadinessChecklist({
  items,
}: {
  items: Array<{ detail: string; label: string; ready: boolean }>;
}) {
  return (
    <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-white">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3 px-4 py-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              item.ready ? "bg-[rgba(0,200,83,0.1)] text-[var(--success)]" : "bg-[rgba(214,48,49,0.1)] text-[var(--accent)]"
            }`}
            aria-label={item.ready ? "Ready" : "Action required"}
          >
            {item.ready ? "✓" : "!"}
          </span>
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">{item.label}</div>
            <div className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionNotice({
  action,
  children,
  title,
  tone = "danger",
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
  tone?: "danger" | "info" | "success";
}) {
  const toneClass =
    tone === "success"
      ? "border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.06)]"
      : tone === "info"
        ? "border-[rgba(0,97,255,0.2)] bg-[rgba(0,97,255,0.06)]"
        : "border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)]";
  return (
    <div className={`flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-3 ${toneClass}`} role={tone === "danger" ? "alert" : "status"}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{children}</div>
      </div>
      {action}
    </div>
  );
}
