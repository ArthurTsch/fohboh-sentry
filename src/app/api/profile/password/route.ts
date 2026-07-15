import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { requireManagerSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";

function unauthorizedResponse(requestId: string) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });
}

export async function POST(request: Request) {
  const context = getRequestContextFromRequest(request);

  try {
    const session = await requireManagerSession();
    const body = (await request.json()) as {
      confirmPassword?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return withRequestHeaders(
        NextResponse.json({ error: "All password fields are required." }, { status: 400 }),
        context,
      );
    }

    if (newPassword.length < 8) {
      return withRequestHeaders(
        NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 }),
        context,
      );
    }

    if (newPassword !== confirmPassword) {
      return withRequestHeaders(
        NextResponse.json({ error: "New password confirmation does not match." }, { status: 400 }),
        context,
      );
    }

    const manager = await prisma.managers.findUnique({
      where: { id: session.managerId ?? -1 },
      select: { email: true, password_hash: true },
    });

    if (!manager) {
      return unauthorizedResponse(context.requestId);
    }

    const valid = await compare(currentPassword, manager.password_hash);
    if (!valid) {
      return withRequestHeaders(
        NextResponse.json({ error: "Current password is incorrect." }, { status: 400 }),
        context,
      );
    }

    const nextHash = await hash(newPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.managers
        SET
          password_hash = ${nextHash},
          updated_at = now()
        WHERE id = ${session.managerId ?? -1}
      `);

      await writeAuditLog(
        {
          action: "password_updated",
          actorUserId: session.managerId ?? null,
          entityId: String(session.managerId ?? session.email),
          entityType: "managers",
          ipAddress: context.ipAddress,
          metadata: {
            requestId: context.requestId,
          },
          summary: `Updated password for ${manager.email}.`,
          userAgent: context.userAgent,
        },
        tx,
      );
    });

    return withRequestHeaders(NextResponse.json({ ok: true }), context);
  } catch {
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to update password right now." }, { status: 500 }),
      context,
    );
  }
}
