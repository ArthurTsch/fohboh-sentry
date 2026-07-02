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
  context: { params: Promise<{ requestId: string }> },
) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (session.role !== "WGS Manager" && session.role !== "SuperAdmin" && session.role !== "Admin") {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot review access requests." }, { status: 403 }),
        requestContext,
      );
    }

    const { requestId } = await context.params;
    const updated = await prisma.access_requests_v2.update({
      where: {
        external_id: requestId,
      },
      data: {
        reviewed_at: new Date(),
        reviewed_by: session.managerId ?? null,
        status: "reviewed",
        updated_at: new Date(),
      },
      select: {
        company: true,
        external_id: true,
      },
    });

    await writeAuditLog({
      action: "access_request_reviewed",
      actorUserId: session.managerId ?? null,
      entityId: updated.external_id,
      entityType: "access_requests_v2",
      ipAddress: requestContext.ipAddress,
      metadata: {
        company: updated.company,
        requestId: requestContext.requestId,
      },
      summary: `Reviewed access request ${updated.external_id}.`,
      userAgent: requestContext.userAgent,
    });

    return withRequestHeaders(NextResponse.json({ ok: true, request: updated }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to review this access request right now." }, { status: 500 }),
      requestContext,
    );
  }
}
