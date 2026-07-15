import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import type { TeamAccessScope, TeamRole } from "@/components/sentry/types";
import { requireManagerSession } from "@/lib/auth/session";
import { canManageTeam, getTeamAccountId, listAccountLocations, normalizeAccessScope, normalizeTeamRole } from "@/lib/auth/team-access";
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

function mapTeamRoleToManagerRole(role: TeamRole) {
  switch (role) {
    case "Owner":
    case "Finance":
      return "Admin";
    case "Location Manager":
      return "Manager";
    case "Read-only":
      return "Viewer";
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const context = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (!(await canManageTeam(session))) {
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

    const memberId = Number((await params).memberId);
    if (!Number.isInteger(memberId)) {
      return withRequestHeaders(NextResponse.json({ error: "Invalid member id." }, { status: 400 }), context);
    }

    const body = (await request.json()) as {
      accessScope?: TeamAccessScope;
      restaurantIds?: number[];
      role?: TeamRole;
    };
    const role = normalizeTeamRole(body.role ?? null);
    const accessScope = normalizeAccessScope(body.accessScope);
    const restaurantIds = Array.isArray(body.restaurantIds)
      ? [...new Set(body.restaurantIds.map((value) => Number(value)).filter(Number.isInteger))]
      : [];

    if (!role) {
      return withRequestHeaders(NextResponse.json({ error: "A valid role is required." }, { status: 400 }), context);
    }

    if (accessScope === "selected_locations" && restaurantIds.length === 0) {
      return withRequestHeaders(
        NextResponse.json({ error: "Select at least one location for scoped access." }, { status: 400 }),
        context,
      );
    }

    const memberRows = await prisma.$queryRaw<Array<{ account_holder: boolean; manager_id: number }>>(Prisma.sql`
      SELECT manager_id, account_holder
      FROM public.account_memberships_v2
      WHERE id = ${memberId}
        AND account_id = ${accountId}
        AND status = 'active'
      LIMIT 1
    `);

    const member = memberRows[0];
    if (!member) {
      return withRequestHeaders(NextResponse.json({ error: "Team member not found." }, { status: 404 }), context);
    }

    if (member.account_holder && role !== "Owner") {
      return withRequestHeaders(
        NextResponse.json({ error: "The account holder must remain an Owner." }, { status: 400 }),
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

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.account_memberships_v2
        SET
          team_role = ${role},
          access_scope = ${accessScope},
          updated_at = now()
        WHERE id = ${memberId}
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.managers
        SET
          role = ${mapTeamRoleToManagerRole(role)},
          updated_at = now()
        WHERE id = ${member.manager_id}
      `);

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.account_member_locations_v2
        WHERE membership_id = ${memberId}
      `);

      if (restaurantIds.length > 0) {
        for (const restaurantId of restaurantIds) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO public.account_member_locations_v2 (
              membership_id,
              restaurant_id,
              created_at
            )
            VALUES (${memberId}, ${restaurantId}, now())
          `);
        }
      }

      await writeAuditLog(
        {
          action: "team_member_updated",
          actorUserId: session.managerId ?? null,
          entityId: String(memberId),
          entityType: "account_memberships_v2",
          ipAddress: context.ipAddress,
          metadata: {
            accessScope,
            accountId,
            restaurantIds,
            role,
          },
          summary: `Updated team member ${memberId}.`,
          userAgent: context.userAgent,
        },
        tx,
      );
    });

    return withRequestHeaders(NextResponse.json({ ok: true }), context);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, context);
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to update this team member right now." }, { status: 500 }),
      context,
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const context = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (!(await canManageTeam(session))) {
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

    const memberId = Number((await params).memberId);
    if (!Number.isInteger(memberId)) {
      return withRequestHeaders(NextResponse.json({ error: "Invalid member id." }, { status: 400 }), context);
    }

    const memberRows = await prisma.$queryRaw<Array<{ account_holder: boolean; manager_id: number }>>(Prisma.sql`
      SELECT manager_id, account_holder
      FROM public.account_memberships_v2
      WHERE id = ${memberId}
        AND account_id = ${accountId}
        AND status = 'active'
      LIMIT 1
    `);

    const member = memberRows[0];
    if (!member) {
      return withRequestHeaders(NextResponse.json({ error: "Team member not found." }, { status: 404 }), context);
    }

    if (member.account_holder) {
      return withRequestHeaders(
        NextResponse.json({ error: "The account holder cannot be revoked." }, { status: 400 }),
        context,
      );
    }

    if (member.manager_id === session.managerId) {
      return withRequestHeaders(
        NextResponse.json({ error: "You cannot revoke your own access." }, { status: 400 }),
        context,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.account_memberships_v2
        SET
          status = 'revoked',
          revoked_at = now(),
          updated_at = now()
        WHERE id = ${memberId}
      `);

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.account_member_locations_v2
        WHERE membership_id = ${memberId}
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.managers
        SET
          active = false,
          updated_at = now()
        WHERE id = ${member.manager_id}
      `);

      await writeAuditLog(
        {
          action: "team_member_revoked",
          actorUserId: session.managerId ?? null,
          entityId: String(memberId),
          entityType: "account_memberships_v2",
          ipAddress: context.ipAddress,
          metadata: {
            accountId,
            managerId: member.manager_id,
          },
          summary: `Revoked team member ${memberId}.`,
          userAgent: context.userAgent,
        },
        tx,
      );
    });

    return withRequestHeaders(NextResponse.json({ ok: true }), context);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, context);
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to revoke this team member right now." }, { status: 500 }),
      context,
    );
  }
}
