import { randomUUID } from "crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";

export type RequestContext = {
  ipAddress: string | null;
  requestId: string;
  userAgent: string | null;
};

function getTrustedClientIp(headerStore: Pick<Headers, "get">) {
  if (process.env.VERCEL !== "1") return null;
  const candidate = headerStore.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "";
  return isIP(candidate) ? candidate : null;
}

export function getRequestContextFromRequest(request: Request): RequestContext {
  const requestId =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim() ||
    randomUUID();
  const ipAddress = getTrustedClientIp(request.headers);
  const userAgent = request.headers.get("user-agent")?.trim() || null;

  return {
    ipAddress,
    requestId,
    userAgent,
  };
}

export async function getRequestContextFromHeaders(): Promise<RequestContext> {
  const headerStore = await headers();
  const requestId =
    headerStore.get("x-request-id")?.trim() ||
    headerStore.get("x-correlation-id")?.trim() ||
    randomUUID();
  const ipAddress = getTrustedClientIp(headerStore);
  const userAgent = headerStore.get("user-agent")?.trim() || null;

  return {
    ipAddress,
    requestId,
    userAgent,
  };
}

export function withRequestHeaders(response: Response, context: RequestContext) {
  response.headers.set("x-request-id", context.requestId);
  response.headers.set("x-correlation-id", context.requestId);
  return response;
}
