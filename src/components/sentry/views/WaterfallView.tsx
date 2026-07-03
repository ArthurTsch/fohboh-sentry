import type { CaarRecord, LocationRecord, LocationWorkflowState, Role } from "../types";
import { Badge, HelpTip, SectionCard } from "../ui/primitives";

export function WaterfallView({
  caars,
  expandedLocations,
  locations,
  onAddLocation,
  onExpandAll,
  onOpenCaar,
  onOpenDiy,
  onOpenOnboarding,
  onOpenSchema,
  onRunCertification,
  onToggleLocation,
  onOpenUploads,
  role,
  workflowByLocation,
}: {
  caars: CaarRecord[];
  expandedLocations: string[];
  locations: LocationRecord[];
  onAddLocation: () => void;
  onExpandAll: () => void;
  onOpenCaar: (record: CaarRecord) => void;
  onOpenDiy: () => void;
  onOpenOnboarding: (locationId: string) => void;
  onOpenSchema: () => void;
  onRunCertification: (locationId: string) => void;
  onToggleLocation: (id: string) => void;
  onOpenUploads: (locationId: string) => void;
  role: Role;
  workflowByLocation: Record<string, LocationWorkflowState>;
}) {
  const canUpload =
    role === "Admin" || role === "SuperAdmin" || role === "Manager" || role === "WGS Manager";
  const canRunCertification =
    role === "Admin" || role === "SuperAdmin" || role === "WGS Manager";

  return (
    <SectionCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span>Compare M01, M02, recovery value, and evidence readiness by location.</span>
          <HelpTip
            title="Waterfall / Location View"
            sections={[
              {
                label: "What It Is",
                text: "A per-location operational grid showing the current trust and recovery posture for the active scope.",
              },
              {
                label: "What It Does",
                text: "Lets you expand any row to launch onboarding, uploads, CAAR review, or certification actions.",
              },
              {
                label: "Why It Matters",
                text: "If one location is dragging portfolio performance, it usually becomes obvious here first.",
              },
            ]}
            footerLabel="Coverage"
            footerValue="All enrolled locations"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExpandAll}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Expand All
            </button>
            <HelpTip
              title="Waterfall / Actions"
              sections={[
                {
                  label: "What It Is",
                  text: "Expands every location row simultaneously to show the full per-module Trust Score breakdown, recovery detail, and quick actions.",
                },
                {
                  label: "What It Does",
                  text: "Useful for a full portfolio review before generating monthly CAAR ExportPacks or before a board-level performance review.",
                },
                {
                  label: "Why It Matters",
                  text: "Expanding all at once makes it easy to spot locations with Trust Score gaps side-by-side without clicking each row individually.",
                },
              ]}
              footerLabel="Tip"
              footerValue="Collapse individual rows by clicking them again"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddLocation}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Add Location
            </button>
            <HelpTip
              title="Waterfall / Actions"
              sections={[
                {
                  label: "What It Is",
                  text: "Opens the 3-step onboarding wizard to register a new location: location details, module selection, and onboarding checklist.",
                },
                {
                  label: "What It Does",
                  text: "Notifies your WGS Advisor to begin the Contract Config and Schema Registry setup process for the new location.",
                },
                {
                  label: "Why It Matters",
                  text: "A location must be fully onboarded, Contract Config sealed, and Schema Registry current before its first certification run produces valid certified output.",
                },
              ]}
              footerLabel="Lead Time"
              footerValue="WGS setup: 2-5 business days"
            />
          </div>
        </div>
      </div>

      <div className="hidden grid-cols-[220px_90px_90px_90px_110px_110px_1fr] gap-3 bg-[var(--panel-soft)] px-5 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
        <span>Location</span>
        <HeaderWithTip
          label="M01 TS"
          title="Waterfall / Col 01"
          sections={[
            {
              label: "What It Is",
              text: "Merchant Fee Recovery Trust Score for this location. Measures completeness and quality of card processor statement analysis.",
            },
            {
              label: "How To Use It",
              text: "Click the row to expand and see recovery detail. A low M01 TS usually means a missing terminal registration or unresolved processor naming anomaly.",
            },
            {
              label: "Why It Matters",
              text: "Trust Score below 85 blocks CAAR generation for this location.",
            },
          ]}
          footerLabel="CAAR Gate"
          footerValue=">= 85 required"
        />
        <HeaderWithTip
          label="M02 TS"
          title="Waterfall / Col 02"
          sections={[
            {
              label: "What It Is",
              text: "Delivery Fee Recovery Trust Score for this location. Measures DSP commission statement coverage and commission base accuracy.",
            },
            {
              label: "How To Use It",
              text: "Low M02 TS most often means a commission base field misconfiguration or a missing adjustments CSV upload.",
            },
            {
              label: "Why It Matters",
              text: "A single wrong commission base column systematically understates every variance for the entire period.",
            },
          ]}
          footerLabel="CAAR Gate"
          footerValue=">= 85 required"
        />
        <HeaderWithTip
          label="M03"
          title="Waterfall / Col 03"
          sections={[
            {
              label: "What It Is",
              text: "Royalty Fee Recovery: 27-vector forensic audit for franchise operators. Detects royalty base underreporting.",
            },
            {
              label: "How To Use It",
              text: "M03 unlocks when M01 and M02 have both been active >= 90 days and both Trust Scores reach >= 85.",
            },
            {
              label: "Why It Matters",
              text: "Royalty disputes require court-admissible evidence. M03 output meets FRE 803(6); standard audits do not.",
            },
          ]}
          footerLabel="Unlock Condition"
          footerValue="M01+M02 active >= 90 days"
        />
        <HeaderWithTip
          label="Recovery"
          title="Waterfall / Col 04"
          sections={[
            {
              label: "What It Is",
              text: "Certified fee overcharge recovery for this location, month-to-date. Sum of M01 and M02 certified variance amounts.",
            },
            {
              label: "How To Use It",
              text: "This figure documents money you have certified basis to demand back. Use the CAAR ExportPack to file the demand.",
            },
            {
              label: "Why It Matters",
              text: "FohBoh certifies evidence; the client collects. Every dollar traces to a specific rule and a specific data source.",
            },
          ]}
          footerLabel="Basis"
          footerValue="Certified / not estimated"
        />
        <HeaderWithTip
          label="IUM"
          title="Waterfall / Col 05"
          sections={[
            {
              label: "What It Is",
              text: "Intelligence Under Management for this location: total transaction value being monitored across active modules.",
            },
            {
              label: "How To Use It",
              text: "Relative IUM across locations flags where data coverage may be incomplete.",
            },
            {
              label: "Why It Matters",
              text: "IUM is only valid at the transaction level, not period totals. Native CSV intake is the only way to achieve full IUM.",
            },
          ]}
          footerLabel="Coverage Signal"
          footerValue="Per-location governed value"
        />
        <span className="text-right">Actions</span>
      </div>

      <div>
        {locations.map((location) => {
          const open = expandedLocations.includes(location.id);
          const caar = caars.find((record) => record.locationId === location.id);
          const onboarding = location.status === "Onboarding";
          const workflow = workflowByLocation[location.id];
          const primaryActionLabel = onboarding
            ? "Start Onboarding"
            : workflow?.primaryLabel ?? "Upload Data";

          return (
            <div
              key={location.id}
              className={`border-t border-[var(--border)] first:border-t-0 ${
                onboarding ? "border-l-[3px] border-l-[var(--accent)] opacity-85" : ""
              }`}
            >
              <div className="grid gap-3 px-5 py-4 lg:grid-cols-[220px_90px_90px_90px_110px_110px_1fr]">
                <button
                  type="button"
                  onClick={() => {
                    if (!onboarding) onToggleLocation(location.id);
                  }}
                  className="contents text-left"
                >
                  <div>
                    <div className="font-medium text-[var(--text)]">
                      {location.name}
                      {onboarding ? (
                        <span className="ml-2 inline-flex rounded-full bg-[rgba(214,48,49,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)] align-middle">
                          ONBOARDING
                        </span>
                      ) : null}
                    </div>
                    <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                      {location.id}
                    </div>
                  </div>
                  <div>{onboarding ? <PendingSetup /> : <TrustBadge score={location.m01} />}</div>
                  <div>{onboarding ? <PendingSetup /> : <TrustBadge score={location.m02} />}</div>
                  <div>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                      Lock M03
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-[var(--text)]">
                    {onboarding ? "-" : formatRecoveryCompact(location.recovery)}
                  </div>
                  <div className="text-[13px] text-[var(--text)]">{onboarding ? "-" : location.ium}</div>
                </button>

                <div className="flex flex-wrap justify-end gap-2">
                  {onboarding || (workflow && !workflow.readyForCertification) ? (
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction(workflow?.primaryAction ?? "onboarding", {
                        locationId: location.id,
                        onOpenDiy,
                        onOpenOnboarding,
                        onOpenUploads,
                      })}
                      className="rounded-lg border border-[var(--accent)] bg-[rgba(214,48,49,0.08)] px-3 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(214,48,49,0.14)]"
                    >
                      {primaryActionLabel}
                    </button>
                  ) : canUpload ? (
                    <button
                      type="button"
                      onClick={() => onOpenUploads(location.id)}
                      className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                    >
                      Upload Data
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] opacity-50"
                    >
                      No Access
                    </button>
                  )}

                  {!onboarding ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (caar) onOpenCaar(caar);
                      }}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                    >
                      View CAARs
                    </button>
                  ) : null}

                  {!onboarding && canRunCertification ? (
                    <button
                      type="button"
                      onClick={() => onRunCertification(location.id)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        workflow?.readyForCertification
                          ? "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          : "border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.05)] text-[var(--accent)] hover:bg-[rgba(214,48,49,0.1)]"
                      }`}
                    >
                      {workflow?.readyForCertification ? "Run Cert" : "Review Blockers"}
                    </button>
                  ) : null}
                </div>
              </div>

              {!onboarding && open ? (
                <div className="bg-[var(--surface)] px-5 py-5">
                  {workflow ? (
                    <WorkflowStatusCard
                      onOpenDiy={() => onOpenDiy()}
                      onOpenUploads={() => onOpenUploads(location.id)}
                      onRunCertification={() => onRunCertification(location.id)}
                      workflow={workflow}
                    />
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-3">
                    <DetailCard
                      label="M01 Recovery This Month"
                      value={formatSplitRecovery(location.recovery, 0.6)}
                      valueClass="text-[var(--success)]"
                      sub="Merchant fee overcharges certified"
                    />
                    <DetailCard
                      label="M02 Recovery This Month"
                      value={formatSplitRecovery(location.recovery, 0.4)}
                      valueClass="text-[var(--success)]"
                      sub="Delivery fee overcharges certified"
                    />
                    <DetailCard
                      label="IUM (Infrastructure Under Management)"
                      value={location.ium}
                      valueClass="text-[var(--accent)]"
                      sub="Total governed transaction value"
                    />
                  </div>

                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
                    <span className="font-semibold text-[var(--text)]">Lock M03 Royalty Recovery</span>
                    <span> / Locked. Requires M01 + M02 active {"\u003e"}= 90 days and Trust Score {"\u003e"}= 85 on both modules.</span>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {location.modules.map((module) => (
                      <div key={`${location.id}:${module.label}`} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-[var(--text)]">{module.label}</div>
                          <span className="rounded-full bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                            {module.score}
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{module.note}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                    <button
                      type="button"
                      onClick={() => onOpenUploads(location.id)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                    >
                      Upload Data
                    </button>
                    <button
                      type="button"
                      onClick={workflow?.primaryAction === "diy" ? onOpenDiy : onOpenSchema}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                    >
                      {workflow?.primaryAction === "diy" ? "DIY Access" : "Schema Registry"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (caar) onOpenCaar(caar);
                      }}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                    >
                      View CAARs
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function WorkflowStatusCard({
  onOpenDiy,
  onOpenUploads,
  onRunCertification,
  workflow,
}: {
  onOpenDiy: () => void;
  onOpenUploads: () => void;
  onRunCertification: () => void;
  workflow: LocationWorkflowState;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--text)]">
            Certification Workflow
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {workflow.readyForCertification
              ? "All governed prerequisites are complete for the next certification cycle."
              : "Action is still required before certification can run."}
          </div>
        </div>
        <Badge tone={workflow.readyForCertification ? "success" : "warning"}>
          {workflow.readyForCertification ? "Ready" : "Action Required"}
        </Badge>
      </div>

      {workflow.blockers.length > 0 ? (
        <div className="mt-4 space-y-2">
          {workflow.blockers.map((blocker, index) => (
            <div
              key={`workflow-blocker:${index}:${blocker}`}
              className="rounded-xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--text)]"
            >
              {blocker}
            </div>
          ))}
        </div>
      ) : null}

      {workflow.warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          {workflow.warnings.map((warning, index) => (
            <div
              key={`workflow-warning:${index}:${warning}`}
              className="rounded-xl border border-[rgba(255,152,0,0.18)] bg-[rgba(255,152,0,0.08)] px-4 py-3 text-sm text-[var(--text)]"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            if (workflow.readyForCertification) {
              onRunCertification();
              return;
            }

            if (workflow.primaryAction === "diy") {
              onOpenDiy();
              return;
            }

            onOpenUploads();
          }}
          className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
        >
          {workflow.readyForCertification ? "Run Certification" : workflow.primaryLabel}
        </button>
        <button
          type="button"
          onClick={onOpenUploads}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
        >
          Open Upload Data
        </button>
        <button
          type="button"
          onClick={onOpenDiy}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
        >
          Open DIY Access
        </button>
      </div>
    </div>
  );
}

function handleWorkflowAction(
  action: LocationWorkflowState["primaryAction"],
  handlers: {
    locationId: string;
    onOpenDiy: () => void;
    onOpenOnboarding: (locationId: string) => void;
    onOpenUploads: (locationId: string) => void;
  },
) {
  if (action === "onboarding") {
    handlers.onOpenOnboarding(handlers.locationId);
    return;
  }

  if (action === "diy") {
    handlers.onOpenDiy();
    return;
  }

  handlers.onOpenUploads(handlers.locationId);
}

function HeaderWithTip({
  label,
  title,
  sections,
  footerLabel,
  footerValue,
}: {
  label: string;
  title: string;
  sections: { label: string; text: string }[];
  footerLabel?: string;
  footerValue?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span>{label}</span>
      <HelpTip
        title={title}
        sections={sections}
        footerLabel={footerLabel}
        footerValue={footerValue}
      />
    </span>
  );
}

function TrustBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex min-w-[38px] justify-center rounded-full px-2 py-1 text-[11px] font-semibold ${
        score >= 90
          ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
          : "bg-[rgba(255,152,0,0.1)] text-[#b86a00]"
      }`}
    >
      {score}
    </span>
  );
}

function PendingSetup() {
  return <span className="text-[11px] text-[var(--muted)]">Pending setup</span>;
}

function DetailCard({
  label,
  sub,
  value,
  valueClass,
}: {
  label: string;
  sub: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.05em] ${valueClass}`}>
        {value}
      </div>
      <div className="mt-2 text-sm text-[var(--muted)]">{sub}</div>
    </div>
  );
}

function formatRecoveryCompact(value: string) {
  const amount = parseCurrency(value);
  return `$${(amount / 1000).toFixed(0)}K`;
}

function formatSplitRecovery(value: string, ratio: number) {
  const amount = parseCurrency(value);
  return `$${((amount * ratio) / 1000).toFixed(1)}K`;
}

function parseCurrency(value: string) {
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}
