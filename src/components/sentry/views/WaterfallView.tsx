import type { LocationRecord, LocationWorkflowState, Role } from "../types";
import { HelpTip, SectionCard } from "../ui/primitives";
import { formatCurrency } from "../utils";

export function WaterfallView({
  hasTeamAccount,
  locations,
  onAddLocation,
  onGoToTeamAccess,
  onOpenLocation,
  role,
  workflowByLocation,
}: {
  hasTeamAccount: boolean;
  locations: LocationRecord[];
  onAddLocation: () => void;
  onGoToTeamAccess: () => void;
  onOpenLocation: (locationId: string) => void;
  role: Role;
  workflowByLocation: Record<string, LocationWorkflowState>;
}) {
  return (
    <SectionCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span>Select a location to open its dedicated workspace.</span>
          <HelpTip
            title="Location Index"
            sections={[
              {
                label: "What It Is",
                text: "A portfolio index of locations with their current module scores, recovery posture, and operational readiness.",
              },
              {
                label: "What It Does",
                text: "Click any location row to open its scoped workspace with the location dashboard, CAAR history, and vault workflow.",
              },
              {
                label: "Why It Matters",
                text: "Location operations are easier to manage when certification, evidence, and governance stay scoped to one restaurant at a time.",
              },
            ]}
            footerLabel="Mode"
            footerValue="Click row to open"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddLocation}
            disabled={!hasTeamAccount && role !== "WGS Manager"}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              !hasTeamAccount && role !== "WGS Manager"
                ? "cursor-not-allowed border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)] opacity-70"
                : "bg-[var(--accent)] text-white hover:opacity-90"
            }`}
          >
            Add Location
          </button>
        </div>
      </div>

      {!hasTeamAccount && role !== "WGS Manager" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[rgba(214,48,49,0.04)] px-5 py-4">
          <div className="text-sm text-[var(--accent)]">
            A real team account is required before a location can be created. Open `Team & Access`
            and set the customer team account first.
          </div>
          <button
            type="button"
            onClick={onGoToTeamAccess}
            className="rounded-lg border border-[rgba(214,48,49,0.2)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(214,48,49,0.05)]"
          >
            Open Team &amp; Access
          </button>
        </div>
      ) : null}

      <div className="hidden grid-cols-[2.1fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] gap-3 bg-[var(--panel-soft)] px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
        <span>Location</span>
        <span>M01 TS</span>
        <span>M02 TS</span>
        <span>M03</span>
        <span>Recovery</span>
        <span>Status</span>
      </div>

      <div>
        {locations.map((location) => {
          const workflow = workflowByLocation[location.id];
          const hasM01 = location.modules.some((module) => module.label === "M01");
          const hasM02 = location.modules.some((module) => module.label === "M02");

          return (
            <button
              key={location.id}
              type="button"
              onClick={() => onOpenLocation(location.id)}
              className="grid w-full gap-3 border-t border-[var(--border)] px-5 py-4 text-left transition hover:bg-[var(--surface)] lg:grid-cols-[2.1fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-[var(--text)]">{location.name}</div>
                  {location.status === "Onboarding" ? (
                    <span className="inline-flex rounded-full bg-[rgba(214,48,49,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      ONBOARDING
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  {location.id}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {location.modules
                    .filter((module) => module.label === "M01" || module.label === "M02")
                    .map((module) => (
                      <span
                        key={`${location.id}:${module.label}`}
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          module.label === "M01"
                            ? "border border-[rgba(0,97,255,0.16)] bg-[rgba(0,97,255,0.08)] text-[var(--info)]"
                            : "border border-[rgba(255,152,0,0.24)] bg-[rgba(255,152,0,0.12)] text-[#B86A00]"
                        }`}
                      >
                        {module.label}
                      </span>
                    ))}
                </div>
              </div>
              <div className="lg:pt-1">{hasM01 ? <TrustBadge score={location.m01} /> : <MissingModule />}</div>
              <div className="lg:pt-1">{hasM02 ? <TrustBadge score={location.m02} /> : <MissingModule />}</div>
              <div className="lg:pt-1">
                <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                  Lock M03
                </span>
              </div>
              <div className="text-[13px] font-semibold text-[var(--text)] lg:pt-1">
                {location.status === "Onboarding" ? "-" : formatRecoveryDisplay(location.recovery)}
              </div>
              <div className="lg:pt-1">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    workflow?.readyForCertification
                      ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                      : workflow?.blockers?.length
                        ? "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                        : "bg-[var(--panel-soft)] text-[var(--muted)]"
                  }`}
                >
                  {workflow?.readyForCertification
                    ? "Ready"
                    : location.status === "Onboarding"
                      ? "Onboarding"
                      : workflow?.primaryLabel ?? "Needs Action"}
                </span>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  Open location workspace
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

function TrustBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex min-w-[38px] justify-center rounded-full px-2 py-1 text-[11px] font-semibold ${
        score >= 90
          ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
          : score >= 85
            ? "bg-[rgba(255,152,0,0.1)] text-[#b86a00]"
            : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
      }`}
    >
      {score}
    </span>
  );
}

function MissingModule() {
  return <span className="text-[13px] font-semibold text-[var(--muted)]">-</span>;
}

function formatRecoveryDisplay(value: string) {
  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? formatCurrency(numeric) : value;
}
