import Link from "next/link";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import {
  createManagerAction,
  deleteManagerAction,
  updateManagerAction,
} from "../actions";
import {
  adminInputClassName,
  adminMetadata,
  AdminField,
  AdminLoginScreen,
  AdminShell,
  formatAdminDate,
  getSearchParam,
  isAdminAuthorized,
} from "../admin-ui";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminManagersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const managers = await prisma.managers.findMany({
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: {
      address: true,
      active: true,
      created_at: true,
      email: true,
      email_verified: true,
      full_name: true,
      id: true,
      phone_number: true,
      role: true,
    },
  });

  const createState = getSearchParam(resolvedSearchParams, "create");
  const deleteState = getSearchParam(resolvedSearchParams, "delete");
  const updateState = getSearchParam(resolvedSearchParams, "update");
  const editId = Number(getSearchParam(resolvedSearchParams, "edit"));
  const editingManager = Number.isFinite(editId)
    ? managers.find((manager) => manager.id === editId) ?? null
    : null;
  const isEditing = Boolean(editingManager);

  return (
    <AdminShell
      title="Managers"
      description="Create and remove manager accounts without mixing restaurant records into the same screen."
    >
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            {isEditing ? "Edit Manager" : "Create Manager"}
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            {isEditing ? "Update database user" : "Add database user"}
          </h2>

          {createState === "success" ? (
            <AdminNotice tone="success">Manager created successfully.</AdminNotice>
          ) : null}
          {createState === "missing-fields" ? (
            <AdminNotice tone="error">Email, password, and role are required.</AdminNotice>
          ) : null}
          {createState === "duplicate-email" ? (
            <AdminNotice tone="error">A manager with that email already exists.</AdminNotice>
          ) : null}
          {createState === "server-error" ? (
            <AdminNotice tone="error">Unable to create the manager right now.</AdminNotice>
          ) : null}
          {updateState === "success" ? (
            <AdminNotice tone="success">Manager updated successfully.</AdminNotice>
          ) : null}
          {updateState === "missing-fields" ? (
            <AdminNotice tone="error">Manager id, email, and role are required.</AdminNotice>
          ) : null}
          {updateState === "duplicate-email" ? (
            <AdminNotice tone="error">A manager with that email already exists.</AdminNotice>
          ) : null}
          {updateState === "server-error" ? (
            <AdminNotice tone="error">Unable to update the manager right now.</AdminNotice>
          ) : null}
          {deleteState === "success" ? (
            <AdminNotice tone="success">Manager deleted successfully.</AdminNotice>
          ) : null}
          {deleteState === "invalid-id" || deleteState === "server-error" ? (
            <AdminNotice tone="error">Unable to delete that manager.</AdminNotice>
          ) : null}

          <form action={isEditing ? updateManagerAction : createManagerAction} className="mt-6 space-y-4">
            {isEditing ? <input type="hidden" name="id" value={editingManager?.id} /> : null}
            <AdminField label="Full Name">
              <input
                name="full_name"
                className={adminInputClassName}
                placeholder="Romeo Adora"
                defaultValue={editingManager?.full_name ?? ""}
              />
            </AdminField>

            <AdminField label="Email">
              <input
                type="email"
                name="email"
                className={adminInputClassName}
                placeholder="manager@restaurant.com"
                defaultValue={editingManager?.email ?? ""}
                required
              />
            </AdminField>

            <AdminField label="Password">
              <input
                type="password"
                name="password"
                className={adminInputClassName}
                placeholder={isEditing ? "Leave blank to keep current password" : "Create password"}
                required={!isEditing}
              />
            </AdminField>

            <AdminField label="Role">
              <select
                name="role"
                className={adminInputClassName}
                defaultValue={editingManager?.role ?? "Manager"}
              >
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
                <option value="Viewer">Viewer</option>
                <option value="WGS Manager">WGS Manager</option>
                <option value="Restaurant Owner">Restaurant Owner</option>
              </select>
            </AdminField>

            <AdminField label="Phone">
              <input
                name="phone_number"
                className={adminInputClassName}
                placeholder="+1 (214) 555-0100"
                defaultValue={editingManager?.phone_number ?? ""}
              />
            </AdminField>

            <AdminField label="Address">
              <textarea
                name="address"
                className={`${adminInputClassName} min-h-24 resize-y`}
                placeholder="Business address"
                defaultValue={editingManager?.address ?? ""}
              />
            </AdminField>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <input type="checkbox" name="active" defaultChecked={editingManager?.active ?? true} />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="email_verified"
                  defaultChecked={editingManager?.email_verified ?? false}
                />
                <span>Email Verified</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                {isEditing ? "Save Manager" : "Create Manager"}
              </button>
              {isEditing ? (
                <Link
                  href="/admin/managers"
                  className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Managers Table
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                Existing accounts
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">
              {managers.length} total
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="grid grid-cols-[72px_1.1fr_1fr_132px_110px_160px_140px] gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>ID</span>
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Created</span>
              <span>Actions</span>
            </div>

            {managers.map((manager) => (
              <div
                key={manager.id}
                className="grid grid-cols-[72px_1.1fr_1fr_132px_110px_160px_140px] gap-3 border-t border-[var(--border)] px-4 py-3 text-sm"
              >
                <span className="font-[family-name:var(--font-mono)] text-[var(--muted)]">
                  {manager.id}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--text)]">
                    {manager.full_name || "-"}
                  </div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {manager.phone_number || "No phone"}
                  </div>
                </div>
                <span className="truncate text-[var(--text)]">{manager.email}</span>
                <span className="truncate text-[var(--muted)]">{manager.role}</span>
                <div className="flex flex-col gap-1">
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      manager.active
                        ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                        : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                    }`}
                  >
                    {manager.active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {manager.email_verified ? "Verified" : "Unverified"}
                  </span>
                </div>
                <span className="text-[var(--muted)]">{formatAdminDate(manager.created_at)}</span>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/admin/managers?edit=${manager.id}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                  >
                    Edit
                  </Link>
                  <form action={deleteManagerAction}>
                    <input type="hidden" name="id" value={manager.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-[rgba(214,48,49,0.18)] px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
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
      className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
        tone === "success"
          ? "border border-[rgba(0,200,83,0.18)] bg-[rgba(0,200,83,0.06)] text-[var(--success)]"
          : "border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] text-[var(--accent)]"
      }`}
    >
      {children}
    </div>
  );
}
