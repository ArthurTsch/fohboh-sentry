import { randomUUID } from "crypto";
import { headers } from "next/headers";

export type RequestContext = {
  ipAddress: string | null;
  requestId: string;
  userAgent: string | null;
};

export function getRequestContextFromRequest(request: Request): RequestContext {
  const requestId =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim() ||
    randomUUID();
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null;
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
  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    null;
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
