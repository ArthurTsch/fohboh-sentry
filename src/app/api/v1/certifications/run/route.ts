import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import { checkRateLimit } from "@/lib/ops/rate-limit";
import { executePersistedCertification } from "@/lib/certification/service";

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

function isMissingCertificationSchema(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (session.role === "Viewer") {
      return withRequestHeaders(NextResponse.json(
        { error: "This account cannot run certifications." },
        { status: 403 },
      ), requestContext);
    }
    const limiter = checkRateLimit({
      key: `certification:${session.managerId ?? session.email}:${requestContext.ipAddress ?? "unknown"}`,
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      const response = NextResponse.json(
        { error: "Certification rate limit reached. Try again later." },
        { status: 429 },
      );
      response.headers.set("retry-after", String(Math.ceil((limiter.resetAt - Date.now()) / 1000)));
      return withRequestHeaders(response, requestContext);
    }

    const body = (await request.json()) as {
      cadence?: "monthly_final" | "weekly_preliminary" | null;
      locationId?: string | null;
      modules?: Array<"M01" | "M02"> | null;
    };
    const locationId = body.locationId?.trim() ?? "";
    const cadence =
      body.cadence === "weekly_preliminary" ? "weekly_preliminary" : "monthly_final";
    const modules = Array.isArray(body.modules)
      ? [...new Set(body.modules.filter((item): item is "M01" | "M02" => item === "M01" || item === "M02"))]
      : undefined;
    if (!locationId) {
      return withRequestHeaders(NextResponse.json({ error: "locationId is required." }, { status: 400 }), requestContext);
    }

    const result = await executePersistedCertification({
      cadence,
      locationId,
      modules,
      session,
    });

    return withRequestHeaders(NextResponse.json({
      certification: {
        cadence: result.certification.cadence,
        ready: result.certification.ready,
        record: result.record,
        status: result.certification.status,
        steps: result.certification.steps,
        trustScore: result.certification.trustScore,
        updatedModules: result.certification.updatedModules,
        updatedRecovery: result.certification.updatedRecovery,
      },
      persisted: {
        caarId: result.generatedCaarId,
        certRunIds: result.runIds,
      },
      location: {
        id: result.restaurant.locationId,
        lastCertified: result.restaurantStateUpdate.lastCertified,
        m01: result.restaurantStateUpdate.m01Score,
        m02: result.restaurantStateUpdate.m02Score,
        modules: result.restaurantStateUpdate.modules,
        recovery: result.restaurantStateUpdate.recoveryDisplay,
        status: result.restaurantStateUpdate.status,
      },
    }), requestContext);
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }

    if (error instanceof Error) {
      if (
        error.message === "Location not found." ||
        error.message.startsWith("Certification cannot run yet:") ||
        error.message.includes("missing an account assignment") ||
        error.message.includes("no active certification modules configured") ||
        error.message.includes("requested modules are enabled") ||
        error.message.includes("missing a database-backed manager identity")
      ) {
        return withRequestHeaders(NextResponse.json({ error: error.message }, { status: 409 }), requestContext);
      }
    }

    if (isMissingCertificationSchema(error)) {
      return withRequestHeaders(NextResponse.json(
        {
          error:
            "The production certification tables are not available yet. Apply the Phase 2-4 migrations before running server-side certifications.",
        },
        { status: 503 },
      ), requestContext);
    }

    logServerError("certification_run_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(NextResponse.json(
      { error: "Unable to run certification right now." },
      { status: 500 },
    ), requestContext);
  }
}
