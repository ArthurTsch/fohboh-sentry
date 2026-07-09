import Link from "next/link";
import type { Metadata } from "next";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[ ] | undefined>>;

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  return (
    <AdminShell
      currentPath="/superadmin"
      title="SuperAdmin Console"
      description="Manage platform-level records, operational datasets, and direct database tables from one hidden console."
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Managers
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            Accounts and access
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Create and remove manager accounts, including privileged `SuperAdmin` users.
          </p>
          <Link
            href="/superadmin/managers"
            className="mt-6 inline-flex rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Open Managers
          </Link>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Restaurants
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            Restaurant records
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Review, create, edit, and delete restaurant rows from the production database.
          </p>
          <Link
            href="/superadmin/restaurants"
            className="mt-6 inline-flex rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Open Restaurants
          </Link>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Management
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            Saved CAAR reports
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Review persisted CAAR records, ownership, and saved evidence outputs.
          </p>
          <Link
            href="/superadmin/management"
            className="mt-6 inline-flex rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Open Management
          </Link>
        </section>

        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Tables
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            Raw table manager
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Inspect every application table, verify row counts, and manage records directly.
          </p>
          <Link
            href="/superadmin/tables"
            className="mt-6 inline-flex rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Open Tables
          </Link>
        </section>
      </div>
    </AdminShell>
  );
}
