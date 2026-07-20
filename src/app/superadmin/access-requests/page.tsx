import Link from "next/link";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import {
  createManagerFromAccessRequestAction,
  updateAccessRequestReviewAction,
} from "@/app/admin/actions";
import {
  adminInputClassName,
  adminMetadata,
  AdminField,
  AdminLoginScreen,
  AdminShell,
  formatAdminDate,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export default async function SuperAdminAccessRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const [requests, managers] = await Promise.all([
    prisma.access_requests_v2.findMany({
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        company: true,
        created_at: true,
        dsps: true,
        external_id: true,
        locations: true,
        module_plan: true,
        modules: true,
        monthly_volume: true,
        notes: true,
        phone: true,
        processors: true,
        requester_email: true,
        requester_name: true,
        reviewed_at: true,
        reviewed_by: true,
        status: true,
        updated_at: true,
      },
    }),
    prisma.managers.findMany({
      select: {
        email: true,
        full_name: true,
        id: true,
      },
    }),
  ]);

  const managerById = new Map(
    managers.map((manager) => [manager.id, manager.full_name || manager.email]),
  );

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedRequests = requests.filter((request) => request.status === "reviewed");
  const rejectedRequests = requests.filter((request) => request.status === "rejected");
  const reviewState = getSearchParam(resolvedSearchParams, "review");
  const createState = getSearchParam(resolvedSearchParams, "create");
  const approveRequestId = getSearchParam(resolvedSearchParams, "approve");
  const selectedRequest =
    approveRequestId && pendingRequests.length
      ? pendingRequests.find((request) => request.external_id === approveRequestId) ?? null
      : null;

  return (
    <AdminShell
      currentPath="/superadmin/access-requests"
      title="Access Requests"
      description="Review incoming Request Access submissions, approve or reject them as SuperAdmin, and keep account creation behind an explicit approval gate."
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending" value={String(pendingRequests.length)} />
          <StatCard label="Approved" value={String(approvedRequests.length)} />
          <StatCard label="Rejected" value={String(rejectedRequests.length)} />
          <StatCard label="Total Requests" value={String(requests.length)} />
        </div>

        {reviewState === "reviewed" ? (
          <AdminNotice tone="success">
            Access request approved. This now unlocks downstream account and location setup.
          </AdminNotice>
        ) : null}
        {reviewState === "rejected" ? (
          <AdminNotice tone="success">Access request rejected and recorded.</AdminNotice>
        ) : null}
        {reviewState === "invalid" || reviewState === "server-error" ? (
          <AdminNotice tone="error">Unable to update that access request right now.</AdminNotice>
        ) : null}
        {createState === "success" ? (
          <AdminNotice tone="success">
            Manager account created and the access request is now approved.
          </AdminNotice>
        ) : null}
        {createState === "invalid-request" ? (
          <AdminNotice tone="error">
            That access request is no longer pending, so the account could not be created from it.
          </AdminNotice>
        ) : null}

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Approval Queue
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                Pending Request Access submissions
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                A request stays in `pending` until a SuperAdmin either rejects it or opens the
                account-creation modal and completes the first real manager record for that
                request.
              </p>
            </div>
            <Link
              href="/superadmin/managers"
              className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Open Managers
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {pendingRequests.map((request) => {
              const modules = normalizeStringArray(request.modules);
              const processors = normalizeStringArray(request.processors);
              const dsps = normalizeStringArray(request.dsps);

              return (
                <article
                  key={request.external_id}
                  className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em] text-[var(--text)]">
                          {request.company}
                        </h3>
                        <StatusBadge status={request.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
                        <span>{request.external_id}</span>
                        <span>·</span>
                        <span>{request.requester_name || request.requester_email}</span>
                        <span>·</span>
                        <span>{request.requester_email}</span>
                        {request.phone ? (
                          <>
                            <span>·</span>
                            <span>{request.phone}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/superadmin/access-requests?approve=${encodeURIComponent(request.external_id)}`}
                        className="rounded-xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                      >
                        Accept & Create Account
                      </Link>
                      <form action={updateAccessRequestReviewAction}>
                        <input type="hidden" name="request_id" value={request.external_id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button
                          type="submit"
                          className="rounded-xl border border-[rgba(214,48,49,0.18)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] transition hover:border-[var(--accent)]"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                        Requested Scope
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <MetaBlock label="Module Plan" value={formatModulePlan(request.module_plan, modules)} />
                        <MetaBlock label="Locations" value={request.locations || "-"} />
                        <MetaBlock label="Monthly Volume" value={request.monthly_volume || "-"} />
                        <MetaBlock label="Processors" value={processors.join(", ") || "-"} />
                        <MetaBlock label="DSPs" value={dsps.join(", ") || "-"} />
                        <MetaBlock label="Submitted" value={formatAdminDate(request.created_at)} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                        SuperAdmin Notes
                      </div>
                      <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
                        {request.notes?.trim() || "No notes were provided with this request."}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
                No pending access requests are waiting for approval.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Review History
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                Approved and rejected requests
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">
              {approvedRequests.length + rejectedRequests.length} reviewed
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="grid grid-cols-[160px_1.2fr_1fr_130px_170px_170px] gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>Request ID</span>
              <span>Company</span>
              <span>Requester</span>
              <span>Status</span>
              <span>Reviewed At</span>
              <span>Reviewed By</span>
            </div>

            {requests
              .filter((request) => request.status !== "pending")
              .map((request) => (
                <div
                  key={request.external_id}
                  className="grid grid-cols-[160px_1.2fr_1fr_130px_170px_170px] gap-3 border-t border-[var(--border)] px-4 py-3 text-sm"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[var(--muted)]">
                    {request.external_id}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--text)]">{request.company}</div>
                    <div className="truncate text-xs text-[var(--muted)]">
                      {formatModulePlan(request.module_plan, normalizeStringArray(request.modules))}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[var(--text)]">
                      {request.requester_name || request.requester_email}
                    </div>
                    <div className="truncate text-xs text-[var(--muted)]">{request.requester_email}</div>
                  </div>
                  <div>
                    <StatusBadge status={request.status} />
                  </div>
                  <span className="text-[var(--muted)]">{formatAdminDate(request.reviewed_at)}</span>
                  <span className="text-[var(--muted)]">
                    {request.reviewed_by ? managerById.get(request.reviewed_by) || `#${request.reviewed_by}` : "-"}
                  </span>
                </div>
              ))}

            {approvedRequests.length + rejectedRequests.length === 0 ? (
              <div className="border-t border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
                No reviewed access requests are stored yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {selectedRequest ? (
        <CreateAccountModal
          createState={createState}
          request={selectedRequest}
        />
      ) : null}
    </AdminShell>
  );
}

function formatModulePlan(modulePlan: string, modules: string[]) {
  if (modules.length > 0) {
    return modules.join(" + ");
  }

  if (modulePlan === "bundle") return "M01 + M02 Bundle";
  if (modulePlan === "m01") return "M01 Only";
  if (modulePlan === "m02") return "M02 Only";
  return modulePlan || "-";
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm text-[var(--text)]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "reviewed"
      ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
      : normalized === "rejected"
        ? "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
        : "bg-[rgba(184,106,0,0.08)] text-[#b86a00]";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone}`}>
      {normalized === "reviewed" ? "Approved" : normalized === "rejected" ? "Rejected" : "Pending"}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[0_16px_50px_rgba(0,0,0,0.05)]">
      <div className="text-4xl font-bold tracking-[-0.05em] text-[var(--text)]">{value}</div>
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

function CreateAccountModal({
  createState,
  request,
}: {
  createState: string | undefined;
  request: {
    company: string;
    external_id: string;
    locations: string | null;
    phone: string | null;
    requester_email: string;
    requester_name: string | null;
  };
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.22)]">
        <div className="border-b border-[var(--border)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Access Request Approval
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] text-[var(--text)]">
                Create manager account
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                Accepting this request now requires the first real manager account details. The
                request will only be marked approved after this account is created successfully.
              </p>
            </div>
            <Link
              href="/superadmin/access-requests"
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Close
            </Link>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                Request Summary
              </div>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <MetaRow label="Request ID" value={request.external_id} />
                <MetaRow label="Company" value={request.company} />
                <MetaRow label="Requester" value={request.requester_name || request.requester_email} />
                <MetaRow label="Email" value={request.requester_email} />
                <MetaRow label="Phone" value={request.phone || "-"} />
                <MetaRow label="Locations" value={request.locations || "-"} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            {createState === "missing-fields" ? (
              <AdminNotice tone="error">Email, password, and role are required to create the account.</AdminNotice>
            ) : null}
            {createState === "duplicate-email" ? (
              <AdminNotice tone="error">A manager with that email already exists.</AdminNotice>
            ) : null}
            {createState === "server-error" ? (
              <AdminNotice tone="error">Unable to create the manager account from this request.</AdminNotice>
            ) : null}

            <form action={createManagerFromAccessRequestAction} className="space-y-4">
              <input type="hidden" name="request_id" value={request.external_id} />

              <AdminField label="Full Name">
                <input
                  name="full_name"
                  className={adminInputClassName}
                  placeholder="Manager full name"
                  defaultValue={request.requester_name ?? ""}
                />
              </AdminField>

              <AdminField label="Email">
                <input
                  type="email"
                  name="email"
                  className={adminInputClassName}
                  placeholder="manager@restaurant.com"
                  defaultValue={request.requester_email}
                  required
                />
              </AdminField>

              <AdminField label="Password">
                <input
                  type="password"
                  name="password"
                  className={adminInputClassName}
                  placeholder="Create initial password"
                  required
                />
              </AdminField>

              <AdminField label="Role">
                <select
                  name="role"
                  className={adminInputClassName}
                  defaultValue="Manager"
                >
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                  <option value="Restaurant Owner">Restaurant Owner</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </AdminField>

              <AdminField label="Phone">
                <input
                  name="phone_number"
                  className={adminInputClassName}
                  placeholder="+1 (214) 555-0100"
                  defaultValue={request.phone ?? ""}
                />
              </AdminField>

              <AdminField label="Address">
                <textarea
                  name="address"
                  className={`${adminInputClassName} min-h-24 resize-y`}
                  placeholder="Business address"
                />
              </AdminField>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                  <input type="checkbox" name="active" defaultChecked />
                  <span>Active</span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                  <input type="checkbox" name="email_verified" />
                  <span>Email Verified</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Link
                  href="/superadmin/access-requests"
                  className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--text)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Create Account & Approve Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
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
