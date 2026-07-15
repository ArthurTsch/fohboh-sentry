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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
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

    const inviteId = Number((await params).inviteId);
    if (!Number.isInteger(inviteId)) {
      return withRequestHeaders(NextResponse.json({ error: "Invalid invite id." }, { status: 400 }), context);
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

    const inviteRows = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT id
      FROM public.team_invitations_v2
      WHERE id = ${inviteId}
        AND account_id = ${accountId}
        AND status = 'pending'
      LIMIT 1
    `);

    if (inviteRows.length === 0) {
      return withRequestHeaders(NextResponse.json({ error: "Invite not found." }, { status: 404 }), context);
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
        UPDATE public.team_invitations_v2
        SET
          team_role = ${role},
          access_scope = ${accessScope},
          updated_at = now()
        WHERE id = ${inviteId}
      `);

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.team_invitation_locations_v2
        WHERE invitation_id = ${inviteId}
      `);

      if (restaurantIds.length > 0) {
        for (const restaurantId of restaurantIds) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO public.team_invitation_locations_v2 (
              invitation_id,
              restaurant_id,
              created_at
            )
            VALUES (${inviteId}, ${restaurantId}, now())
          `);
        }
      }

      await writeAuditLog(
        {
          action: "team_invite_updated",
          actorUserId: session.managerId ?? null,
          entityId: String(inviteId),
          entityType: "team_invitations_v2",
          ipAddress: context.ipAddress,
          metadata: {
            accessScope,
            accountId,
            restaurantIds,
            role,
          },
          summary: `Updated team invite ${inviteId}.`,
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
      NextResponse.json({ error: "Unable to update this invite right now." }, { status: 500 }),
      context,
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
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

    const inviteId = Number((await params).inviteId);
    if (!Number.isInteger(inviteId)) {
      return withRequestHeaders(NextResponse.json({ error: "Invalid invite id." }, { status: 400 }), context);
    }

    const updated = await prisma.$executeRaw(Prisma.sql`
      UPDATE public.team_invitations_v2
      SET
        status = 'cancelled',
        cancelled_at = now(),
        updated_at = now()
      WHERE id = ${inviteId}
        AND account_id = ${accountId}
        AND status = 'pending'
    `);

    if (!updated) {
      return withRequestHeaders(NextResponse.json({ error: "Invite not found." }, { status: 404 }), context);
    }

    await writeAuditLog({
      action: "team_invite_cancelled",
      actorUserId: session.managerId ?? null,
      entityId: String(inviteId),
      entityType: "team_invitations_v2",
      ipAddress: context.ipAddress,
      metadata: {
        accountId,
      },
      summary: `Cancelled team invite ${inviteId}.`,
      userAgent: context.userAgent,
    });

    return withRequestHeaders(NextResponse.json({ ok: true }), context);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, context);
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to cancel this invite right now." }, { status: 500 }),
      context,
    );
  }
}
