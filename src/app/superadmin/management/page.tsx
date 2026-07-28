import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { deleteCaarReportAction } from "@/app/admin/actions";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  formatAdminDate,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SuperAdminManagementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const [reports, managers] = await Promise.all([
    prisma.caar_reports.findMany({
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        account_id: true,
        amount_display: true,
        caar_id: true,
        created_at: true,
        created_by: true,
        exhibits: true,
        id: true,
        location_name: true,
        period: true,
        status: true,
        trust_score: true,
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

  const caarState = getSearchParam(resolvedSearchParams, "caar");
  const certifiedCount = reports.filter((report) => report.status === "Certified").length;

  return (
    <AdminShell
      currentPath="/superadmin/management"
      title="Management"
      description="Operational management view for CAAR records saved to the AWS PostgreSQL database."
    >
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Saved CAARs" value={String(reports.length)} />
        <StatCard label="Certified CAARs" value={String(certifiedCount)} />
        <StatCard
          label="Managers with CAARs"
          value={String(new Set(reports.map((report) => report.created_by).filter(Boolean)).size)}
        />
      </div>

      {caarState === "deleted" ? (
        <AdminNotice tone="success">CAAR report deleted successfully.</AdminNotice>
      ) : null}
      {caarState === "invalid-id" || caarState === "server-error" ? (
        <AdminNotice tone="error">Unable to delete that CAAR report.</AdminNotice>
      ) : null}

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              CAAR Reports
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              Persisted report records
            </h2>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
          <div className="grid grid-cols-[84px_190px_1fr_130px_100px_110px_160px_140px] gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>ID</span>
            <span>CAAR ID</span>
            <span>Location</span>
            <span>Period</span>
            <span>Trust</span>
            <span>Amount</span>
            <span>Manager</span>
            <span>Actions</span>
          </div>

          {reports.map((report) => {
            const owner =
              managers.find((manager) => manager.id === report.created_by)?.full_name ||
              managers.find((manager) => manager.id === report.created_by)?.email ||
              (report.created_by ? `#${report.created_by}` : "Unassigned");

            return (
              <div
                key={report.id}
                className="grid grid-cols-[84px_190px_1fr_130px_100px_110px_160px_140px] gap-3 border-t border-[var(--border)] px-4 py-3 text-sm"
              >
                <span className="font-[family-name:var(--font-mono)] text-[var(--muted)]">
                  {report.id}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-[family-name:var(--font-mono)] text-[var(--text)]">
                    {report.caar_id}
                  </div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {formatAdminDate(report.created_at)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--text)]">{report.location_name}</div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {report.account_id || "No account id"}
                  </div>
                </div>
                <span className="truncate text-[var(--muted)]">{report.period}</span>
                <span
                  className={`inline-flex h-fit w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    report.trust_score >= 85
                      ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                      : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                  }`}
                >
                  {report.trust_score}
                </span>
                <span className="text-[var(--text)]">{report.amount_display}</span>
                <div className="min-w-0">
                  <div className="truncate text-[var(--text)]">{owner}</div>
                  <div className="truncate text-xs text-[var(--muted)]">
                    {report.status} | {report.exhibits ?? 0} exhibits
                  </div>
                </div>
                <form action={deleteCaarReportAction}>
                  <input type="hidden" name="id" value={report.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-[rgba(214,48,49,0.18)] px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]"
                  >
                    Delete
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
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
