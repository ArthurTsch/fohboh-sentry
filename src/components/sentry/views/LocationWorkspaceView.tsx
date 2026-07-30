import { useMemo, useState } from "react";
import type {
  CaarRecord,
  LocationRecord,
  LocationSourceConfig,
  LocationWorkflowState,
  Role,
  SchemaWorkspace,
} from "../types";
import { LocationSourceSettingsModal } from "../overlays/LocationSourceSettingsModal";
import { HelpTip, SectionCard } from "../ui/primitives";
import { formatCurrency } from "../utils";
import { resolveVendorKey } from "../vendor-catalog";

type LocationWorkspaceTab = "dashboard" | "caars" | "vault";

export function LocationWorkspaceView({
  caars,
  location,
  locationSourceConfig,
  onOpenCaar,
  onOpenOnboarding,
  onOpenUploads,
  onRunCertification,
  onEditWorkspace,
  onInitializeWorkspace,
  onManageSources,
  onSealWorkspace,
  role,
  workspaces,
  workflow,
}: {
  caars: CaarRecord[];
  location: LocationRecord;
  locationSourceConfig: LocationSourceConfig | null;
  onOpenCaar: (record: CaarRecord) => void;
  onOpenOnboarding: (locationId: string) => void;
  onOpenUploads: (locationId: string) => void;
  onRunCertification: (locationId: string) => void;
  onEditWorkspace: (workspace: SchemaWorkspace) => void;
  onInitializeWorkspace: (locationId: string, module: "M01" | "M02", vendor?: string) => void;
  onManageSources: (next: {
    m01Enabled: boolean;
    m01Vendors: string[];
    m02Enabled: boolean;
    m02Vendors: string[];
  }) => void | Promise<void>;
  onSealWorkspace: (workspace: SchemaWorkspace) => void | Promise<void>;
  role: Role;
  workspaces: SchemaWorkspace[];
  workflow: LocationWorkflowState;
}) {
  const [tab, setTab] = useState<LocationWorkspaceTab>("dashboard");
  const [showManageSources, setShowManageSources] = useState(false);
  const canManageSources = role === "Admin" || role === "SuperAdmin" || role === "WGS Manager";
  const locationCaars = useMemo(() => {
    const seenCaarIds = new Set<string>();
    return caars.filter((record) => {
      if (record.locationId !== location.id || seenCaarIds.has(record.id)) {
        return false;
      }
      seenCaarIds.add(record.id);
      return true;
    });
  }, [caars, location.id]);
  const locationWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.locationId === location.id),
    [location.id, workspaces],
  );
  const configuredWorkspaceTargets = useMemo(
    () => [
      ...(locationSourceConfig?.m01Enabled
        ? locationSourceConfig.m01Vendors.map((vendor) => ({
            module: "M01" as const,
            vendor,
          }))
        : []),
      ...(locationSourceConfig?.m02Enabled
        ? locationSourceConfig.m02Vendors.map((vendor) => ({
            module: "M02" as const,
            vendor,
          }))
        : []),
    ],
    [locationSourceConfig],
  );
  const missingWorkspaceTargets = useMemo(
    () =>
      configuredWorkspaceTargets.filter(
        (target) =>
          !locationWorkspaces.some(
            (workspace) =>
              workspace.module === target.module &&
              resolveVendorKey(target.module, workspace.vendor) === target.vendor.key,
          ),
      ),
    [configuredWorkspaceTargets, locationWorkspaces],
  );
  const defaultVendorByModule = useMemo(
    () => ({
      M01: locationSourceConfig?.m01Vendors?.[0]?.name,
      M02: locationSourceConfig?.m02Vendors?.[0]?.name,
    }),
    [locationSourceConfig],
  );
  const governedModules = location.modules
    .map((module) => module.label)
    .filter((label): label is "M01" | "M02" => label === "M01" || label === "M02");
  const governanceRequirement = workflow.requirements.find(
    (requirement) => requirement.key === "governance",
  );
  const uploadLockedByVault = governanceRequirement?.status === "action_required";
  const firstDraftWorkspace = locationWorkspaces.find(
    (workspace) => workspace.status !== "sealed" && workspace.vault.state !== "sealed",
  );
  const firstMissingWorkspaceModule = governedModules.find(
    (module) =>
      !locationWorkspaces.some(
        (workspace) =>
          workspace.module === module &&
          (workspace.status === "sealed" || workspace.vault.state === "sealed"),
      ),
  );

  function openSealVaultWorkflow() {
    setTab("vault");

    if (firstDraftWorkspace) {
      onEditWorkspace(firstDraftWorkspace);
      return;
    }

    if (missingWorkspaceTargets[0]) {
      onInitializeWorkspace(
        location.id,
        missingWorkspaceTargets[0].module,
        missingWorkspaceTargets[0].vendor.name,
      );
      return;
    }

    if (firstMissingWorkspaceModule) {
      onInitializeWorkspace(
        location.id,
        firstMissingWorkspaceModule,
        defaultVendorByModule[firstMissingWorkspaceModule],
      );
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard className="overflow-hidden p-0">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              Location Workspace
            </div>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.06em] text-[var(--text)]">
              {location.name}
            </h1>
            <div className="mt-2 text-sm text-[var(--muted)]">
              {location.id} {location.market ? `• ${location.market}` : ""}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {location.modules.map((module) => (
                <span
                  key={`${location.id}:${module.label}`}
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    module.label === "M01"
                      ? "border border-[rgba(0,97,255,0.16)] bg-[rgba(0,97,255,0.08)] text-[var(--info)]"
                      : module.label === "M02"
                        ? "border border-[rgba(255,152,0,0.24)] bg-[rgba(255,152,0,0.12)] text-[#B86A00]"
                        : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)]"
                  }`}
                >
                  {module.label} • {module.score}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Workflow Status
              </div>
              <span
                className={`rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.12em] ${
                  workflow.readyForCertification
                    ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                    : "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                }`}
              >
                {workflow.readyForCertification ? "Ready" : workflow.primaryLabel}
              </span>
            </div>
            <div className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {workflow.readyForCertification
                ? "This location is ready for its next certification cycle."
                : workflow.blockers[0] ?? "This location still needs setup before the next certification cycle."}
            </div>
            {uploadLockedByVault ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm leading-7 text-[var(--muted)]">
                <span className="font-semibold text-[var(--text)]">Upload Data is locked.</span> Seal the governed vault
                for the active module/vendor before uploading certification evidence.
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {uploadLockedByVault ? (
                <button
                  type="button"
                  onClick={openSealVaultWorkflow}
                  className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Seal Vault
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenUploads(location.id)}
                disabled={uploadLockedByVault}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  uploadLockedByVault
                    ? "cursor-not-allowed bg-[var(--panel-soft)] text-[var(--muted)]"
                    : "bg-[var(--text)] text-white hover:bg-[var(--accent)]"
                }`}
              >
                Open Upload Data
              </button>
              <button
                type="button"
                onClick={() => onRunCertification(location.id)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
              >
                Run Certification
              </button>
              <button
                type="button"
                onClick={() => onOpenOnboarding(location.id)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
              >
                Open Onboarding
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-t border-[var(--border)] px-6 py-3">
          <WorkspaceTab active={tab === "dashboard"} label="Dashboard" onClick={() => setTab("dashboard")} />
          <WorkspaceTab active={tab === "caars"} label="CAARs" onClick={() => setTab("caars")} />
          <WorkspaceTab active={tab === "vault"} label="Vault" onClick={() => setTab("vault")} />
        </div>
      </SectionCard>

      {tab === "dashboard" ? (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <MetricCard label="Recovery" value={formatRecoveryDisplay(location.recovery)} />
            <MetricCard label="IUM" value={location.ium} />
            <MetricCard label="Saved CAARs" value={String(locationCaars.length)} />
            <MetricCard
              label="Vault Workspaces"
              value={String(locationWorkspaces.length)}
              help="Governed schema / contract workspaces linked to this location."
            />
          </div>

          <SectionCard>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                    Active Sources
                  </div>
                  <HelpTip
                    title="Location / Active Sources"
                    sections={[
                      {
                        label: "What It Is",
                        text: "The card processor and delivery platforms configured for this restaurant.",
                      },
                      {
                        label: "What It Controls",
                        text: "Only these sources appear in Upload Data, DIY Access, Vault setup, and certification workflows for this location.",
                      },
                      {
                        label: "Where To Change It",
                        text: "Change sources from this location dashboard so Upload Data remains focused on evidence upload only.",
                      },
                    ]}
                  />
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  Source configuration is location-scoped and reused by Upload Data, Vault, and CAAR runs.
                </div>
              </div>
              {canManageSources && locationSourceConfig ? (
                <button
                  type="button"
                  onClick={() => setShowManageSources(true)}
                  className="rounded-xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                >
                  Manage Sources
                </button>
              ) : null}
            </div>
            {locationSourceConfig ? (
              <div className="grid gap-4 md:grid-cols-2">
                <SourceSummaryCard
                  enabled={locationSourceConfig.m01Enabled}
                  label="M01 Card Processor"
                  sources={locationSourceConfig.m01Vendors.map((vendor) => vendor.name)}
                />
                <SourceSummaryCard
                  enabled={locationSourceConfig.m02Enabled}
                  label="M02 Delivery Platforms"
                  sources={locationSourceConfig.m02Vendors.map((vendor) => vendor.name)}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] p-5 text-sm leading-7 text-[var(--text)]">
                No source configuration is saved for this location yet. Configure active sources here before uploading evidence.
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <div className="mb-4 flex items-center gap-2">
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                Module Status
              </div>
              <HelpTip
                title="Location / Module Status"
                sections={[
                  {
                    label: "What It Is",
                    text: "Per-module operational state for this location only.",
                  },
                  {
                    label: "What It Does",
                    text: "Shows which modules are active, their current trust score, and the operator note stored with the location.",
                  },
                  {
                    label: "Why It Matters",
                    text: "M01 and M02 must be operated independently even when both are enabled for the same restaurant.",
                  },
                ]}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {location.modules.map((module) => (
                <div key={`${location.id}:workspace:${module.label}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-[var(--text)]">{module.label}</div>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[var(--text)]">
                      {module.score}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{module.note}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              Workflow Requirements
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {workflow.requirements.map((requirement) => (
                <div key={`${location.id}:${requirement.key}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-[var(--text)]">{requirement.label}</div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        requirement.status === "complete"
                          ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]"
                          : requirement.status === "action_required"
                            ? "bg-[rgba(214,48,49,0.08)] text-[var(--accent)]"
                            : "bg-[var(--panel-soft)] text-[var(--muted)]"
                      }`}
                    >
                      {requirement.status === "complete"
                        ? "Complete"
                        : requirement.status === "action_required"
                          ? "Action Required"
                          : "N/A"}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{requirement.detail}</div>
                </div>
              ))}
            </div>
            {workflow.blockers.length > 0 ? (
              <div className="mt-4 space-y-2">
                {workflow.blockers.map((blocker, index) => (
                  <div
                    key={`${location.id}:blocker:${index}`}
                    className="rounded-xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-3 text-sm text-[var(--text)]"
                  >
                    {blocker}
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

      {tab === "caars" ? (
        <SectionCard>
          <div className="mb-4 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
            CAARs for {location.name}
          </div>
          {locationCaars.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
              No CAAR has been generated for this location yet.
            </div>
          ) : (
            <div className="space-y-3">
              {locationCaars.map((record) => (
                <button
                  key={`${record.locationId}:${record.id}`}
                  type="button"
                  onClick={() => onOpenCaar(record)}
                  className="grid w-full gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--text)] md:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr]"
                >
                  <div>
                    <div className="font-semibold text-[var(--text)]">{record.id}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{record.period}</div>
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Module
                    </div>
                    <div className="mt-2 text-sm text-[var(--text)]">{record.traceability?.module ?? "Mixed"}</div>
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Trust Score
                    </div>
                    <div className="mt-2 text-sm text-[var(--text)]">{record.trustScore}</div>
                  </div>
                  <div>
                    <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Recovery
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--text)]">{record.amount}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {tab === "vault" ? (
        <SectionCard>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                Vault for {location.name}
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                Governed schema, contract configuration, and sealing workflow scoped to this location.
              </div>
            </div>
          </div>
          {locationWorkspaces.length === 0 && missingWorkspaceTargets.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
                No vault workspace exists for this location yet. Initialize the module workspace you want to govern.
              </div>
              <div className="flex flex-wrap gap-2">
                {location.modules
                  .filter((module) => module.label === "M01" || module.label === "M02")
                  .map((module) => (
                    <button
                      key={`${location.id}:init:${module.label}`}
                      type="button"
                      onClick={() =>
                        onInitializeWorkspace(
                          location.id,
                          module.label as "M01" | "M02",
                          defaultVendorByModule[module.label as "M01" | "M02"],
                        )
                      }
                      className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                    >
                      Initialize {module.label} Vault
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {locationWorkspaces.map((workspace) => (
                <div key={`${workspace.accountId}:${workspace.locationId}:${workspace.module}:${workspace.vendor}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[var(--text)]">
                        {workspace.module} • {workspace.vendor}
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {workspace.vault.state === "sealed" ? "Sealed vault workspace" : "Draft vault workspace"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEditWorkspace(workspace)}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                      >
                        Open Vault
                      </button>
                      {(role === "SuperAdmin" || role === "WGS Manager") && (
                        <button
                          type="button"
                          onClick={() => onSealWorkspace(workspace)}
                          className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                        >
                          Seal Contract Config
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <MetricCard label="Verified Fields" value={String(workspace.fields.filter((field) => field.confidence === "Verified").length)} />
                    <MetricCard label="Needs Review" value={String(workspace.fields.filter((field) => field.confidence === "Needs Review").length)} />
                    <MetricCard label="Missing Fields" value={String(workspace.fields.filter((field) => field.confidence === "Missing").length)} />
                    <MetricCard label="Vault Version" value={workspace.vault.version} />
                  </div>
                </div>
              ))}
              {missingWorkspaceTargets.map((target) => (
                <div
                  key={`${location.id}:missing:${target.module}:${target.vendor.key}`}
                  className="rounded-2xl border border-dashed border-[rgba(214,48,49,0.35)] bg-[rgba(214,48,49,0.035)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[var(--text)]">
                        {target.module} &bull; {target.vendor.name}
                      </div>
                      <div className="mt-1 text-sm text-[var(--accent)]">
                        Active source, but its vault workspace has not been initialized.
                      </div>
                      <div className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                        Initialize and seal this vendor-specific workspace before uploading evidence
                        or running a {target.module} certification for {target.vendor.name}.
                      </div>
                    </div>
                    {canManageSources ? (
                      <button
                        type="button"
                        onClick={() =>
                          onInitializeWorkspace(location.id, target.module, target.vendor.name)
                        }
                        className="rounded-lg bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                      >
                        Initialize {target.vendor.name} Vault
                      </button>
                    ) : (
                      <div className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--muted)]">
                        Contact a WGS Manager or SuperAdmin to initialize this vault.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {showManageSources && locationSourceConfig ? (
        <LocationSourceSettingsModal
          initialConfig={locationSourceConfig}
          locationName={location.name}
          onClose={() => setShowManageSources(false)}
          onSave={async (next) => {
            await onManageSources(next);
            setShowManageSources(false);
          }}
        />
      ) : null}
    </div>
  );
}

function WorkspaceTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm transition ${
        active ? "bg-[var(--text)] font-semibold text-white" : "border border-[var(--border)] text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  help,
  label,
  value,
}: {
  help?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
          {label}
        </div>
        {help ? (
          <HelpTip
            title={label}
            sections={[
              {
                label: "What It Is",
                text: help,
              },
            ]}
          />
        ) : null}
      </div>
      <div className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em] text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

function SourceSummaryCard({
  enabled,
  label,
  sources,
}: {
  enabled: boolean;
  label: string;
  sources: string[];
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-[var(--text)]">{label}</div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
            enabled ? "bg-[rgba(0,200,83,0.08)] text-[var(--success)]" : "bg-[var(--panel-soft)] text-[var(--muted)]"
          }`}
        >
          {enabled ? "Active" : "Off"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {enabled && sources.length > 0 ? (
          sources.map((source) => (
            <span
              key={source}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--text)]"
            >
              {source}
            </span>
          ))
        ) : (
          <span className="text-sm text-[var(--muted)]">No active source selected.</span>
        )}
      </div>
    </div>
  );
}

function formatRecoveryDisplay(value: string) {
  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? formatCurrency(numeric) : value;
}
