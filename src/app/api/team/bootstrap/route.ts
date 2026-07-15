import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { createSessionCookieValue, getSessionCookieOptions, MANAGER_SESSION_COOKIE_NAME, requireManagerSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/team-access";
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

export async function POST(request: Request) {
  const context = getRequestContextFromRequest(request);

  try {
    const session = await requireManagerSession();
    if (session.role !== "SuperAdmin") {
      return withRequestHeaders(
        NextResponse.json({ error: "Only SuperAdmin can bootstrap a customer owner account from this flow." }, { status: 403 }),
        context,
      );
    }

    if (typeof session.managerId !== "number") {
      return withRequestHeaders(
        NextResponse.json({ error: "This session is missing a manager identity." }, { status: 400 }),
        context,
      );
    }

    const body = (await request.json()) as {
      accountId?: string;
    };
    const accountId = String(body.accountId ?? "").trim();

    if (!accountId) {
      return withRequestHeaders(
        NextResponse.json({ error: "Account ID is required." }, { status: 400 }),
        context,
      );
    }

    if (!/^[A-Za-z0-9:_-]{3,255}$/.test(accountId)) {
      return withRequestHeaders(
        NextResponse.json({ error: "Account ID format is invalid." }, { status: 400 }),
        context,
      );
    }

    const existingMembership = await getActiveMembership(session.managerId);

    await prisma.$transaction(async (tx) => {
      if (existingMembership) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.account_memberships_v2
          SET
            account_id = ${accountId},
            team_role = 'Owner',
            access_scope = 'all_locations',
            status = 'active',
            account_holder = true,
            last_active_at = now(),
            updated_at = now()
          WHERE id = ${existingMembership.id}
        `);

        await writeAuditLog(
          {
            action: "team_owner_rebound",
            actorUserId: session.managerId,
            entityId: String(existingMembership.id),
            entityType: "account_memberships_v2",
            ipAddress: context.ipAddress,
            metadata: {
              nextAccountId: accountId,
              previousAccountId: existingMembership.account_id,
              role: session.role,
            },
            summary: `Rebound SuperAdmin owner membership from ${existingMembership.account_id} to ${accountId}.`,
            userAgent: context.userAgent,
          },
          tx,
        );
      } else {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public.account_memberships_v2 (
            manager_id,
            account_id,
            team_role,
            access_scope,
            status,
            account_holder,
            invited_by,
            invited_at,
            accepted_at,
            last_active_at,
            created_at,
            updated_at
          )
          VALUES (
            ${session.managerId},
            ${accountId},
            'Owner',
            'all_locations',
            'active',
            true,
            ${session.managerId},
            now(),
            now(),
            now(),
            now(),
            now()
          )
        `);

        await writeAuditLog(
          {
            action: "team_owner_bootstrapped",
            actorUserId: session.managerId,
            entityId: String(session.managerId),
            entityType: "account_memberships_v2",
            ipAddress: context.ipAddress,
            metadata: {
              accountId,
              role: session.role,
            },
            summary: `Bootstrapped SuperAdmin owner membership for ${accountId}.`,
            userAgent: context.userAgent,
          },
          tx,
        );
      }
    });

    const nextSession = {
      ...session,
      accountId,
      teamRole: "Owner" as const,
    };

    const response = NextResponse.json({
      ok: true,
      session: nextSession,
    });
    response.cookies.set(
      MANAGER_SESSION_COOKIE_NAME,
      createSessionCookieValue(nextSession),
      getSessionCookieOptions(),
    );

    return withRequestHeaders(response, context);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, context);
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to bootstrap the owner team account right now." }, { status: 500 }),
      context,
    );
  }
}
