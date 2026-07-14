import Link from "next/link";
import type { Metadata } from "next";
import { getManagerSession } from "@/lib/auth/session";
import { PasswordField } from "@/components/sentry/ui/PasswordField";
import { loginAdminAction, logoutAdminAction } from "./actions";

export const adminMetadata: Metadata = {
  title: "SuperAdmin | FohBoh Sentry",
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
  return session?.role === "SuperAdmin";
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
          SuperAdmin
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          This page is intentionally hidden. Sign in with a real manager account that has the
          `SuperAdmin` role to manage developer-level platform records.
        </p>

        {error === "invalid-credentials" ? (
          <div className="mt-5 rounded-2xl border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            Invalid admin credentials.
          </div>
        ) : null}
        {error === "not-admin" ? (
          <div className="mt-5 rounded-2xl border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            This account is not allowed to access SuperAdmin.
          </div>
        ) : null}
        {error === "session-config" ? (
          <div className="mt-5 rounded-2xl border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            SuperAdmin login is not configured in production. Set `SENTRY_SESSION_SECRET` in
            Vercel project environment variables.
          </div>
        ) : null}
        {error === "server-error" ? (
          <div className="mt-5 rounded-2xl border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
            SuperAdmin login failed on the server. In production this usually means the database
            is unreachable, the `managers` table is missing, or the account record is invalid.
          </div>
        ) : null}

        <form action={loginAdminAction} className="mt-6 space-y-4">
          <AdminField label="SuperAdmin Email">
            <input
              type="email"
              name="email"
              className={adminInputClassName}
              placeholder="admin@company.com"
            />
          </AdminField>
          <AdminField label="SuperAdmin Password">
            <PasswordField
              name="password"
              className={adminInputClassName}
              placeholder="Enter your password"
            />
          </AdminField>
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
          >
            Open SuperAdmin
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  currentPath = "/superadmin",
  description,
  eyebrow = "Hidden Route",
  title,
}: {
  children: React.ReactNode;
  currentPath?: string;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  const primaryNav = [
    { href: "/superadmin", label: "Overview" },
    { href: "/superadmin/engine", label: "Engine Doc" },
    { href: "/superadmin/managers", label: "Managers" },
    { href: "/superadmin/restaurants", label: "Restaurants" },
    { href: "/superadmin/management", label: "Management" },
    { href: "/superadmin/tables", label: "DB Tables Inspector" },
  ];

  return (
    <div className="min-h-screen bg-[var(--surface)] p-0">
      <div className="grid min-h-screen gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-0 xl:h-screen">
          <div className="flex h-full flex-col overflow-hidden border-r border-[var(--border)] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[var(--border)] px-6 py-6">
              <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                Hidden Console
              </div>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.05em] text-[var(--text)]">
                SuperAdmin
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Production control plane for app data, access, certification records, and database tables.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                {primaryNav.map((item) => {
                  const active = currentPath === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        active
                          ? "bg-[var(--text)] text-white shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

            </div>

            <div className="border-t border-[var(--border)] px-4 py-4">
              <form action={logoutAdminAction}>
                <button
                  type="submit"
                  className="w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="space-y-6 p-4 lg:p-6">
          <div className="border-b border-[var(--border)] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] lg:p-8">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              {eyebrow}
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.05em] text-[var(--text)]">
              {title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{description}</p>
          </div>

          <div>{children}</div>
        </div>
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
