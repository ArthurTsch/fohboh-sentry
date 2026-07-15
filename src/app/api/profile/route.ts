import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { createSessionCookieValue, getSessionCookieOptions, MANAGER_SESSION_COOKIE_NAME, requireManagerSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/team-access";
import { writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";

function unauthorizedResponse(requestId: string) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });
}

export async function GET(request: Request) {
  const context = getRequestContextFromRequest(request);

  try {
    const session = await requireManagerSession();
    const rows = await prisma.$queryRaw<
      Array<{
        email: string;
        full_name: string | null;
        notify_access_changes: boolean;
        notify_caar_certified: boolean;
        notify_statement_due: boolean;
        notify_trust_score_blocked: boolean;
        notify_weekly_digest: boolean;
        phone_number: string | null;
        title: string | null;
        two_factor_enabled: boolean;
        two_factor_method: string;
      }>
    >(Prisma.sql`
      SELECT
        email,
        full_name,
        phone_number,
        title,
        two_factor_enabled,
        two_factor_method,
        notify_caar_certified,
        notify_trust_score_blocked,
        notify_statement_due,
        notify_weekly_digest,
        notify_access_changes
      FROM public.managers
      WHERE id = ${session.managerId ?? -1}
      LIMIT 1
    `);
    const manager = rows[0];

    if (!manager) {
      return unauthorizedResponse(context.requestId);
    }

    return withRequestHeaders(
      NextResponse.json({
        profile: {
          accountId: session.accountId,
          email: manager.email,
          fullName: manager.full_name ?? "",
          notifications: {
            accessChanges: manager.notify_access_changes,
            caarCertified: manager.notify_caar_certified,
            statementDue: manager.notify_statement_due,
            trustScoreBlocked: manager.notify_trust_score_blocked,
            weeklyDigest: manager.notify_weekly_digest,
          },
          phoneNumber: manager.phone_number ?? "",
          role: session.role,
          title: manager.title ?? "",
          twoFactorEnabled: manager.two_factor_enabled,
          twoFactorMethod: manager.two_factor_method,
        },
      }),
      context,
    );
  } catch {
    return unauthorizedResponse(context.requestId);
  }
}

export async function PATCH(request: Request) {
  const context = getRequestContextFromRequest(request);

  try {
    const session = await requireManagerSession();
    const body = (await request.json()) as {
      email?: string;
      fullName?: string;
      notifications?: {
        accessChanges?: boolean;
        caarCertified?: boolean;
        statementDue?: boolean;
        trustScoreBlocked?: boolean;
        weeklyDigest?: boolean;
      };
      phoneNumber?: string;
      title?: string;
    };

    const existing = await prisma.managers.findUnique({
      where: { id: session.managerId ?? -1 },
      select: { email: true },
    });

    if (!existing) {
      return unauthorizedResponse(context.requestId);
    }

    const nextEmail = String(body.email ?? existing.email).trim();
    const nextFullName = String(body.fullName ?? "").trim();
    const nextPhone = String(body.phoneNumber ?? "").trim();
    const nextTitle = String(body.title ?? "").trim();
    const oldEmail = existing.email;
    const emailChanged = nextEmail.toLowerCase() !== oldEmail.toLowerCase();
    const membership = await getActiveMembership(session.managerId);
    const nextAccountId = membership?.account_id ?? session.accountId ?? null;
    const oldAccountId = membership?.account_id ?? session.accountId ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.managers
        SET
          email = ${nextEmail},
          full_name = ${nextFullName || null},
          phone_number = ${nextPhone || null},
          title = ${nextTitle || null},
          notify_access_changes = ${body.notifications?.accessChanges ?? true},
          notify_caar_certified = ${body.notifications?.caarCertified ?? true},
          notify_statement_due = ${body.notifications?.statementDue ?? true},
          notify_trust_score_blocked = ${body.notifications?.trustScoreBlocked ?? true},
          notify_weekly_digest = ${body.notifications?.weeklyDigest ?? false},
          updated_at = now()
        WHERE id = ${session.managerId ?? -1}
      `);

      if (emailChanged && !membership && oldAccountId && nextAccountId) {
        await tx.caar_reports.updateMany({
          where: { account_id: oldAccountId },
          data: { account_id: nextAccountId },
        });
        await tx.restaurant_sentry_state.updateMany({
          where: { account_id: oldAccountId },
          data: { account_id: nextAccountId },
        });
        await tx.support_tickets_v2.updateMany({
          where: { account_id: oldAccountId },
          data: { account_id: nextAccountId },
        });
      }

      await writeAuditLog(
        {
          action: "profile_updated",
          actorUserId: session.managerId ?? null,
          entityId: String(session.managerId ?? session.email),
          entityType: "managers",
          ipAddress: context.ipAddress,
          metadata: {
            changedEmail: emailChanged,
            nextEmail,
            requestId: context.requestId,
          },
          summary: `Updated profile settings for ${nextEmail}.`,
          userAgent: context.userAgent,
        },
        tx,
      );
    });

    const response = NextResponse.json({
      ok: true,
      session: {
        ...session,
        accountId: nextAccountId,
        email: nextEmail,
        name: nextFullName || undefined,
      },
    });
    response.headers.set("x-request-id", context.requestId);
    response.headers.set("x-correlation-id", context.requestId);

    response.cookies.set(
      MANAGER_SESSION_COOKIE_NAME,
      createSessionCookieValue({
        ...session,
        accountId: nextAccountId,
        email: nextEmail,
        name: nextFullName || undefined,
      }),
      getSessionCookieOptions(),
    );

    return response;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return withRequestHeaders(
        NextResponse.json({ error: "That email is already in use." }, { status: 409 }),
        context,
      );
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to save profile settings right now." }, { status: 500 }),
      context,
    );
  }
}
