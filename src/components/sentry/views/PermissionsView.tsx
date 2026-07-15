"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PermissionRecord,
  TeamAccessPayload,
  TeamAccessScope,
  TeamInviteRecord,
  TeamLocationOption,
  TeamMemberRecord,
  TeamRole,
} from "../types";
import { HelpTip, SectionCard } from "../ui/primitives";

const TEAM_ROLES: TeamRole[] = ["Owner", "Finance", "Location Manager", "Read-only"];

type TeamModalState =
  | {
      accessScope: TeamAccessScope;
      email: string;
      mode: "invite";
      restaurantIds: number[];
      role: TeamRole;
    }
  | {
      accessScope: TeamAccessScope;
      email: string;
      id: number;
      mode: "edit-invite" | "edit-member";
      restaurantIds: number[];
      role: TeamRole;
    };

function formatRelativeDate(value: string | null) {
  if (!value) return "Not yet active";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function roleTone(role: TeamRole) {
  if (role === "Owner") return "bg-[rgba(0,97,255,0.08)] text-[var(--info)]";
  if (role === "Finance") return "bg-[rgba(0,200,83,0.08)] text-[var(--success)]";
  if (role === "Location Manager") return "bg-[rgba(255,152,0,0.12)] text-[#b86a00]";
  return "bg-[var(--panel-soft)] text-[var(--muted)]";
}

function statusTone(status: "active" | "revoked" | "pending" | "cancelled" | "accepted") {
  if (status === "active" || status === "accepted") return "text-[#0f8f62]";
  if (status === "pending") return "text-[#b86a00]";
  return "text-[var(--accent)]";
}

function buildScopeLabel(accessScope: TeamAccessScope, locations: TeamLocationOption[]) {
  if (accessScope === "all_locations") {
    return "All locations";
  }

  if (locations.length === 0) {
    return "No assigned locations";
  }

  if (locations.length === 1) {
    return `${locations[0].label} ${locations[0].name} only`;
  }

  return `${locations.length} selected locations`;
}

function TeamModal({
  locations,
  onClose,
  onSubmit,
  saving,
  state,
}: {
  locations: TeamLocationOption[];
  onClose: () => void;
  onSubmit: (state: TeamModalState) => Promise<void>;
  saving: boolean;
  state: TeamModalState;
}) {
  const [form, setForm] = useState<TeamModalState>(state);
  const isLocationManager = form.role === "Location Manager";

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(18,22,31,0.55)] px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[28px] border border-[var(--border)] bg-white shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
        <div className="border-b border-[var(--border)] bg-[var(--text)] px-6 py-5 text-white">
          <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.04em]">
            {form.mode === "invite" ? "Invite teammate" : "Update teammate access"}
          </div>
          <div className="mt-1 text-sm text-white/70">
            Email delivery is not enabled yet. Creating an invite stores the pending teammate access
            record in the production database.
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <label className="block">
            <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Email
            </span>
            <input
              type="email"
              value={form.email}
              disabled={form.mode !== "invite"}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value.trim().toLowerCase() }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none disabled:bg-[var(--panel-soft)]"
              placeholder="name@company.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Role
            </span>
            <select
              value={form.role}
              onChange={(event) => {
                const role = event.target.value as TeamRole;
                setForm((current) => ({
                  ...current,
                  accessScope: role === "Location Manager" ? "selected_locations" : "all_locations",
                  restaurantIds:
                    role === "Location Manager"
                      ? current.restaurantIds
                      : [],
                  role,
                }));
              }}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
            >
              {TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                  {role === "Location Manager" ? " / scoped to selected locations" : ""}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Location Access
            </div>
            {isLocationManager ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                  Assignable locations come from the active customer account and should match the
                  locations visible in the Location Waterfall for that account.
                </div>
                {locations.length > 0 ? (
                  locations.map((location) => {
                    const checked = form.restaurantIds.includes(location.id);
                    return (
                      <label
                        key={location.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-4 py-4 text-sm"
                      >
                        <div>
                          <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                            {location.label}
                          </div>
                          <div className="mt-1 font-medium text-[var(--text)]">{location.name}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              restaurantIds: event.target.checked
                                ? [...current.restaurantIds, location.id]
                                : current.restaurantIds.filter((restaurantId) => restaurantId !== location.id),
                            }))
                          }
                          className="h-4 w-4 rounded border-[var(--border)]"
                        />
                      </label>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-[rgba(214,48,49,0.18)] bg-[rgba(214,48,49,0.04)] px-4 py-4 text-sm text-[var(--accent)]">
                    No account locations are available to assign yet. Create or attach locations to
                    this customer account first so they appear here and in the Location Waterfall.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                This role receives account-wide access to all current and future locations. Only
                `Location Manager` is scoped to selected locations.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSubmit(form)}
            className="rounded-full bg-[var(--text)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : form.mode === "invite"
                ? "Create invite"
                : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PermissionsView({}: { records: PermissionRecord[] }) {
  const [data, setData] = useState<TeamAccessPayload | null>(null);
  const [bootstrapAccountId, setBootstrapAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalState, setModalState] = useState<TeamModalState | null>(null);

  async function loadTeam() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/team", { cache: "no-store" });
      const payload = (await response.json()) as TeamAccessPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load team access.");
      }
      setData(payload);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load team access.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/team", { cache: "no-store" });
        const payload = (await response.json()) as TeamAccessPayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load team access.");
        }
        if (!ignore) {
          setData(payload);
        }
      } catch (nextError) {
        if (!ignore) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load team access.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      ignore = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];

    const memberRows = data.members.map((member) => ({
      actions:
        data.canManageTeam && !member.accountHolder
          ? {
              edit: true,
              revoke: true,
            }
          : null,
      email: member.email,
      id: `member-${member.id}`,
      kind: "member" as const,
      lastActive: member.lastActive ? formatRelativeDate(member.lastActive) : "Now / this session",
      locationAccess: buildScopeLabel(member.accessScope, member.locationAccess),
      name: member.name,
      notes: member.accountHolder ? "Account holder" : "Active teammate",
      role: member.teamRole,
      status: member.status,
      source: member,
    }));

    const inviteRows = data.invites.map((invite) => ({
      actions:
        data.canManageTeam
          ? {
              edit: invite.status === "pending",
              revoke: invite.status === "pending",
            }
          : null,
      email: invite.email,
      id: `invite-${invite.id}`,
      kind: "invite" as const,
      lastActive: "Pending acceptance",
      locationAccess: buildScopeLabel(invite.accessScope, invite.locationAccess),
      name: invite.email,
      notes: "Email delivery pending implementation",
      role: invite.role,
      status: invite.status,
      source: invite,
    }));

    return [...memberRows, ...inviteRows];
  }, [data]);

  async function handleSubmitModal(state: TeamModalState) {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        accessScope: state.role === "Location Manager" ? "selected_locations" : "all_locations",
        email: state.email,
        restaurantIds: state.role === "Location Manager" ? state.restaurantIds : [],
        role: state.role,
      };

      let response: Response;
      if (state.mode === "invite") {
        response = await fetch("/api/team", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } else if (state.mode === "edit-member") {
        response = await fetch(`/api/team/members/${state.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`/api/team/invitations/${state.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save team access.");
      }

      setModalState(null);
      setMessage(
        state.mode === "invite"
          ? "Team invite created."
          : "Team access updated.",
      );
      await loadTeam();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save team access.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBootstrapOwnerAccount() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/team/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: bootstrapAccountId.trim(),
        }),
      });

      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to initialize the team owner account.");
      }

      setMessage("Customer owner account initialized for this SuperAdmin.");
      setBootstrapAccountId("");
      await loadTeam();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to initialize the team owner account.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRowAction(row: (typeof rows)[number], action: "edit" | "revoke") {
    if (action === "edit") {
      if (!data) return;

      if (row.kind === "member") {
        const member = row.source as TeamMemberRecord;
        setModalState({
          accessScope: member.accessScope,
          email: member.email,
          id: member.id,
          mode: "edit-member",
          restaurantIds: member.locationAccess.map((location) => location.id),
          role: member.teamRole,
        });
        return;
      }

      const invite = row.source as TeamInviteRecord;
      setModalState({
        accessScope: invite.accessScope,
        email: invite.email,
        id: invite.id,
        mode: "edit-invite",
        restaurantIds: invite.locationAccess.map((location) => location.id),
        role: invite.role,
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const endpoint =
        row.kind === "member"
          ? `/api/team/members/${(row.source as TeamMemberRecord).id}`
          : `/api/team/invitations/${(row.source as TeamInviteRecord).id}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update this team entry.");
      }

      setMessage(row.kind === "member" ? "Teammate access revoked." : "Invite cancelled.");
      await loadTeam();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update this team entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              <span>Team &amp; Access</span>
              <HelpTip
                title="Team & Access"
                sections={[
                  {
                    label: "What It Is",
                    text: "Customer-account roster management with teammate roles and per-location access scoping.",
                  },
                  {
                    label: "What It Does",
                    text: "Lets account owners and finance users create pending invites, manage teammate access, and limit location managers to selected locations.",
                  },
                  {
                    label: "Current Limitation",
                    text: "Email delivery is not implemented yet. Invite records are persisted and visible, but invitation acceptance is still a later phase.",
                  },
                ]}
                footerLabel="Persistence"
                footerValue="Database-backed team roster"
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Everyone with access to this account, their role, and which locations they can see.
              Only Owner and Finance can manage the team.
            </p>
          </div>

          {data?.canManageTeam ? (
            <button
              type="button"
              onClick={() =>
                setModalState({
                  accessScope: "selected_locations",
                  email: "",
                  mode: "invite",
                  restaurantIds: [],
                  role: "Location Manager",
                })
              }
              className="rounded-full border border-[rgba(196,142,36,0.45)] bg-[rgba(196,142,36,0.08)] px-5 py-3 text-sm font-semibold text-[#8a6410] transition hover:bg-[rgba(196,142,36,0.14)]"
            >
              + Invite teammate
            </button>
          ) : null}
        </div>
      </SectionCard>

      {message ? (
        <SectionCard className="border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.04)] py-4 text-sm text-[var(--success)]">
          {message}
        </SectionCard>
      ) : null}

      {error ? (
        <SectionCard className="border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.04)] py-4 text-sm text-[var(--accent)]">
          {error}
        </SectionCard>
      ) : null}

      {data?.canBootstrapOwnerAccount ? (
        <SectionCard className="border-[rgba(0,97,255,0.18)] bg-[rgba(0,97,255,0.04)]">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--info)]">
            SuperAdmin Customer Owner Mode
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
            Attach this SuperAdmin to a customer team account
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            This keeps your platform-level `SuperAdmin` access intact while also creating an
            `Owner` membership in a customer account so you can use Team &amp; Access as a client
            owner.
          </p>
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
            Current customer account: <span className="font-semibold text-[var(--text)]">{data?.currentAccountId ?? "None"}</span>
          </div>
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
            <label className="block flex-1">
              <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Customer Account ID
              </span>
              <input
                type="text"
                value={bootstrapAccountId}
                onChange={(event) => setBootstrapAccountId(event.target.value)}
                placeholder="e.g. C001 or acct:mesa-verde"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none"
              />
            </label>
            <button
              type="button"
              disabled={saving || !bootstrapAccountId.trim()}
              onClick={() => void handleBootstrapOwnerAccount()}
              className="rounded-full bg-[var(--text)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Set Team Account"}
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard className="overflow-hidden p-0">
        {loading ? (
          <div className="px-6 py-8 text-sm text-[var(--muted)]">Loading team access...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--panel-soft)] text-left font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Location Access</th>
                  <th className="px-6 py-4">Last Active</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] align-top last:border-b-0">
                      <td className="px-6 py-5">
                        <div className="font-semibold text-[var(--text)]">{row.name}</div>
                      </td>
                      <td className="px-6 py-5 text-sm text-[var(--muted)]">{row.email}</td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] ${roleTone(row.role)}`}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-[var(--text)]">{row.locationAccess}</td>
                      <td className="px-6 py-5 text-sm text-[var(--muted)]">{row.lastActive}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-2 text-sm ${statusTone(row.status)}`}>
                          <span className={`h-2 w-2 rounded-full ${row.status === "active" ? "bg-[#0f8f62]" : row.status === "pending" ? "bg-[#b86a00]" : "bg-[var(--accent)]"}`} />
                          {row.status === "pending" ? "Invite pending" : row.status === "cancelled" ? "Invite cancelled" : row.status === "revoked" ? "Revoked" : "Active"}
                        </span>
                        <div className="mt-1 text-xs text-[var(--muted)]">{row.notes}</div>
                      </td>
                      <td className="px-6 py-5">
                        {row.actions ? (
                          <div className="flex flex-wrap gap-2">
                            {row.actions.edit ? (
                              <button
                                type="button"
                                onClick={() => void handleRowAction(row, "edit")}
                                className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--text)]"
                              >
                                Edit
                              </button>
                            ) : null}
                            {row.actions.revoke ? (
                              <button
                                type="button"
                                onClick={() => void handleRowAction(row, "revoke")}
                                className="rounded-lg border border-[rgba(214,48,49,0.22)] bg-white px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(214,48,49,0.05)]"
                              >
                                {row.kind === "member" ? "Revoke" : "Cancel invite"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-sm text-[var(--muted)]">
                      No team entries exist for this account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard className="p-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6410]">
            Owner
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
            Full access
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Can see every location, manage the team, and operate the full customer workflow.
          </p>
        </SectionCard>
        <SectionCard className="p-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6410]">
            Finance
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
            Books &amp; recovery
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Can manage the team and review recovery operations across the whole account.
          </p>
        </SectionCard>
        <SectionCard className="p-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6410]">
            Location Manager
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
            Scoped locations
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Sees and operates only the locations explicitly assigned to them.
          </p>
        </SectionCard>
        <SectionCard className="p-5">
          <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6410]">
            Read-only
          </div>
          <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
            View, never act
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Can review everything in scope but cannot change uploads, governance, or certification state.
          </p>
        </SectionCard>
      </div>

      {modalState && data ? (
        <TeamModal
          key={`${modalState.mode}-${"id" in modalState ? modalState.id : "new"}`}
          locations={data.locations}
          onClose={() => setModalState(null)}
          onSubmit={handleSubmitModal}
          saving={saving}
          state={modalState}
        />
      ) : null}
    </div>
  );
}
