import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import type { TeamAccessPayload, TeamAccessScope, TeamLocationOption, TeamMemberRecord, TeamRole } from "@/components/sentry/types";
import { requireManagerSession } from "@/lib/auth/session";
import {
  canManageTeam,
  getTeamAccountId,
  listAccountLocations,
  normalizeAccessScope,
  normalizeTeamRole,
} from "@/lib/auth/team-access";
import { writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";

function getAuthErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "Unauthorized") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error.message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}

type MembershipRow = {
  access_scope: string;
  accepted_at: Date | null;
  account_holder: boolean;
  created_at: Date | null;
  email: string;
  full_name: string | null;
  id: number;
  last_active_at: Date | null;
  manager_id: number;
  status: string;
  team_role: string;
};

type MembershipLocationRow = {
  location_id: string | null;
  membership_id: number;
  name: string;
  restaurant_id: number;
  unit_id: string | null;
};

type InviteRow = {
  access_scope: string;
  created_at: Date;
  email: string;
  id: number;
  status: string;
  team_role: string;
};

type InviteLocationRow = {
  invitation_id: number;
  location_id: string | null;
  name: string;
  restaurant_id: number;
  unit_id: string | null;
};

function mapLocationOption(row: {
  location_id: string | null;
  name: string;
  restaurant_id: number;
  unit_id: string | null;
}): TeamLocationOption {
  const label = row.location_id?.trim() || row.unit_id?.trim() || `LOC-DB-${row.restaurant_id}`;
  return {
    id: row.restaurant_id,
    label,
    locationId: label,
    name: row.name,
  };
}

async function buildTeamPayload(session: Awaited<ReturnType<typeof requireManagerSession>>): Promise<TeamAccessPayload> {
  const accountId = await getTeamAccountId(session);
  if (!accountId) {
    return {
      canBootstrapOwnerAccount: session.role === "SuperAdmin" && typeof session.managerId === "number",
      canManageTeam: false,
      currentAccountId: null,
      currentMemberId: session.managerId ?? null,
      invites: [],
      locations: [],
      members: [],
      usesLegacyAccountModel: true,
    };
  }

  const [locations, membershipRows, inviteRows, membershipLocationRows, inviteLocationRows] =
    await Promise.all([
      listAccountLocations(accountId, session.managerId),
      prisma.$queryRaw<MembershipRow[]>(Prisma.sql`
        SELECT
          am.id,
          am.manager_id,
          am.team_role,
          am.access_scope,
          am.status,
          am.account_holder,
          am.accepted_at,
          am.created_at,
          am.last_active_at,
          m.email,
          m.full_name
        FROM public.account_memberships_v2 am
        INNER JOIN public.managers m
          ON m.id = am.manager_id
        WHERE am.account_id = ${accountId}
        ORDER BY am.account_holder DESC, am.created_at ASC, am.id ASC
      `).catch(() => []),
      prisma.$queryRaw<InviteRow[]>(Prisma.sql`
        SELECT
          id,
          email,
          team_role,
          access_scope,
          status,
          created_at
        FROM public.team_invitations_v2
        WHERE account_id = ${accountId}
          AND status IN ('pending', 'cancelled')
        ORDER BY created_at DESC, id DESC
      `).catch(() => []),
      prisma.$queryRaw<MembershipLocationRow[]>(Prisma.sql`
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
          ON rss.restaurant_id = r.id
        INNER JOIN public.account_memberships_v2 am
          ON am.id = aml.membership_id
        WHERE am.account_id = ${accountId}
      `).catch(() => []),
      prisma.$queryRaw<InviteLocationRow[]>(Prisma.sql`
        SELECT
          til.invitation_id,
          til.restaurant_id,
          rss.location_id,
          r.unit_id,
          r.name
        FROM public.team_invitation_locations_v2 til
        INNER JOIN public.restaurants r
          ON r.id = til.restaurant_id
        LEFT JOIN public.restaurant_sentry_state rss
          ON rss.restaurant_id = r.id
        INNER JOIN public.team_invitations_v2 ti
          ON ti.id = til.invitation_id
        WHERE ti.account_id = ${accountId}
          AND ti.status IN ('pending', 'cancelled')
      `).catch(() => []),
    ]);

  const memberLocations = new Map<number, TeamLocationOption[]>();
  for (const row of membershipLocationRows) {
    const current = memberLocations.get(row.membership_id) ?? [];
    current.push(mapLocationOption(row));
    memberLocations.set(row.membership_id, current);
  }

  const inviteLocations = new Map<number, TeamLocationOption[]>();
  for (const row of inviteLocationRows) {
    const current = inviteLocations.get(row.invitation_id) ?? [];
    current.push(mapLocationOption(row));
    inviteLocations.set(row.invitation_id, current);
  }

  const members: TeamMemberRecord[] = membershipRows
    .map((row) => {
      const teamRole = normalizeTeamRole(row.team_role);
      if (!teamRole) {
        return null;
      }

      return {
        accountHolder: row.account_holder,
        accessScope: normalizeAccessScope(row.access_scope),
        email: row.email,
        id: row.id,
        invitedAt: row.created_at?.toISOString() ?? null,
        lastActive: row.last_active_at?.toISOString() ?? row.accepted_at?.toISOString() ?? null,
        locationAccess: memberLocations.get(row.id) ?? [],
        name: row.full_name?.trim() || row.email,
        status: row.status === "revoked" ? "revoked" : "active",
        teamRole,
      };
    })
    .filter((row): row is TeamMemberRecord => Boolean(row));

  const invites = inviteRows
    .map((row) => {
      const teamRole = normalizeTeamRole(row.team_role);
      if (!teamRole) {
        return null;
      }

      return {
        accessScope: normalizeAccessScope(row.access_scope),
        createdAt: row.created_at.toISOString(),
        email: row.email,
        id: row.id,
        locationAccess: inviteLocations.get(row.id) ?? [],
        role: teamRole,
        status: row.status === "cancelled" ? "cancelled" : "pending",
      };
    })
    .filter((row): row is TeamAccessPayload["invites"][number] => Boolean(row));

  return {
    canBootstrapOwnerAccount: session.role === "SuperAdmin" && typeof session.managerId === "number",
    canManageTeam: await canManageTeam(session),
    currentAccountId: accountId,
    currentMemberId: membershipRows.find((row) => row.manager_id === session.managerId)?.id ?? null,
    invites,
    locations,
    members,
    usesLegacyAccountModel: membershipRows.length === 0,
  };
}

export async function GET(request: Request) {
  const context = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    return withRequestHeaders(NextResponse.json(await buildTeamPayload(session)), context);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, context);
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to load team access right now." }, { status: 500 }),
      context,
    );
  }
}

export async function POST(request: Request) {
  const context = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    const allowed = await canManageTeam(session);
    if (!allowed) {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot manage the team." }, { status: 403 }),
        context,
      );
    }

    const accountId = await getTeamAccountId(session);
    if (!accountId) {
      return withRequestHeaders(
        NextResponse.json({ error: "No team account is configured for this session." }, { status: 400 }),
        context,
      );
    }

    const body = (await request.json()) as {
      accessScope?: TeamAccessScope;
      email?: string;
      restaurantIds?: number[];
      role?: TeamRole;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const role = normalizeTeamRole(body.role ?? null);
    const accessScope = normalizeAccessScope(body.accessScope);
    const restaurantIds = Array.isArray(body.restaurantIds)
      ? [...new Set(body.restaurantIds.map((value) => Number(value)).filter(Number.isInteger))]
      : [];

    if (!email) {
      return withRequestHeaders(
        NextResponse.json({ error: "Email is required." }, { status: 400 }),
        context,
      );
    }

    if (!role) {
      return withRequestHeaders(
        NextResponse.json({ error: "A valid team role is required." }, { status: 400 }),
        context,
      );
    }

    if (accessScope === "selected_locations" && restaurantIds.length === 0) {
      return withRequestHeaders(
        NextResponse.json({ error: "Select at least one location for scoped access." }, { status: 400 }),
        context,
      );
    }

    const existingManager = await prisma.managers.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingManager) {
      const existingMembership = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT id
        FROM public.account_memberships_v2
        WHERE manager_id = ${existingManager.id}
          AND status = 'active'
        LIMIT 1
      `);

      if (existingMembership.length > 0) {
        return withRequestHeaders(
          NextResponse.json({ error: "That email already belongs to an active teammate." }, { status: 409 }),
          context,
        );
      }
    }

    const duplicateInvite = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT id
      FROM public.team_invitations_v2
      WHERE account_id = ${accountId}
        AND lower(email) = ${email}
        AND status = 'pending'
      LIMIT 1
    `);

    if (duplicateInvite.length > 0) {
      return withRequestHeaders(
        NextResponse.json({ error: "A pending invite already exists for that email." }, { status: 409 }),
        context,
      );
    }

    const validAccountLocations = new Set(
      (await listAccountLocations(accountId, session.managerId)).map((location) => location.id),
    );
    if (restaurantIds.some((restaurantId) => !validAccountLocations.has(restaurantId))) {
      return withRequestHeaders(
        NextResponse.json({ error: "One or more selected locations are invalid for this account." }, { status: 400 }),
        context,
      );
    }

    const inviteId = await prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        INSERT INTO public.team_invitations_v2 (
          account_id,
          email,
          team_role,
          access_scope,
          status,
          invite_token,
          invited_by,
          created_at,
          updated_at,
          expires_at
        )
        VALUES (
          ${accountId},
          ${email},
          ${role},
          ${accessScope},
          'pending',
          ${randomUUID()},
          ${session.managerId ?? null},
          now(),
          now(),
          now() + interval '14 days'
        )
        RETURNING id
      `);

      const nextInviteId = inserted[0]?.id;
      if (!nextInviteId) {
        throw new Error("Invite creation failed.");
      }

      if (restaurantIds.length > 0) {
        for (const restaurantId of restaurantIds) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO public.team_invitation_locations_v2 (
              invitation_id,
              restaurant_id,
              created_at
            )
            VALUES (${nextInviteId}, ${restaurantId}, now())
          `);
        }
      }

      await writeAuditLog(
        {
          action: "team_invite_created",
          actorUserId: session.managerId ?? null,
          entityId: String(nextInviteId),
          entityType: "team_invitations_v2",
          ipAddress: context.ipAddress,
          metadata: {
            accessScope,
            accountId,
            email,
            restaurantIds,
            role,
          },
          summary: `Created team invite for ${email}.`,
          userAgent: context.userAgent,
        },
        tx,
      );

      return nextInviteId;
    });

    return withRequestHeaders(
      NextResponse.json({ ok: true, inviteId, team: await buildTeamPayload(session) }),
      context,
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, context);
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to create the team invite right now." }, { status: 500 }),
      context,
    );
  }
}
