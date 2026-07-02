import { NextResponse } from "next/server";
import {
  getManagerSession,
  MANAGER_SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  const session = await getManagerSession();
  if (session) {
    await writeAuditLog({
      action: "logout",
      actorUserId: session.managerId ?? null,
      entityId: session.email,
      entityType: "auth_session",
      ipAddress: requestContext.ipAddress,
      metadata: {
        requestId: requestContext.requestId,
        role: session.role,
      },
      summary: `Logout completed for ${session.email}.`,
      userAgent: requestContext.userAgent,
    }).catch(() => null);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MANAGER_SESSION_COOKIE_NAME);
  return withRequestHeaders(response, requestContext);
}
