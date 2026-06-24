import { roleClass } from "../config";
import type { SessionState } from "../types";
import { getInitials } from "../utils";

export function ProfileView({
  session,
  visibleLocationCount,
}: {
  session: SessionState;
  visibleLocationCount: number;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--text)] text-xl font-bold text-white">
            {getInitials(session.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] text-[var(--text)]">
              {session.name?.trim() || session.email}
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">{session.email}</div>
            <div className="mt-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] ${roleClass[session.role]}`}
              >
                {session.role}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ProfileStatCard label="Role" value={session.role} />
        <ProfileStatCard label="Account Scope" value={session.accountId ?? "Global / WGS"} />
        <ProfileStatCard label="Visible Locations" value={String(visibleLocationCount)} />
      </section>
    </div>
  );
}

function ProfileStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[0_14px_40px_rgba(0,0,0,0.05)]">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
    </div>
  );
}
