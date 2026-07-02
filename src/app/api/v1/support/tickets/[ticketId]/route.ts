import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
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
  context: { params: Promise<{ ticketId: string }> },
) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (session.role !== "WGS Manager" && session.role !== "SuperAdmin" && session.role !== "Admin") {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot resolve support tickets." }, { status: 403 }),
        requestContext,
      );
    }

    const { ticketId } = await context.params;
    const ticket = await prisma.support_tickets_v2.update({
      where: {
        external_id: ticketId,
      },
      data: {
        resolved_at: new Date(),
        resolved_by: session.managerId ?? null,
        status: "resolved",
        updated_at: new Date(),
      },
      select: {
        external_id: true,
        issue: true,
      },
    });

    await writeAuditLog({
      action: "support_ticket_resolved",
      actorUserId: session.managerId ?? null,
      entityId: ticket.external_id,
      entityType: "support_tickets_v2",
      ipAddress: requestContext.ipAddress,
      metadata: {
        requestId: requestContext.requestId,
      },
      summary: `Resolved support ticket ${ticket.external_id}.`,
      userAgent: requestContext.userAgent,
    });

    return withRequestHeaders(NextResponse.json({ ok: true, ticket }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to resolve this support ticket right now." }, { status: 500 }),
      requestContext,
    );
  }
}
