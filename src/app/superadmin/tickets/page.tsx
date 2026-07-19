import Link from "next/link";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { updateSupportTicketStatusAction } from "@/app/admin/actions";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  formatAdminDate,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";
import { parseSupportTicketIssue } from "@/lib/support/tickets";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SuperAdminTicketsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const [tickets, managers] = await Promise.all([
    prisma.support_tickets_v2.findMany({
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        account_id: true,
        created_at: true,
        created_by: true,
        external_id: true,
        issue: true,
        location_id: true,
        priority: true,
        requester_email: true,
        requester_name: true,
        requester_role: true,
        resolved_at: true,
        resolved_by: true,
        status: true,
        updated_at: true,
      },
    }),
    prisma.managers.findMany({
      orderBy: [{ full_name: "asc" }, { email: "asc" }],
      select: {
        email: true,
        full_name: true,
        id: true,
      },
    }),
  ]);

  const ticketState = getSearchParam(resolvedSearchParams, "ticket");
  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const inReviewCount = tickets.filter((ticket) => ticket.status === "in_review").length;
  const waitingCount = tickets.filter((ticket) => ticket.status === "waiting_on_customer").length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "resolved").length;

  return (
    <AdminShell
      currentPath="/superadmin/tickets"
      title="Support Tickets"
      description="Review persisted support requests, inspect ticket evidence, and update operational handling status from the SuperAdmin console."
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open" value={String(openCount)} />
          <StatCard label="In Review" value={String(inReviewCount)} />
          <StatCard label="Waiting On Customer" value={String(waitingCount)} />
          <StatCard label="Resolved" value={String(resolvedCount)} />
        </div>

        {ticketState === "updated" ? (
          <AdminNotice tone="success">Support ticket status updated successfully.</AdminNotice>
        ) : null}
        {ticketState === "invalid" || ticketState === "server-error" ? (
          <AdminNotice tone="error">Unable to update that support ticket right now.</AdminNotice>
        ) : null}

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Ticket Queue
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                Persisted support requests
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">
              {tickets.length} total
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {tickets.map((ticket) => {
              const parsed = parseSupportTicketIssue(ticket.issue);
              const creator =
                managers.find((manager) => manager.id === ticket.created_by)?.full_name ||
                managers.find((manager) => manager.id === ticket.created_by)?.email ||
                (ticket.requester_name || ticket.requester_email);
              const resolver =
                managers.find((manager) => manager.id === ticket.resolved_by)?.full_name ||
                managers.find((manager) => manager.id === ticket.resolved_by)?.email ||
                (ticket.resolved_by ? `#${ticket.resolved_by}` : null);

              return (
                <article
                  key={ticket.external_id}
                  className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em] text-[var(--text)]">
                          {parsed.subject}
                        </h3>
                        <StatusBadge status={normalizeTicketStatus(ticket.status)} />
                        <PriorityBadge priority={normalizePriority(ticket.priority)} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
                        <span>{ticket.external_id}</span>
                        <span>•</span>
                        <span>{parsed.category}</span>
                        <span>•</span>
                        <span>{parsed.urgency}</span>
                        {ticket.account_id ? (
                          <>
                            <span>•</span>
                            <span>{ticket.account_id}</span>
                          </>
                        ) : null}
                        {ticket.location_id ? (
                          <>
                            <span>•</span>
                            <span>{parsed.locationName || ticket.location_id}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <form action={updateSupportTicketStatusAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="ticketId" value={ticket.external_id} />
                      <select
                        name="status"
                        defaultValue={ticket.status}
                        className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none"
                      >
                        <option value="open">Open</option>
                        <option value="in_review">In Review</option>
                        <option value="waiting_on_customer">Waiting on Customer</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                      >
                        Save Status
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                        Description
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">
                        {parsed.description}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                          Request Context
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                          <MetaRow label="Requester" value={creator} />
                          <MetaRow label="Email" value={ticket.requester_email} />
                          <MetaRow label="Role" value={ticket.requester_role || "-"} />
                          <MetaRow label="Created" value={formatAdminDate(ticket.created_at)} />
                          <MetaRow label="Updated" value={formatAdminDate(ticket.updated_at)} />
                          <MetaRow label="Resolved By" value={resolver || "-"} />
                          <MetaRow label="Resolved At" value={formatAdminDate(ticket.resolved_at)} />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                          Attachments
                        </div>
                        {parsed.attachments.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {parsed.attachments.map((attachment) => (
                              <Link
                                key={attachment.id}
                                href={`/api/v1/support/tickets/${encodeURIComponent(ticket.external_id)}/attachments/${encodeURIComponent(attachment.id)}`}
                                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              >
                                {attachment.name} · {formatBytes(attachment.sizeBytes)}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-[var(--muted)]">
                            No attachments were added to this ticket.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {tickets.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
                No support tickets are stored yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span>{label}</span>
      <span className="text-right text-[var(--text)]">{value}</span>
    </div>
  );
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 102.4) / 10} KB`;
  }
  return `${value} B`;
}

function StatusBadge({
  status,
}: {
  status: "open" | "in_review" | "waiting_on_customer" | "resolved";
}) {
  const tone =
    status === "resolved"
      ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
      : status === "waiting_on_customer"
        ? "bg-[#FFF3D6] text-[#B45309]"
        : status === "in_review"
          ? "bg-[rgba(29,78,216,0.08)] text-[var(--info)]"
          : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const tone =
    priority === "High"
      ? "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
      : priority === "Medium"
        ? "bg-[#FFF3D6] text-[#B45309]"
        : "bg-[rgba(15,23,42,0.06)] text-[var(--muted)]";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}>
      {priority}
    </span>
  );
}

function normalizeTicketStatus(value: string): "open" | "in_review" | "waiting_on_customer" | "resolved" {
  return value === "open" || value === "in_review" || value === "waiting_on_customer" || value === "resolved"
    ? value
    : "open";
}

function normalizePriority(value: string): "High" | "Medium" | "Low" {
  return value === "High" || value === "Medium" || value === "Low" ? value : "Medium";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
      <div className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.06em] text-[var(--text)]">
        {value}
      </div>
      <div className="mt-2 text-sm text-[var(--muted)]">{label}</div>
    </div>
  );
}

function AdminNotice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm ${
        tone === "success"
          ? "border border-[rgba(0,200,83,0.18)] bg-[rgba(0,200,83,0.06)] text-[var(--success)]"
          : "border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] text-[var(--accent)]"
      }`}
    >
      {children}
    </div>
  );
}
