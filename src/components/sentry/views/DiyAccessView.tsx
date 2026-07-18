"use client";

import { useMemo, useState } from "react";
import { wgsM01Vendors, wgsM02Vendors } from "../data";
import type { LocationRecord, LocationSourceConfig, Role, SchemaWorkspace } from "../types";
import { Badge, HelpTip, MetaBlock, SectionCard } from "../ui/primitives";
import { UserGuideView } from "./UserGuideView";

type DiyTab = "m01" | "m02" | "guide";
type RegistryTab = "mappings" | "missing" | "contract" | "vault";

export function DiyAccessView({
  locations,
  locationSourceConfigs,
  onEditWorkspace,
  onInitializeWorkspace,
  onSealWorkspace,
  role,
  workspaces,
}: {
  locations: LocationRecord[];
  locationSourceConfigs: Record<string, LocationSourceConfig>;
  onEditWorkspace: (workspace: SchemaWorkspace) => void;
  onInitializeWorkspace: (locationId: string, module: "M01" | "M02", vendor?: string) => void;
  onSealWorkspace: (workspace: SchemaWorkspace) => void | Promise<void>;
  role: Role;
  workspaces: SchemaWorkspace[];
}) {
  const [tab, setTab] = useState<DiyTab>("m01");
  const [m01Panel, setM01Panel] = useState<RegistryTab>("mappings");
  const [m02Panel, setM02Panel] = useState<RegistryTab>("mappings");
  const unlocked = role === "Admin" || role === "SuperAdmin" || role === "WGS Manager";
  const canSeal = role === "SuperAdmin" || role === "WGS Manager";
  const dbWorkspaces = useMemo(
    () => dedupeWorkspaces(workspaces.filter((workspace) => Boolean(workspace.locationId))),
    [workspaces],
  );

  const m01Workspaces = useMemo(
    () => dbWorkspaces.filter((workspace) => workspace.module === "M01"),
    [dbWorkspaces],
  );
  const m02Workspaces = useMemo(
    () => dbWorkspaces.filter((workspace) => workspace.module === "M02"),
    [dbWorkspaces],
  );
  const m01Locations = useMemo(
    () => locations.filter((location) => locationSourceConfigs[location.id]?.m01Enabled),
    [locationSourceConfigs, locations],
  );
  const m02Locations = useMemo(
    () => locations.filter((location) => locationSourceConfigs[location.id]?.m02Enabled),
    [locationSourceConfigs, locations],
  );

  const [m01LocationId, setM01LocationId] = useState("");
  const [m02LocationId, setM02LocationId] = useState("");
  const [m01Vendor, setM01Vendor] = useState("");
  const [m02Vendor, setM02Vendor] = useState("");

  const selectedM01LocationId =
    (m01LocationId && m01Locations.some((location) => location.id === m01LocationId) ? m01LocationId : "") ||
    m01Workspaces[0]?.locationId ||
    m01Locations[0]?.id ||
    "";
  const selectedM02LocationId =
    (m02LocationId && m02Locations.some((location) => location.id === m02LocationId) ? m02LocationId : "") ||
    m02Workspaces[0]?.locationId ||
    m02Locations[0]?.id ||
    "";

  const m01LocationWorkspaces = useMemo(
    () => m01Workspaces.filter((workspace) => workspace.locationId === selectedM01LocationId),
    [m01Workspaces, selectedM01LocationId],
  );
  const m02LocationWorkspaces = useMemo(
    () => m02Workspaces.filter((workspace) => workspace.locationId === selectedM02LocationId),
    [m02Workspaces, selectedM02LocationId],
  );

  const activeM01 =
    m01LocationWorkspaces.find((workspace) => workspace.vendor === m01Vendor) ?? m01LocationWorkspaces[0] ?? null;
  const activeM02 =
    m02LocationWorkspaces.find((workspace) => workspace.vendor === m02Vendor) ?? m02LocationWorkspaces[0] ?? null;

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionCard className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.08)] text-3xl text-[var(--accent)]">
            🔒
          </div>
          <div className="mt-5 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
            DIY Access is locked
          </div>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            DIY Access grants you direct access to the M01 and M02 Schema Registry pages and unlocks the User Guide.
            It requires written approval and a completed training session with your FohBoh WGS Manager before
            activation.
          </p>
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left">
            <div className="mb-4 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Requirements to Unlock
            </div>
            <div className="space-y-3">
              {[
                ["1", "WGS Manager approval", "Your account must be reviewed and approved by a FohBoh WGS Manager."],
                [
                  "2",
                  "Schema training session",
                  "Complete a 60-minute training on M01 and M02 schema structure and field validation rules.",
                ],
                [
                  "3",
                  "Signed DIY acknowledgment",
                  "Confirms you understand that schema edits affect live certification accuracy.",
                ],
              ].map(([step, title, body]) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[10px] font-bold text-[var(--accent)]">
                    {step}
                  </span>
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--text)]">{title}</div>
                    <div className="text-[12px] text-[var(--muted)]">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              DIY Access
            </div>
            <HelpTip
              title="Sidebar / Advanced"
              sections={[
                {
                  label: "What It Is",
                  text: "Direct access to the Schema Registry column mapping editor and Contract Config for approved locations.",
                },
                {
                  label: "What It Does",
                  text: "Allows trained operators to review mappings, missing fields, contract truth, and sealed vault state without routing every inspection through WGS.",
                },
                {
                  label: "Why It Matters",
                  text: "Incorrect schema edits systematically distort every certified figure for the entire period.",
                },
              ]}
              footerLabel="Approval Required"
              footerValue="WGS Advisor sign-off"
            />
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Schema Registry editor and User Guide for approved self-service teams.
          </div>
        </div>
        <span className="rounded-full border border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.08)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--success)]">
          Approved & Trained
        </span>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        <DiyTabButton active={tab === "m01"} label="M01 Schema Registry" onClick={() => setTab("m01")} />
        <DiyTabButton active={tab === "m02"} label="M02 Schema Registry" onClick={() => setTab("m02")} />
        <DiyTabButton active={tab === "guide"} label="User Guide" onClick={() => setTab("guide")} />
      </div>

      {tab === "guide" ? <UserGuideView /> : null}
      {tab === "m01" && activeM01 ? (
        <RegistryWorkspacePanel
          canSeal={canSeal}
          locations={m01Locations}
          selectedLocationId={selectedM01LocationId}
          workspace={activeM01}
          workspaces={m01LocationWorkspaces}
          activePanel={m01Panel}
          onChangePanel={setM01Panel}
          onChangeLocation={(locationId) => {
            setM01LocationId(locationId);
            setM01Panel("mappings");
          }}
          onChangeVendor={(vendor) => {
            setM01Vendor(vendor);
            setM01Panel("mappings");
          }}
          onEditWorkspace={onEditWorkspace}
          onSealWorkspace={onSealWorkspace}
        />
      ) : null}
      {tab === "m01" && !activeM01 ? (
        <EmptyWorkspaceState
          canSeal={canSeal}
          locations={m01Locations}
          locationSourceConfigs={locationSourceConfigs}
          module="M01"
          onEditWorkspace={onEditWorkspace}
          onInitializeWorkspace={onInitializeWorkspace}
          onSealWorkspace={onSealWorkspace}
          workspaces={m01Workspaces}
        />
      ) : null}
      {tab === "m02" && activeM02 ? (
        <RegistryWorkspacePanel
          canSeal={canSeal}
          locations={m02Locations}
          selectedLocationId={selectedM02LocationId}
          workspace={activeM02}
          workspaces={m02LocationWorkspaces}
          activePanel={m02Panel}
          onChangePanel={setM02Panel}
          onChangeLocation={(locationId) => {
            setM02LocationId(locationId);
            setM02Panel("mappings");
          }}
          onChangeVendor={(vendor) => {
            setM02Vendor(vendor);
            setM02Panel("mappings");
          }}
          onEditWorkspace={onEditWorkspace}
          onSealWorkspace={onSealWorkspace}
        />
      ) : null}
      {tab === "m02" && !activeM02 ? (
        <EmptyWorkspaceState
          canSeal={canSeal}
          locations={m02Locations}
          locationSourceConfigs={locationSourceConfigs}
          module="M02"
          onEditWorkspace={onEditWorkspace}
          onInitializeWorkspace={onInitializeWorkspace}
          onSealWorkspace={onSealWorkspace}
          workspaces={m02Workspaces}
        />
      ) : null}
    </div>
  );
}

function EmptyWorkspaceState({
  canSeal,
  locations,
  locationSourceConfigs,
  module,
  onEditWorkspace,
  onInitializeWorkspace,
  onSealWorkspace,
  workspaces,
}: {
  canSeal: boolean;
  locations: LocationRecord[];
  locationSourceConfigs: Record<string, LocationSourceConfig>;
  module: "M01" | "M02";
  onEditWorkspace: (workspace: SchemaWorkspace) => void;
  onInitializeWorkspace: (locationId: string, module: "M01" | "M02", vendor?: string) => void;
  onSealWorkspace: (workspace: SchemaWorkspace) => void | Promise<void>;
  workspaces: SchemaWorkspace[];
}) {
  const vendorCatalog = module === "M01" ? wgsM01Vendors : wgsM02Vendors;
  const moduleEnabledKey = module === "M01" ? "m01Enabled" : "m02Enabled";
  const moduleVendorsKey = module === "M01" ? "m01Vendors" : "m02Vendors";
  const eligibleLocations = locations.filter((location) => locationSourceConfigs[location.id]?.[moduleEnabledKey]);

  return (
    <SectionCard className="space-y-5">
      <div>
        <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
          {module} governance workspaces
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
          Every location must maintain persisted Schema Registry and Contract Config records before certification can run.
          Initialize the required vendor workspaces, continue draft governance work, or open sealed vault-backed records below.
        </p>
      </div>

      {eligibleLocations.length > 0 ? (
        <div className="grid gap-4">
          {eligibleLocations.map((location) => {
            const locationWorkspaces = workspaces.filter((workspace) => workspace.locationId === location.id);
            const selectedVendorNames = (locationSourceConfigs[location.id]?.[moduleVendorsKey] ?? []).map(
              (vendor) => vendor.name,
            );
            const vendorOptions = vendorCatalog.filter((vendor) => selectedVendorNames.includes(vendor.name));
            const sealedCount = locationWorkspaces.filter((workspace) => getWorkspaceStatus(workspace) === "sealed").length;
            const draftCount = locationWorkspaces.filter((workspace) => getWorkspaceStatus(workspace) === "draft").length;
            const stateTone = sealedCount > 0 ? "success" : draftCount > 0 ? "warning" : "danger";
            const stateLabel =
              sealedCount > 0
                ? `${sealedCount} sealed${draftCount > 0 ? ` · ${draftCount} draft` : ""}`
                : draftCount > 0
                  ? `${draftCount} draft`
                  : "Uninitialized";

            return (
              <div
                key={`${module}:${location.id}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-[var(--text)]">{location.name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {location.id} | {location.market}
                    </div>
                  </div>
                  <Badge tone={stateTone}>{stateLabel}</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {vendorOptions.length > 0 ? (
                    vendorOptions.map((vendor) => {
                    const workspace = locationWorkspaces.find((item) => item.vendor === vendor.name) ?? null;
                    const status = workspace ? getWorkspaceStatus(workspace) : null;

                    return (
                      <div
                        key={`${location.id}:${module}:${vendor.name}`}
                        className="rounded-xl border border-[var(--border)] bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-[var(--text)]">{vendor.name}</div>
                          {status ? (
                            <Badge tone={status === "sealed" ? "success" : "warning"}>
                              {status === "sealed" ? "Sealed" : "Draft"}
                            </Badge>
                          ) : (
                            <Badge tone="danger">Missing</Badge>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {workspace ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditWorkspace(workspace)}
                                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                              >
                                {status === "sealed" ? "Open Workspace" : "Continue Draft"}
                              </button>
                              {status !== "sealed" && canSeal ? (
                                <button
                                  type="button"
                                  onClick={() => onSealWorkspace(workspace)}
                                  className="rounded-full bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                                >
                                  Seal Vault
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onInitializeWorkspace(location.id, module, vendor.name)}
                              className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
                            >
                              Initialize {vendor.name}
                            </button>
                          )}
                        </div>
                        <div className="mt-3 text-xs leading-5 text-[var(--muted)]">
                          {workspace
                            ? status === "sealed"
                              ? "Governance is sealed for this vendor and location."
                              : "Draft governance exists. Review mappings and seal when complete."
                            : `No persisted governance workspace exists yet for ${vendor.name} at this location.`}
                        </div>
                        {!canSeal && status !== "sealed" ? (
                          <div className="mt-3 text-xs leading-5 text-[var(--muted)]">
                            WGS must perform the final seal after review. Admin can prepare and save the draft workspace only.
                          </div>
                        ) : null}
                      </div>
                    );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)] md:col-span-2">
                      No {module} vendor is selected for this location yet. Configure the location source settings first,
                      then return to DIY Access to initialize and seal the schema workspace for the chosen vendor.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          No location currently has {module} enabled. Add a location or enable the module in that location&apos;s source
          settings first.
        </div>
      )}
    </SectionCard>
  );
}

function RegistryWorkspacePanel({
  activePanel,
  canSeal,
  locations,
  onChangePanel,
  onChangeLocation,
  onChangeVendor,
  onEditWorkspace,
  onSealWorkspace,
  selectedLocationId,
  workspace,
  workspaces,
}: {
  activePanel: RegistryTab;
  canSeal: boolean;
  locations: LocationRecord[];
  onChangePanel: (panel: RegistryTab) => void;
  onChangeLocation: (locationId: string) => void;
  onChangeVendor: (vendor: string) => void;
  onEditWorkspace: (workspace: SchemaWorkspace) => void;
  onSealWorkspace: (workspace: SchemaWorkspace) => void | Promise<void>;
  selectedLocationId: string;
  workspace: SchemaWorkspace;
  workspaces: SchemaWorkspace[];
}) {
  const requiredFields = workspace.fields.filter((field) => field.required);
  const missingFields = workspace.fields.filter((field) => field.confidence === "Missing");
  const reviewFields = workspace.fields.filter((field) => field.confidence === "Needs Review");
  const commissionBase = requiredFields[0]?.source ?? workspace.fields[0]?.source ?? "source column";
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const uniqueVendors = [...new Set(workspaces.map((item) => item.vendor))];
  const vendorLabel = workspace.module === "M01" ? "Processor" : "DSP";
  const sourceDocumentLabel =
    workspace.module === "M01"
      ? `${workspace.vendor} processor statement upload (CSV, or processor PDF where supported)`
      : `${workspace.vendor} settlement upload (CSV)`;

  return (
    <SectionCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-[var(--text)]">
            {workspace.module} - {workspace.module === "M01" ? "Merchant Fee Recovery Schema" : "Delivery Fee Recovery Schema"}
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">
            {workspace.module === "M01"
              ? "Card processor column mapping | Contract Config | Sealed by WGS Manager"
              : "DSP column mapping | Contract Config | Sealed by WGS Manager"}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {workspace.locationName ?? workspace.locationId ?? "Location workspace"}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {locations.length > 1 ? (
            <label className="min-w-[220px]">
              <div className="mb-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Location
              </div>
              <select
                value={selectedLocationId}
                onChange={(event) => onChangeLocation(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
              >
                {locations.map((location) => (
                  <option key={`${workspace.module}:location:${location.id}`} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {uniqueVendors.length > 1 ? (
            <label className="min-w-[180px]">
              <div className="mb-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Vendor
              </div>
              <select
                value={workspace.vendor}
                onChange={(event) => onChangeVendor(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
              >
                {uniqueVendors.map((vendor) => (
                  <option key={`${workspace.module}:${selectedLocationId}:${vendor}`} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {locations.length <= 1 && uniqueVendors.length <= 1 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Active Workspace
              </div>
              <div className="mt-1 text-sm text-[var(--text)]">
                <span className="font-medium">{selectedLocation?.name ?? "Unknown location"}</span>
                <span className="mx-2 text-[var(--border)]">•</span>
                <span>
                  {vendorLabel}: {workspace.vendor}
                </span>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => downloadWorkspaceTemplate(workspace)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            CSV Template
          </button>
          <button
            type="button"
            onClick={() => onEditWorkspace(workspace)}
            className="rounded-lg bg-[rgba(214,48,49,0.08)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[rgba(214,48,49,0.14)]"
          >
            Edit Schema
          </button>
          {!canSeal ? (
            <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
              WGS seal required
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(214,48,49,0.16)] bg-[rgba(214,48,49,0.06)] px-4 py-4">
        <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Commission Base Field
        </div>
        <div className="mt-2 text-sm leading-7 text-[var(--muted)]">
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--accent)]">
            Expected Fee = [{commissionBase}] x (contracted_rate / 100)
          </span>{" "}
          - {workspace.contract[0]?.source ?? "Active sealed configuration drives deterministic fee reconstruction."}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-4">
        {(["mappings", "missing", "contract", "vault"] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => onChangePanel(panel)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              activePanel === panel
                ? "border-[var(--text)] bg-[var(--text)] text-white"
                : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
            }`}
          >
            {panel === "mappings"
              ? "Source Column Mapping"
              : panel === "missing"
                ? "Unmapped / Missing Source Fields"
                : panel === "contract"
                  ? "Contract Terms Used by Engine"
                  : "Sealed Vault Record"}
          </button>
        ))}
      </div>

      {activePanel === "mappings" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            This panel shows how columns from the{" "}
            <span className="font-medium text-[var(--text)]">{sourceDocumentLabel}</span> are mapped into FohBoh&apos;s
            canonical recovery fields for <span className="font-medium text-[var(--text)]">{workspace.module}</span>.
            The left side is the field the engine needs. The middle value is the exact native column header currently
            bound to it.
          </div>
          {workspace.fields.map((field) => (
            <div
              key={field.canonical}
              className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[1fr_1fr_140px]"
            >
              <div>
                <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                  <span>Engine field: {field.canonical}</span>
                  <HelpTip
                    title={`Column Mapping · ${field.canonical}`}
                    sections={[
                      {
                        label: "What It Is",
                        text: getCanonicalFieldMeaning(field.canonical, workspace.module),
                      },
                      {
                        label: "How It Is Used",
                        text: getCanonicalFieldUsage(field.canonical, workspace.module),
                      },
                      {
                        label: "Source Requirement",
                        text: field.required
                          ? `This is a required engine field. The certification flow cannot rely on this workspace unless a trustworthy source header is bound to it.`
                          : `This is an optional engine field. It improves audit precision and narrative support when present, but it is not always required to release the module.`,
                      },
                    ]}
                    footerLabel="Document"
                    footerValue={sourceDocumentLabel}
                  />
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {field.required ? "Required canonical field" : "Optional canonical field"}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-sm text-[var(--info)]">
                  <span>{field.source}</span>
                  <HelpTip
                    title={`Mapped Source Header · ${field.source}`}
                    sections={[
                      {
                        label: "What It Is",
                        text: `This is the exact native column header currently bound from the ${sourceDocumentLabel}. It is the raw header name the uploader/parser matched in the vendor file.`,
                      },
                      {
                        label: "How It Is Used",
                        text: `During certification, rows from this native source header are normalized into ${field.canonical} so the engine can apply sealed contract terms, trust gates, and deterministic rule checks.`,
                      },
                      {
                        label: "When To Change It",
                        text: `Change this mapping only if the vendor export changed header names or the wrong source column was bound. Any mapping change should be reviewed before the next seal.`,
                      },
                    ]}
                    footerLabel="Bound To"
                    footerValue={field.canonical}
                  />
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Mapped native column header from the {sourceDocumentLabel}
                </div>
              </div>
              <div className="md:text-right">
                <Badge
                  tone={
                    field.confidence === "Verified"
                      ? "success"
                      : field.confidence === "Needs Review"
                        ? "warning"
                        : "danger"
                  }
                >
                  {field.confidence}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activePanel === "missing" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            This panel shows which fields from the{" "}
            <span className="font-medium text-[var(--text)]">{sourceDocumentLabel}</span> are still unresolved for this
            workspace. If a required engine field has no trustworthy source column from that document, certification
            should stay blocked.
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Missing Fields" value={String(missingFields.length)} tone="danger" />
            <MetricCard label="Needs Review" value={String(reviewFields.length)} tone="warning" />
            <MetricCard label="Required Fields" value={String(requiredFields.length)} tone="success" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
            {missingFields.length > 0
              ? "Fields missing from the native export must be resolved before certification. This is the fastest place to see what still blocks D1 and D5."
              : "No canonical fields are currently marked missing. Review items may still require WGS confirmation before the next seal."}
          </div>
          <div className="space-y-3">
            {workspace.fields
              .filter((field) => field.confidence !== "Verified")
              .map((field) => (
                <div key={field.canonical} className="rounded-xl border border-[var(--border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-[var(--text)]">Engine field: {field.canonical}</div>
                    <Badge tone={field.confidence === "Missing" ? "danger" : "warning"}>{field.confidence}</Badge>
                  </div>
                  <div className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                    Current source column: {field.source}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {activePanel === "contract" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            These are the contract terms currently used by the engine when reconstructing expected fees and calculating
            recoverable variance for <span className="font-medium text-[var(--text)]">{workspace.vendor}</span>.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {workspace.contract.map((field) => (
              <div key={field.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {field.label}
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--text)]">{field.value}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">Source: {field.source}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEditWorkspace(workspace)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
            >
              Edit Schema
            </button>
            {canSeal ? (
              <button
                type="button"
                onClick={() => onSealWorkspace(workspace)}
                className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                Seal Contract Config
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {activePanel === "vault" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            This is the sealed governance record for this workspace. It is the immutable version of the mapping and
            contract state used as evidentiary truth during certification.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <MetaBlock label="Version" value={workspace.vault.version} />
            <MetaBlock label="Hash" value={workspace.vault.hash} />
            <MetaBlock label="Sealed By" value={workspace.vault.sealedBy} />
            <MetaBlock label="Sealed At" value={workspace.vault.sealedAt} />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
            The Vault Record is the sealed, SHA-256-hashed version of this Schema Registry entry. It is the immutable
            proof of what schema state was used during certification.
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "success" | "warning";
  value: string;
}) {
  const toneClass = {
    danger: "text-[var(--accent)]",
    success: "text-[var(--success)]",
    warning: "text-[#b86a00]",
  }[tone];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[-0.05em] ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function DiyTabButton({
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
      className={`rounded-t-xl px-4 py-3 text-sm transition ${
        active
          ? "border border-b-white border-[var(--border)] bg-white font-semibold text-[var(--text)]"
          : "text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </button>
  );
}

function downloadWorkspaceTemplate(workspace: SchemaWorkspace) {
  if (typeof window === "undefined") return;
  const headers = workspace.fields.map((field) => field.source).join(",");
  const blob = new Blob([`${headers}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `FohBoh_${workspace.module}_${workspace.vendor.replace(/\s+/g, "_")}_Template.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getCanonicalFieldMeaning(field: string, module: "M01" | "M02") {
  const normalized = field.toLowerCase();

  if (normalized === "gross_sales_amount") {
    return module === "M01"
      ? "The total card sales base the M01 engine uses to reconstruct what processor fees should have been under the sealed merchant agreement."
      : "The total sales base used to compare the DSP settlement or payout against POS-side merchant sales for M02 reconciliation.";
  }

  if (normalized === "processor_markup_bps") {
    return "The processor markup expressed in basis points. One basis point equals 0.01%, so this field captures the variable markup rate charged on processed volume.";
  }

  if (normalized === "network_fee_amount") {
    return "The network or pass-through fee amount surfaced by the source export. It helps separate true processor markup from card-network or third-party pass-through charges.";
  }

  if (normalized.includes("date")) {
    return "A source timing field used to determine certification period coverage, settlement timing, freshness, and reconciliation windows.";
  }

  if (normalized.includes("fee")) {
    return "A source fee field used to reconstruct observed charges and compare them to the sealed contract truth for recovery testing.";
  }

  if (normalized.includes("sales") || normalized.includes("amount")) {
    return "A monetary source field used as part of the governed transaction or payout basis for deterministic certification calculations.";
  }

  return "A canonical engine field in FohBoh's governed schema. It represents a normalized value the certification engine needs from the uploaded source document.";
}

function getCanonicalFieldUsage(field: string, module: "M01" | "M02") {
  const normalized = field.toLowerCase();

  if (normalized === "gross_sales_amount") {
    return module === "M01"
      ? "The engine uses this field to calculate expected processor fees from sealed contract terms, compare them to observed statement charges, and quantify recoverable M01 variance."
      : "The engine uses this field to tie DSP-side data back to POS-side revenue, detect basis mismatches, and score cross-system reconciliation for M02.";
  }

  if (normalized === "processor_markup_bps") {
    return "The engine uses this mapped value when checking markup drift, pricing compliance, and fee legitimacy against the sealed contract configuration.";
  }

  if (normalized === "network_fee_amount") {
    return "The engine uses this value to distinguish legitimate network/pass-through charges from recoverable processor overcharges and to strengthen audit traceability.";
  }

  if (normalized.includes("date")) {
    return "The engine uses this field to verify that the upload belongs to the correct certification period and to detect timing gaps or delayed settlement behavior.";
  }

  if (normalized.includes("fee")) {
    return "The engine uses this field in fee reconstruction, variance testing, and rule checks that determine whether charges are legitimate, excessive, duplicated, or unsupported.";
  }

  if (normalized.includes("sales") || normalized.includes("amount")) {
    return "The engine uses this value as a monetary input in trust-gate scoring, reconciliation checks, and deterministic rule evaluation for the active module.";
  }

  return "The engine normalizes this field from the native upload into a governed value, then reuses it in trust gates, reconciliation logic, and deterministic certification rules.";
}

function buildWorkspaceIdentity(workspace: SchemaWorkspace) {
  return [
    workspace.accountId,
    workspace.locationId ?? "global",
    workspace.vendor,
    workspace.module,
  ].join(":");
}

function dedupeWorkspaces(workspaces: SchemaWorkspace[]) {
  const unique = new Map<string, SchemaWorkspace>();

  for (const workspace of workspaces) {
    unique.set(buildWorkspaceIdentity(workspace), workspace);
  }

  return [...unique.values()];
}

function getWorkspaceStatus(workspace: SchemaWorkspace): "draft" | "sealed" {
  if (workspace.status === "sealed" || workspace.vault.state === "sealed") {
    return "sealed";
  }

  return "draft";
}
