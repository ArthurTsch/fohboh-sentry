import { moduleSummaries } from "../data";
import type { LocationRecord, LogRecord } from "../types";
import { Badge, HelpTip, KpiCard, SectionCard } from "../ui/primitives";
import { getScoreBar } from "../utils";

export function DashboardView({
  averageTrust,
  locations,
  logs,
  openLog,
  totalRecovery,
  totalCaars,
  openWaterfall,
}: {
  averageTrust: number;
  locations: LocationRecord[];
  logs: LogRecord[];
  openLog: () => void;
  totalRecovery: string;
  totalCaars: number;
  openWaterfall: () => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <div className="font-[family-name:var(--font-display)] text-[26px] font-bold tracking-[-0.04em] text-[var(--text)]">
          Good morning
        </div>
        <div className="mt-1 text-[13px] text-[var(--muted)]">
          Here&apos;s your Sentry overview across all locations.
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Recovery MTD"
          value={totalRecovery}
          sub="Certified evidence only"
          accent
          labelHelp={{
            title: "Dashboard / KPI 01",
            sections: [
              {
                label: "What It Is",
                text: "Sum of all certified fee overcharge recoveries across the active location scope for the current period.",
              },
              {
                label: "How To Use It",
                text: "Track movement after each certification cycle and investigate any decline through Waterfall or Upload Center.",
              },
              {
                label: "Why It Matters",
                text: "Every dollar here should trace to governed evidence and a certifiable recovery path, not an estimate.",
              },
            ],
            footerLabel: "Output Type",
            footerValue: "Certified evidence only",
          }}
        />
        <KpiCard
          label="Avg Trust Score"
          value={String(averageTrust)}
          sub={`Across ${locations.length} active locations`}
          accent={averageTrust >= 85}
          labelHelp={{
            title: "Dashboard / KPI 02",
            sections: [
              {
                label: "What It Is",
                text: "Weighted average Trust Score across the currently visible enrolled locations.",
              },
              {
                label: "How To Use It",
                text: "Use it as a portfolio health signal, then drill into locations pulling the average down.",
              },
              {
                label: "Why It Matters",
                text: "Trust Score below release threshold indicates evidence or reconciliation problems that block CAAR generation.",
              },
            ],
            footerLabel: "CAAR Gate",
            footerValue: "Score >= 85 per location",
          }}
        />
        <KpiCard
          label="CAARs Issued"
          value={String(visibleCourtAdmissible(totalCaars))}
          sub={`${totalCaars} total visible`}
          labelHelp={{
            title: "Dashboard / KPI 03",
            sections: [
              {
                label: "What It Is",
                text: "Count of court-admissible CAAR packages visible in the current account scope.",
              },
              {
                label: "How To Use It",
                text: "Open the CAAR view to inspect legal posture, exhibit coverage, and claim-pack readiness.",
              },
              {
                label: "Why It Matters",
                text: "A CAAR is certified evidence intended for downstream legal or recovery delivery.",
              },
            ],
            footerLabel: "Legal Standard",
            footerValue: "FRE 803(6) / 902(11) / 1002",
          }}
        />
        <KpiCard
          label="Total IUM"
          value={sumIum(locations)}
          sub="Infrastructure under management"
          labelHelp={{
            title: "Dashboard / KPI 04",
            sections: [
              {
                label: "What It Is",
                text: "Intelligence Under Management across visible locations and active module coverage.",
              },
              {
                label: "How To Use It",
                text: "Compare it against expected business scale to catch missing feeds or incomplete intake coverage.",
              },
              {
                label: "Why It Matters",
                text: "IUM is only meaningful when supported by native transaction-level data intake.",
              },
            ],
            footerLabel: "Coverage Proxy",
            footerValue: "Governed transaction value",
          }}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <SectionCard className="bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold tracking-[0.04em] text-[var(--text)]">
            <span>TRUST SCORES BY LOCATION</span>
            <HelpTip
              title="Dashboard / Trust Map"
              sections={[
                {
                  label: "What It Is",
                  text: "Per-location M01 (Merchant Fee) and M02 (Delivery Fee) Trust Scores shown as dual progress bars.",
                },
                {
                  label: "What It Does",
                  text: "Lets you spot which locations are dragging your portfolio average. Click Location Waterfall to drill into a specific location.",
                },
                {
                  label: "Why It Matters",
                  text: "A location must reach TS >= 85 on both M01 and M02 before a CAAR can be generated. Low bars here block revenue recovery.",
                },
              ]}
              footerLabel="CAAR Gate"
              footerValue=">= 85 per module per location"
            />
          </div>
          <div className="flex flex-col gap-[14px]">
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={openWaterfall}
                className="block w-full rounded-[6px] text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
              >
                <div className="mb-[5px] flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[var(--text)]">{location.name}</span>
                  <span className="text-[11px] font-semibold">
                    <span className={scoreTextClass(location.m01)}>M01 {location.m01}</span>
                    <span className="text-[var(--muted)]"> / </span>
                    <span className={scoreTextClass(location.m02)}>M02 {location.m02}</span>
                  </span>
                </div>
                <div className="flex gap-1">
                  <TrustScoreBar value={location.m01} />
                  <TrustScoreBar value={location.m02} />
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold tracking-[0.04em] text-[var(--text)]">
            <span>RECENT ACTIVITY</span>
            <HelpTip
              title="Dashboard / Recent Activity"
              sections={[
                {
                  label: "What It Is",
                  text: "Latest visible events from upload, schema, certification, and governance workflows.",
                },
                {
                  label: "What It Does",
                  text: "Gives operators a fast read on what just changed without leaving the dashboard.",
                },
                {
                  label: "Why It Matters",
                  text: "Recent certified events usually explain sudden trust or recovery changes elsewhere on the screen.",
                },
              ]}
            />
          </div>
          <div className="flex h-full flex-col gap-3">
            {logs.slice(0, 4).map((entry) => (
              <div key={entry.hash} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{entry.action}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {entry.location} / {entry.ts}
                    </div>
                  </div>
                  <Badge tone={entry.immutable ? "success" : "neutral"}>
                    {entry.immutable ? "Immutable" : "Draft"}
                  </Badge>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={openLog}
              className="mt-2 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              View Full Log -&gt;
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {moduleSummaries.map((module) => {
          const borderTone =
            module.status === "ACTIVE"
              ? "border-l-[var(--success)]"
              : module.status === "BETA"
                ? "border-l-[#ff9800]"
                : "border-l-[var(--border)]";

          return (
            <div
              key={module.id}
              className={`rounded-[10px] border border-[var(--border)] border-l-[3px] ${borderTone} bg-[var(--surface)] p-4`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-[13px] font-semibold">
                  {module.icon} {module.id} - {module.name}
                </div>
                <span
                  className={`rounded-[3px] px-2 py-1 text-[10px] font-semibold ${
                    module.status === "ACTIVE"
                      ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                      : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)]"
                  }`}
                >
                  {module.status === "BETA" ? "LOCKED" : module.status}
                </span>
              </div>
              <div className="text-[12px] text-[var(--muted)]">
                {module.id === "M01"
                  ? `${module.rules} rules active / Last run: today 06:14`
                  : module.id === "M02"
                    ? `${module.name.includes("Delivery") ? "M02 Trust Score" : "Trust Score"}: ${module.trustScore} / Last run: today 05:58`
                    : "Unlocks after M01+M02 active >= 90 days"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrustScoreBar({ value }: { value: number }) {
  const barClass = getScoreBar(value);

  return (
    <div className="h-[6px] flex-1 overflow-hidden rounded-[3px] bg-[var(--panel-soft)]">
      <div
        className={`h-full rounded-[3px] transition-[width] duration-500 ${barClass}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function sumIum(locations: LocationRecord[]) {
  const total = locations.reduce((sum, location) => {
    const value = Number(location.ium.replace(/[^0-9.]/g, ""));
    const multiplier = location.ium.toUpperCase().includes("K") ? 1000 : 1;
    return sum + value * multiplier;
  }, 0);

  if (total >= 1_000_000) {
    return `$${(total / 1_000_000).toFixed(1)}M`;
  }

  if (total >= 1000) {
    return `$${(total / 1000).toFixed(1)}K`;
  }

  return `$${Math.round(total)}`;
}

function visibleCourtAdmissible(totalCaars: number) {
  return totalCaars;
}

function scoreTextClass(value: number) {
  if (value >= 90) return "text-[var(--success)]";
  if (value >= 85) return "text-[#c07500]";
  return "text-[var(--accent)]";
}
