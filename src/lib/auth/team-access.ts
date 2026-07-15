import { Prisma } from "@/app/generated/prisma/client";
import type { SessionState, TeamAccessPayload, TeamAccessScope, TeamLocationOption, TeamRole } from "@/components/sentry/types";
import prisma from "@/lib/prisma";

export type MembershipRow = {
  access_scope: string;
  account_holder: boolean;
  account_id: string;
  id: number;
  manager_id: number;
  status: string;
  team_role: string;
};

export function normalizeTeamRole(value: string | null | undefined): TeamRole | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "owner") return "Owner";
  if (normalized === "finance") return "Finance";
  if (normalized === "location manager") return "Location Manager";
  if (normalized === "read-only" || normalized === "read only") return "Read-only";
  return null;
}

export function normalizeAccessScope(value: string | null | undefined): TeamAccessScope {
  return value === "selected_locations" ? "selected_locations" : "all_locations";
}

export function mapTeamRoleToAppRole(teamRole: TeamRole): SessionState["role"] {
  switch (teamRole) {
    case "Owner":
    case "Finance":
      return "Admin";
    case "Location Manager":
      return "Manager";
    case "Read-only":
      return "Viewer";
  }
}

export async function getActiveMembership(managerId: number | null | undefined) {
  if (typeof managerId !== "number") {
    return null;
  }

  const rows = await prisma.$queryRaw<MembershipRow[]>(Prisma.sql`
    SELECT
      id,
      manager_id,
      account_id,
      team_role,
      access_scope,
      status,
      account_holder
    FROM public.account_memberships_v2
    WHERE manager_id = ${managerId}
      AND status = 'active'
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function canManageTeam(session: SessionState) {
  if (session.role === "SuperAdmin") {
    return true;
  }

  if (session.role === "WGS Manager") {
    return false;
  }

  const membership = await getActiveMembership(session.managerId);
  if (!membership) {
    return session.role === "Admin";
  }

  const teamRole = normalizeTeamRole(membership.team_role);
  return teamRole === "Owner" || teamRole === "Finance";
}

export async function getTeamAccountId(session: SessionState) {
  const membership = await getActiveMembership(session.managerId);

  if (session.role === "WGS Manager") {
    return null;
  }

  if (session.role === "SuperAdmin") {
    return membership?.account_id ?? session.accountId ?? null;
  }

  return membership?.account_id ?? session.accountId ?? null;
}

export async function getScopedRestaurantIds(session: SessionState) {
  if (session.role === "WGS Manager" || session.role === "SuperAdmin") {
    return null;
  }

  if (typeof session.managerId !== "number") {
    return [];
  }

  const membership = await getActiveMembership(session.managerId);
  if (!membership) {
    return null;
  }

  const accessScope = normalizeAccessScope(membership.access_scope);
  if (accessScope === "all_locations") {
    const rows = await prisma.$queryRaw<Array<{ restaurant_id: number }>>(Prisma.sql`
      SELECT rss.restaurant_id
      FROM public.restaurant_sentry_state rss
      INNER JOIN public.restaurants r
        ON r.id = rss.restaurant_id
      WHERE r.active = true
        AND rss.account_id = ${membership.account_id}
    `);

    return rows.map((row) => row.restaurant_id);
  }

  const rows = await prisma.$queryRaw<Array<{ restaurant_id: number }>>(Prisma.sql`
    SELECT aml.restaurant_id
    FROM public.account_member_locations_v2 aml
    INNER JOIN public.account_memberships_v2 am
      ON am.id = aml.membership_id
    INNER JOIN public.restaurants r
      ON r.id = aml.restaurant_id
    WHERE am.manager_id = ${session.managerId}
      AND am.status = 'active'
      AND r.active = true
  `);

  return rows.map((row) => row.restaurant_id);
}

export async function getScopedRestaurantWhere(session: SessionState) {
  if (session.role === "WGS Manager" || session.role === "SuperAdmin") {
    return {} as const;
  }

  if (typeof session.managerId !== "number") {
    return { id: -1 } as const;
  }

  const ids = await getScopedRestaurantIds(session);
  if (ids === null) {
    return { created_by: session.managerId } as const;
  }

  if (ids.length === 0) {
    return { id: -1 } as const;
  }

  return {
    id: {
      in: ids,
    },
  } as const;
}

export async function listAccountLocations(accountId: string, managerId?: number | null) {
  const rows =
    typeof managerId === "number"
      ? await prisma.$queryRaw<
          Array<{
            account_id: string | null;
            id: number;
            location_id: string | null;
            location_text: string | null;
            name: string;
            unit_id: string | null;
          }>
        >(Prisma.sql`
          SELECT
            r.id,
            r.name,
            r.location AS location_text,
            r.unit_id,
            rss.account_id,
            rss.location_id
          FROM public.restaurants r
          LEFT JOIN public.restaurant_sentry_state rss
            ON r.id = rss.restaurant_id
          WHERE r.active = true
            AND (
              rss.account_id = ${accountId}
              OR (
                r.created_by = ${managerId}
                AND (rss.account_id IS NULL OR rss.account_id = '')
              )
            )
          ORDER BY r.name ASC, r.id ASC
        `)
      : await prisma.$queryRaw<
          Array<{
            account_id: string | null;
            id: number;
            location_id: string | null;
            location_text: string | null;
            name: string;
            unit_id: string | null;
          }>
        >(Prisma.sql`
          SELECT
            r.id,
            r.name,
            r.location AS location_text,
            r.unit_id,
            rss.account_id,
            rss.location_id
          FROM public.restaurants r
          LEFT JOIN public.restaurant_sentry_state rss
            ON r.id = rss.restaurant_id
          WHERE r.active = true
            AND rss.account_id = ${accountId}
          ORDER BY r.name ASC, r.id ASC
        `);

  const uniqueRows = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = uniqueRows.get(row.id);
    if (!existing) {
      uniqueRows.set(row.id, row);
      continue;
    }

    if (!existing.account_id && row.account_id) {
      uniqueRows.set(row.id, row);
    }
  }

  return [...uniqueRows.values()].map<TeamLocationOption>((row) => ({
    id: row.id,
    label: row.location_id?.trim() || row.unit_id?.trim() || `LOC-DB-${row.id}`,
    locationId: row.location_id?.trim() || row.unit_id?.trim() || `LOC-DB-${row.id}`,
    name: row.name,
  }));
}

export function formatLocationAccessSummary(
  accessScope: TeamAccessScope,
  locations: TeamLocationOption[],
) {
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

export type TeamApiResponse = TeamAccessPayload;
