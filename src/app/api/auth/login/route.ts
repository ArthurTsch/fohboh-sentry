import { NextResponse } from "next/server";
import { authenticateManager } from "@/lib/auth/manager-auth";
import {
  createSessionCookieValue,
  getSessionCookieOptions,
  MANAGER_SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { logServerError, logServerEvent, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import { checkRateLimit } from "@/lib/ops/rate-limit";

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const normalizedEmail = (body.email ?? "").trim().toLowerCase();
    const limiter = checkRateLimit({
      key: `login:${requestContext.ipAddress ?? "unknown"}:${normalizedEmail || "unknown"}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });

    if (!limiter.allowed) {
      const response = NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 },
      );
      response.headers.set("retry-after", String(Math.ceil((limiter.resetAt - Date.now()) / 1000)));
      return withRequestHeaders(response, requestContext);
    }

    const result = await authenticateManager(body.email ?? "", body.password ?? "");

    if (!result.ok) {
      await writeAuditLog({
        action: "login_failed",
        entityId: normalizedEmail || "unknown",
        entityType: "auth_session",
        ipAddress: requestContext.ipAddress,
        metadata: {
          reason: result.error,
          requestId: requestContext.requestId,
        },
        summary: `Login failed for ${normalizedEmail || "unknown email"}.`,
        userAgent: requestContext.userAgent,
      });
      const response = NextResponse.json({ error: result.error }, { status: result.status });
      return withRequestHeaders(response, requestContext);
    }

    await writeAuditLog({
      action: "login_succeeded",
      actorUserId: result.session.managerId ?? null,
      entityId: result.session.email,
      entityType: "auth_session",
      ipAddress: requestContext.ipAddress,
      metadata: {
        requestId: requestContext.requestId,
        role: result.session.role,
      },
      summary: `Login succeeded for ${result.session.email}.`,
      userAgent: requestContext.userAgent,
    });
    logServerEvent("auth_login_succeeded", {
      email: result.session.email,
      managerId: result.session.managerId ?? null,
      requestId: requestContext.requestId,
      role: result.session.role,
    });

    const response = NextResponse.json({ session: result.session });
    response.cookies.set(
      MANAGER_SESSION_COOKIE_NAME,
      createSessionCookieValue(result.session),
      getSessionCookieOptions(),
    );
    return withRequestHeaders(response, requestContext);
  } catch (error) {
    logServerError("auth_login_failed", error, {
      requestId: requestContext.requestId,
    });
    const response = NextResponse.json(
      { error: "Unable to complete login right now." },
      { status: 500 },
    );
    return withRequestHeaders(response, requestContext);
  }
}
