import Link from "next/link";
import type { Metadata } from "next";
import { getManagerSession } from "@/lib/auth/session";
import { loginAdminAction, logoutAdminAction } from "./actions";

export const adminMetadata: Metadata = {
  title: "Admin | FohBoh Sentry",
  robots: {
    index: false,
    follow: false,
  },
};

export const adminInputClassName =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--text)]";

type SearchParamValue = string | string[] | undefined;
export type AdminSearchParams = Record<string, SearchParamValue>;

export async function isAdminAuthorized() {
  const session = await getManagerSession();
  return session?.role === "Admin";
}

export function getSearchParam(searchParams: AdminSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function formatAdminDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function AdminLoginScreen({ error }: { error?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] p-6">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
        >
          <span aria-hidden="true">&lt;</span>
          <span>Back</span>
        </Link>
        <div className="mt-5 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          Restricted
        </div>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.05em]">
          Sentry Admin
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          This page is intentionally hidden. Sign in with a real manager account that has the
          `Admin` role to manage manager and restaurant records.
        </p>

        {error === "invalid-credentials" ? (
          <div className="mt-5 rounded-2xl border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            Invalid admin credentials.
          </div>
        ) : null}
        {error === "not-admin" ? (
          <div className="mt-5 rounded-2xl border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            This account is not allowed to access Sentry Admin.
          </div>
        ) : null}

        <form action={loginAdminAction} className="mt-6 space-y-4">
          <AdminField label="Admin Email">
            <input
              type="email"
              name="email"
              className={adminInputClassName}
              placeholder="admin@company.com"
            />
          </AdminField>
          <AdminField label="Admin Password">
            <input
              type="password"
              name="password"
              className={adminInputClassName}
              placeholder="Enter your password"
            />
          </AdminField>
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Open Admin
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  description,
  eyebrow = "Hidden Route",
  title,
}: {
  children: React.ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--surface)] p-6 lg:p-8">
      <div className="mx-auto max-w-full space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              {eyebrow}
            </div>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.05em]">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Overview
            </Link>
            <Link
              href="/admin/managers"
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Managers
            </Link>
            <Link
              href="/admin/restaurants"
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Restaurants
            </Link>
            <Link
              href="/admin/management"
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Management
            </Link>
            <form action={logoutAdminAction}>
              <button
                type="submit"
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AdminField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
