import Link from "next/link";
import type { Metadata } from "next";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  getSearchParam,
  isAdminAuthorized,
} from "./admin-ui";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPage({
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
      title="Sentry Admin"
      description="Manage hidden admin resources from dedicated sections. Managers and restaurants now have separate views so the database surfaces stay readable."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Managers
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
            Accounts and access
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Create and remove manager accounts in the AWS-backed `managers` table.
          </p>
          <Link
            href="/admin/managers"
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
            Review, create, and delete restaurant rows from a dedicated database view.
          </p>
          <Link
            href="/admin/restaurants"
            className="mt-6 inline-flex rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Open Restaurants
          </Link>
        </section>
      </div>
    </AdminShell>
  );
}
