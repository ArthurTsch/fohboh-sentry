import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import {
  addTeamMemberAction,
  createTeamAccountAction,
  deleteTeamAccountAction,
  revokeTeamMemberAction,
} from "@/app/admin/actions";
import {
  adminInputClassName,
  adminMetadata,
  AdminField,
  AdminLoginScreen,
  AdminShell,
  formatAdminDate,
  getSearchParam,
  isAdminAuthorized,
} from "@/app/admin/admin-ui";

export const metadata: Metadata = adminMetadata;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type TeamRow = {
  account_id: string;
  active_members: bigint | number;
  billing_plan_code: string | null;
  customer_name: string | null;
  customer_plan: string | null;
  location_count: bigint | number;
  pending_invites: bigint | number;
};

type TeamMemberRow = {
  access_scope: string;
  accepted_at: Date | null;
  account_holder: boolean;
  account_id: string;
  created_at: Date | null;
  email: string;
  full_name: string | null;
  id: number;
  last_active_at: Date | null;
  manager_id: number;
  team_role: string;
};

type TeamLocationRow = {
  account_id: string;
  location_id: string | null;
  name: string;
  restaurant_id: number;
  unit_id: string | null;
};

type MemberLocationRow = {
  location_id: string | null;
  membership_id: number;
  name: string;
  restaurant_id: number;
  unit_id: string | null;
};

export default async function SuperAdminTeamsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const authorized = await isAdminAuthorized();

  if (!authorized) {
    return <AdminLoginScreen error={getSearchParam(resolvedSearchParams, "error")} />;
  }

  const [teams, members, teamLocations, memberLocations, managers] = await Promise.all([
    prisma.$queryRaw<TeamRow[]>`
      WITH account_ids AS (
        SELECT account_id
        FROM public.customers
        WHERE account_id IS NOT NULL
          AND deleted_at IS NULL
        UNION
        SELECT account_id
        FROM public.billing_accounts_v2
        UNION
        SELECT account_id
        FROM public.account_memberships_v2
        UNION
        SELECT account_id
        FROM public.team_invitations_v2
        UNION
        SELECT account_id
        FROM public.restaurant_sentry_state
        WHERE account_id IS NOT NULL
          AND account_id <> ''
      )
      SELECT
        ai.account_id,
        c.name AS customer_name,
        c.plan AS customer_plan,
        b.plan_code AS billing_plan_code,
        COALESCE((
          SELECT COUNT(*)::bigint
          FROM public.account_memberships_v2 am
          WHERE am.account_id = ai.account_id
            AND am.status = 'active'
        ), 0) AS active_members,
        COALESCE((
          SELECT COUNT(*)::bigint
          FROM public.team_invitations_v2 ti
          WHERE ti.account_id = ai.account_id
            AND ti.status = 'pending'
        ), 0) AS pending_invites,
        COALESCE((
          SELECT COUNT(DISTINCT rss.restaurant_id)::bigint
          FROM public.restaurant_sentry_state rss
          INNER JOIN public.restaurants r
            ON r.id = rss.restaurant_id
          WHERE rss.account_id = ai.account_id
            AND r.active = true
        ), 0) AS location_count
      FROM account_ids ai
      LEFT JOIN public.customers c
        ON c.account_id = ai.account_id
        AND c.deleted_at IS NULL
      LEFT JOIN public.billing_accounts_v2 b
        ON b.account_id = ai.account_id
      ORDER BY COALESCE(c.name, ai.account_id) ASC, ai.account_id ASC
    `,
    prisma.$queryRaw<TeamMemberRow[]>`
      SELECT
        am.id,
        am.manager_id,
        am.account_id,
        am.team_role,
        am.access_scope,
        am.account_holder,
        am.accepted_at,
        am.created_at,
        am.last_active_at,
        m.email,
        m.full_name
      FROM public.account_memberships_v2 am
      INNER JOIN public.managers m
        ON m.id = am.manager_id
      WHERE am.status = 'active'
      ORDER BY am.account_id ASC, am.account_holder DESC, am.created_at ASC, am.id ASC
    `,
    prisma.$queryRaw<TeamLocationRow[]>`
      SELECT
        rss.account_id,
        rss.location_id,
        r.unit_id,
        r.name,
        r.id AS restaurant_id
      FROM public.restaurant_sentry_state rss
      INNER JOIN public.restaurants r
        ON r.id = rss.restaurant_id
      WHERE rss.account_id IS NOT NULL
        AND rss.account_id <> ''
        AND r.active = true
      ORDER BY rss.account_id ASC, r.name ASC, r.id ASC
    `,
    prisma.$queryRaw<MemberLocationRow[]>`
      SELECT
        aml.membership_id,
        aml.restaurant_id,
        rss.location_id,
        r.unit_id,
        r.name
      FROM public.account_member_locations_v2 aml
      INNER JOIN public.restaurants r
        ON r.id = aml.restaurant_id
      LEFT JOIN public.restaurant_sentry_state rss
        ON rss.restaurant_id = aml.restaurant_id
      ORDER BY aml.membership_id ASC, r.name ASC, r.id ASC
    `,
    prisma.managers.findMany({
      orderBy: [{ full_name: "asc" }, { email: "asc" }],
      select: {
        email: true,
        full_name: true,
        id: true,
      },
    }),
  ]);

  const teamState = getSearchParam(resolvedSearchParams, "team");
  const memberState = getSearchParam(resolvedSearchParams, "member");

  const membersByAccount = new Map<string, TeamMemberRow[]>();
  for (const member of members) {
    const current = membersByAccount.get(member.account_id) ?? [];
    current.push(member);
    membersByAccount.set(member.account_id, current);
  }

  const locationsByAccount = new Map<string, TeamLocationRow[]>();
  for (const location of teamLocations) {
    const current = locationsByAccount.get(location.account_id) ?? [];
    current.push(location);
    locationsByAccount.set(location.account_id, current);
  }

  const memberLocationsByMembership = new Map<number, MemberLocationRow[]>();
  for (const location of memberLocations) {
    const current = memberLocationsByMembership.get(location.membership_id) ?? [];
    current.push(location);
    memberLocationsByMembership.set(location.membership_id, current);
  }

  return (
    <AdminShell
      currentPath="/superadmin/teams"
      title="Teams"
      description="Create and remove customer team accounts, then add or revoke manager memberships from each team roster."
    >
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              Create Team
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
              Add customer team account
            </h2>

            {teamState === "created" ? <AdminNotice tone="success">Team account created successfully.</AdminNotice> : null}
            {teamState === "deleted" ? <AdminNotice tone="success">Team account removed successfully.</AdminNotice> : null}
            {teamState === "missing-fields" ? <AdminNotice tone="error">Account ID and team name are required.</AdminNotice> : null}
            {teamState === "invalid-account-id" ? <AdminNotice tone="error">Use a valid account ID format such as `ACC001`.</AdminNotice> : null}
            {teamState === "duplicate-account-id" ? <AdminNotice tone="error">That team account ID already exists.</AdminNotice> : null}
            {teamState === "owner-already-on-other-team" ? <AdminNotice tone="error">The selected initial owner already belongs to another active team.</AdminNotice> : null}
            {teamState === "has-locations" ? <AdminNotice tone="error">Remove or reassign all active locations before deleting this team.</AdminNotice> : null}
            {teamState === "has-members" ? <AdminNotice tone="error">Revoke all active team members before deleting this team.</AdminNotice> : null}
            {teamState === "has-invites" ? <AdminNotice tone="error">Cancel pending invites before deleting this team.</AdminNotice> : null}
            {teamState === "server-error" ? <AdminNotice tone="error">Unable to save the team account right now.</AdminNotice> : null}

            {memberState === "assigned" ? <AdminNotice tone="success">Team member assigned successfully.</AdminNotice> : null}
            {memberState === "revoked" ? <AdminNotice tone="success">Team member revoked successfully.</AdminNotice> : null}
            {memberState === "missing-fields" ? <AdminNotice tone="error">Choose a team, manager, and valid role.</AdminNotice> : null}
            {memberState === "manager-not-found" ? <AdminNotice tone="error">The selected manager account no longer exists.</AdminNotice> : null}
            {memberState === "missing-location-scope" ? <AdminNotice tone="error">Selected-location access requires at least one team location.</AdminNotice> : null}
            {memberState === "member-already-on-other-team" ? <AdminNotice tone="error">That manager already belongs to another active team.</AdminNotice> : null}
            {memberState === "last-owner" ? <AdminNotice tone="error">You cannot revoke the last active owner of a team.</AdminNotice> : null}
            {memberState === "invalid-id" ? <AdminNotice tone="error">That team membership could not be found.</AdminNotice> : null}
            {memberState === "server-error" ? <AdminNotice tone="error">Unable to update the team roster right now.</AdminNotice> : null}

            <form action={createTeamAccountAction} className="mt-6 space-y-4">
              <AdminField label="Team Name">
                <input
                  name="name"
                  className={adminInputClassName}
                  placeholder="Mesa Verde Group"
                  required
                />
              </AdminField>
              <AdminField label="Account ID">
                <input
                  name="account_id"
                  className={adminInputClassName}
                  placeholder="ACC001"
                  required
                />
              </AdminField>
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="Customer Plan">
                  <select name="plan" className={adminInputClassName} defaultValue="wgs">
                    <option value="wgs">WGS</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </AdminField>
                <AdminField label="Billing Plan">
                  <select name="plan_code" className={adminInputClassName} defaultValue="m01_m02_bundle">
                    <option value="m01_m02_bundle">M01 + M02 Bundle</option>
                    <option value="m01_only">M01 Only</option>
                    <option value="m02_only">M02 Only</option>
                  </select>
                </AdminField>
              </div>
              <AdminField label="Initial Owner">
                <select name="owner_manager_id" className={adminInputClassName} defaultValue="">
                  <option value="">No owner assigned yet</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {(manager.full_name?.trim() || manager.email).trim()} #{manager.id}
                    </option>
                  ))}
                </select>
              </AdminField>
              <button
                type="submit"
                className="w-full rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
              >
                Create Team Account
              </button>
            </form>
          </section>

          <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Team Accounts
                </div>
                <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em]">
                  Existing teams
                </h2>
              </div>
              <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">
                {teams.length} total
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {teams.map((team) => {
                const teamMembers = membersByAccount.get(team.account_id) ?? [];
                const availableLocations = locationsByAccount.get(team.account_id) ?? [];

                return (
                  <section
                    key={team.account_id}
                    className="rounded-[24px] border border-[var(--border)] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
                          {team.customer_name || team.account_id}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">
                            {team.account_id}
                          </span>
                          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">
                            Plan {team.customer_plan || "wgs"}
                          </span>
                          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1">
                            Billing {team.billing_plan_code || "not configured"}
                          </span>
                        </div>
                      </div>

                      <form action={deleteTeamAccountAction}>
                        <input type="hidden" name="account_id" value={team.account_id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-[rgba(214,48,49,0.18)] px-4 py-3 text-sm font-medium text-[var(--accent)] transition hover:border-[var(--accent)]"
                        >
                          Delete Team
                        </button>
                      </form>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <MiniInfo label="Active Members" value={String(Number(team.active_members ?? 0))} />
                      <MiniInfo label="Pending Invites" value={String(Number(team.pending_invites ?? 0))} />
                      <MiniInfo label="Locations" value={String(Number(team.location_count ?? 0))} />
                    </div>

                    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                        <div className="grid grid-cols-[1.2fr_1fr_1fr_150px_120px] gap-3 bg-[var(--surface)] px-4 py-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                          <span>Member</span>
                          <span>Role</span>
                          <span>Access</span>
                          <span>Last Active</span>
                          <span>Actions</span>
                        </div>
                        {teamMembers.length === 0 ? (
                          <div className="px-4 py-5 text-sm text-[var(--muted)]">No active members on this team yet.</div>
                        ) : (
                          teamMembers.map((member) => {
                            const scopedLocations = memberLocationsByMembership.get(member.id) ?? [];
                            const accessLabel =
                              member.access_scope === "selected_locations"
                                ? scopedLocations.length > 0
                                  ? `${scopedLocations.length} selected`
                                  : "No locations"
                                : "All locations";

                            return (
                              <div
                                key={member.id}
                                className="grid grid-cols-[1.2fr_1fr_1fr_150px_120px] gap-3 border-t border-[var(--border)] px-4 py-4 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-[var(--text)]">
                                    {member.full_name?.trim() || member.email}
                                  </div>
                                  <div className="truncate text-xs text-[var(--muted)]">{member.email}</div>
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-[var(--text)]">{member.team_role}</div>
                                  <div className="truncate text-xs text-[var(--muted)]">
                                    {member.account_holder ? "Account holder" : `Manager #${member.manager_id}`}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-[var(--text)]">{accessLabel}</div>
                                  <div className="truncate text-xs text-[var(--muted)]">
                                    {member.access_scope === "selected_locations"
                                      ? scopedLocations
                                          .map((location) => location.location_id || location.unit_id || `LOC-DB-${location.restaurant_id}`)
                                          .join(", ") || "No scoped locations"
                                      : "Current and future team locations"}
                                  </div>
                                </div>
                                <div className="text-[var(--muted)]">
                                  {formatAdminDate(member.last_active_at || member.accepted_at || member.created_at)}
                                </div>
                                <div>
                                  <form action={revokeTeamMemberAction}>
                                    <input type="hidden" name="membership_id" value={member.id} />
                                    <button
                                      type="submit"
                                      className="rounded-lg border border-[rgba(214,48,49,0.18)] px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]"
                                    >
                                      Revoke
                                    </button>
                                  </form>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                          Add Member
                        </div>
                        <form action={addTeamMemberAction} className="mt-4 space-y-4">
                          <input type="hidden" name="account_id" value={team.account_id} />
                          <AdminField label="Manager Account">
                            <select name="manager_id" className={adminInputClassName} defaultValue="">
                              <option value="">Select manager</option>
                              {managers.map((manager) => (
                                <option key={manager.id} value={manager.id}>
                                  {(manager.full_name?.trim() || manager.email).trim()} #{manager.id}
                                </option>
                              ))}
                            </select>
                          </AdminField>
                          <div className="grid grid-cols-2 gap-3">
                            <AdminField label="Role">
                              <select name="team_role" className={adminInputClassName} defaultValue="Location Manager">
                                <option value="Owner">Owner</option>
                                <option value="Finance">Finance</option>
                                <option value="Location Manager">Location Manager</option>
                                <option value="Read-only">Read-only</option>
                              </select>
                            </AdminField>
                            <AdminField label="Access Scope">
                              <select name="access_scope" className={adminInputClassName} defaultValue="all_locations">
                                <option value="all_locations">All locations</option>
                                <option value="selected_locations">Selected locations</option>
                              </select>
                            </AdminField>
                          </div>

                          <div>
                            <div className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                              Scoped Locations
                            </div>
                            {availableLocations.length === 0 ? (
                              <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                                No active locations are attached to this team yet.
                              </div>
                            ) : (
                              <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-[var(--border)] bg-white p-3">
                                {availableLocations.map((location) => (
                                  <label
                                    key={`${team.account_id}:${location.restaurant_id}`}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3 text-sm"
                                  >
                                    <div>
                                      <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                                        {location.location_id?.trim() || location.unit_id?.trim() || `LOC-DB-${location.restaurant_id}`}
                                      </div>
                                      <div className="mt-1 font-medium text-[var(--text)]">{location.name}</div>
                                    </div>
                                    <input
                                      type="checkbox"
                                      name="restaurant_ids"
                                      value={location.restaurant_id}
                                      className="h-4 w-4 rounded border-[var(--border)]"
                                    />
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="submit"
                            className="w-full rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]"
                          >
                            Add Member To Team
                          </button>
                        </form>
                      </section>
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </AdminShell>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{label}</div>
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
      className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
        tone === "success"
          ? "border border-[rgba(0,200,83,0.18)] bg-[rgba(0,200,83,0.06)] text-[var(--success)]"
          : "border border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.06)] text-[var(--accent)]"
      }`}
    >
      {children}
    </div>
  );
}
