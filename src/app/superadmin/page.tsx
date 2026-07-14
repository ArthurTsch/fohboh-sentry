import type { Metadata } from "next";
import { Prisma } from "@/app/generated/prisma/client";
import {
  adminMetadata,
  AdminLoginScreen,
  AdminShell,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";
import prisma from "@/lib/prisma";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CountRow = {
  count: bigint | number;
};

type SumRow = {
  total: bigint | number | null;
};

type AvgRow = {
  avg: number | null;
};

type GroupRow = {
  count: bigint | number;
  label: string | null;
};

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

  const [
    managersCount,
    restaurantsCount,
    customersCount,
    locationsCount,
    totalCaars,
    totalCertRuns,
    uploadsCount,
    openTicketsCount,
    totalRecovered,
    avgTrustScore,
    admissibleCaars,
    locationStatusRows,
  ] = await Promise.all([
    prisma.managers.count(),
    prisma.restaurants.count(),
    prisma.customers.count({ where: { deleted_at: null } }),
    prisma.locations_v2.count({ where: { deleted_at: null } }),
    prisma.caars_v2.count(),
    prisma.cert_runs_v2.count(),
    prisma.uploads_v2.count(),
    prisma.support_tickets_v2.count({ where: { status: "open" } }),
    prisma.$queryRaw<SumRow[]>(Prisma.sql`
      SELECT COALESCE(SUM(recoverable_variance_cents), 0) AS total
      FROM public.caars_v2
    `),
    prisma.$queryRaw<AvgRow[]>(Prisma.sql`
      SELECT AVG(trust_score)::float AS avg
      FROM public.caars_v2
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM public.caars_v2
      WHERE court_admissible = true
    `),
    prisma.$queryRaw<GroupRow[]>(Prisma.sql`
      SELECT status AS label, COUNT(*)::bigint AS count
      FROM public.restaurant_sentry_state
      GROUP BY status
      ORDER BY status ASC
    `),
  ]);

  const totalRecoveredAmount = Number(totalRecovered[0]?.total ?? 0) / 100;
  const avgTrust = avgTrustScore[0]?.avg ? Math.round(avgTrustScore[0].avg) : 0;
  const certifiedCaars = Number(admissibleCaars[0]?.count ?? 0);

  const statusMap = new Map(
    locationStatusRows.map((row) => [row.label ?? "Unknown", Number(row.count ?? 0)]),
  );
  const certifiedLocations = statusMap.get("Certified") ?? 0;
  const atRiskLocations = statusMap.get("At Risk") ?? 0;
  const onboardingLocations = statusMap.get("Onboarding") ?? 0;
  const activePortfolio = certifiedLocations + atRiskLocations + onboardingLocations;
  const certifiedPct = activePortfolio ? Math.round((certifiedLocations / activePortfolio) * 100) : 0;
  const atRiskPct = activePortfolio ? Math.round((atRiskLocations / activePortfolio) * 100) : 0;
  const onboardingPct = activePortfolio ? Math.round((onboardingLocations / activePortfolio) * 100) : 0;

  return (
    <AdminShell
      currentPath="/superadmin"
      title="SuperAdmin Overview"
      description="Production dashboard for platform activity, certification output, recoverable value, and portfolio readiness."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            eyebrow="CAAR Output"
            label="Saved CAARs"
            value={formatInteger(totalCaars)}
            detail={`${formatInteger(certifiedCaars)} court-admissible reports`}
            tone="red"
          />
          <KpiCard
            eyebrow="Recovery"
            label="Certified Amount Found"
            value={formatCurrencyCompact(totalRecoveredAmount)}
            detail="Total recoverable variance saved across CAARs"
            tone="green"
          />
          <KpiCard
            eyebrow="Accounts"
            label="Total Users"
            value={formatInteger(managersCount)}
            detail={`${formatInteger(customersCount)} customer accounts`}
            tone="blue"
          />
          <KpiCard
            eyebrow="Portfolio"
            label="Total Restaurants"
            value={formatInteger(restaurantsCount)}
            detail={`${formatInteger(locationsCount)} normalized location entries`}
            tone="gold"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Portfolio Health
                </div>
                <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                  Location Readiness Snapshot
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  Live distribution of persisted location status from the production workflow state.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                <div className="text-3xl font-bold text-[var(--text)]">{avgTrust}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">Average CAAR trust score</div>
              </div>
            </div>

            <div className="mt-6 h-4 overflow-hidden rounded-full bg-[var(--surface)]">
              <div className="flex h-full w-full">
                <div
                  className="h-full bg-[var(--success)]"
                  style={{ width: `${certifiedPct}%` }}
                />
                <div
                  className="h-full bg-[#F59E0B]"
                  style={{ width: `${atRiskPct}%` }}
                />
                <div
                  className="h-full bg-[rgba(214,48,49,0.85)]"
                  style={{ width: `${onboardingPct}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatusCard label="Certified" value={certifiedLocations} percent={certifiedPct} tone="green" />
              <StatusCard label="At Risk" value={atRiskLocations} percent={atRiskPct} tone="amber" />
              <StatusCard label="Onboarding" value={onboardingLocations} percent={onboardingPct} tone="red" />
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              Activity
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Operational Throughput
            </h2>
            <div className="mt-5 space-y-3">
              <MetricRow label="Certification Runs" value={formatInteger(totalCertRuns)} />
              <MetricRow label="Uploads Saved" value={formatInteger(uploadsCount)} />
              <MetricRow label="Open Support Tickets" value={formatInteger(openTicketsCount)} />
              <MetricRow label="Customer Accounts" value={formatInteger(customersCount)} />
              <MetricRow label="Normalized Locations" value={formatInteger(locationsCount)} />
            </div>
          </section>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniInsightCard
            label="Managers"
            value={formatInteger(managersCount)}
            detail="Login-capable internal and client-facing manager accounts."
          />
          <MiniInsightCard
            label="Restaurants"
            value={formatInteger(restaurantsCount)}
            detail="Restaurant records currently persisted in production."
          />
          <MiniInsightCard
            label="Court-Admissible CAARs"
            value={formatInteger(certifiedCaars)}
            detail="CAARs that cleared the final release gate."
          />
          <MiniInsightCard
            label="Average Trust Score"
            value={`${avgTrust}/100`}
            detail="Average across persisted CAAR outputs."
          />
        </section>
      </div>
    </AdminShell>
  );
}

function KpiCard({
  detail,
  eyebrow,
  label,
  tone,
  value,
}: {
  detail: string;
  eyebrow: string;
  label: string;
  tone: "blue" | "gold" | "green" | "red";
  value: string;
}) {
  const toneClass = {
    blue: "text-[var(--info)] border-[rgba(29,78,216,0.16)] bg-[rgba(29,78,216,0.05)]",
    gold: "text-[#A16207] border-[rgba(161,98,7,0.16)] bg-[rgba(245,158,11,0.08)]",
    green: "text-[var(--success)] border-[rgba(0,200,83,0.16)] bg-[rgba(0,200,83,0.06)]",
    red: "text-[var(--accent)] border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)]",
  }[tone];

  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
      <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
        {eyebrow}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-4xl font-bold tracking-[-0.05em] text-[var(--text)]">{value}</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text)]">{label}</div>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] ${toneClass}`}>
          Live
        </div>
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{detail}</p>
    </section>
  );
}

function StatusCard({
  label,
  percent,
  tone,
  value,
}: {
  label: string;
  percent: number;
  tone: "amber" | "green" | "red";
  value: number;
}) {
  const toneClass = {
    amber: "bg-[#FFF3D6] text-[#B45309]",
    green: "bg-[rgba(0,200,83,0.08)] text-[var(--success)]",
    red: "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]",
  }[tone];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneClass}`}>
        {label}
      </div>
      <div className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[var(--text)]">{formatInteger(value)}</div>
      <div className="mt-2 text-sm text-[var(--muted)]">{percent}% of active persisted locations</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="text-lg font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}

function MiniInsightCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.05)]">
      <div className="text-3xl font-bold tracking-[-0.05em] text-[var(--text)]">{value}</div>
      <div className="mt-2 text-base font-semibold text-[var(--text)]">{label}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </section>
  );
}

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 1,
    notation: value >= 1000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
