import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

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

export async function GET(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    if (session.role !== "WGS Manager" && session.role !== "SuperAdmin" && session.role !== "Admin") {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot view access requests." }, { status: 403 }),
        requestContext,
      );
    }

    const requests = await prisma.access_requests_v2.findMany({
      where: {
        status: "pending",
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        company: true,
        external_id: true,
        module_plan: true,
        modules: true,
        monthly_volume: true,
        processors: true,
        dsps: true,
        requester_email: true,
        requester_name: true,
        locations: true,
      },
    });

    return withRequestHeaders(
      NextResponse.json({
        requests: requests.map((item) => ({
          account: item.company,
          id: item.external_id,
          summary: buildApprovalSummary(item),
          type: "Access Request",
        })),
      }),
      requestContext,
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }
    logServerError("access_requests_fetch_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to load access requests right now." }, { status: 500 }),
      requestContext,
    );
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const body = (await request.json()) as {
      company?: string;
      dsps?: string[];
      email?: string;
      locations?: string;
      modulePlan?: "bundle" | "m01" | "m02";
      modules?: string[];
      monthlyVolume?: string;
      name?: string;
      notes?: string;
      phone?: string;
      processors?: string[];
    };

    if (!body.company?.trim() || !body.email?.trim()) {
      return withRequestHeaders(
        NextResponse.json({ error: "Company and email are required." }, { status: 400 }),
        requestContext,
      );
    }

    const created = await prisma.access_requests_v2.create({
      data: {
        company: body.company.trim(),
        dsps: toJsonValue(body.dsps ?? []),
        external_id: `APR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        locations: body.locations?.trim() || null,
        module_plan: body.modulePlan ?? "bundle",
        modules: toJsonValue(body.modules ?? []),
        monthly_volume: body.monthlyVolume?.trim() || null,
        notes: body.notes?.trim() || null,
        phone: body.phone?.trim() || null,
        processors: toJsonValue(body.processors ?? []),
        requester_email: body.email.trim(),
        requester_name: body.name?.trim() || null,
        status: "pending",
        updated_at: new Date(),
      },
      select: {
        company: true,
        external_id: true,
        module_plan: true,
        modules: true,
        monthly_volume: true,
        processors: true,
        dsps: true,
        requester_email: true,
        requester_name: true,
        locations: true,
      },
    });

    await writeAuditLog({
      action: "access_request_created",
      entityId: created.external_id,
      entityType: "access_requests_v2",
      ipAddress: requestContext.ipAddress,
      metadata: toJsonValue({
        company: created.company,
        requestId: requestContext.requestId,
      }),
      summary: `Created access request ${created.external_id} for ${created.company}.`,
      userAgent: requestContext.userAgent,
    });

    return withRequestHeaders(
      NextResponse.json({
        request: {
          account: created.company,
          id: created.external_id,
          summary: buildApprovalSummary(created),
          type: "Access Request",
        },
      }),
      requestContext,
    );
  } catch (error) {
    logServerError("access_request_create_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to submit the access request right now." }, { status: 500 }),
      requestContext,
    );
  }
}

function buildApprovalSummary(item: {
  dsps: unknown;
  locations: string | null;
  module_plan: string;
  modules: unknown;
  monthly_volume: string | null;
  processors: unknown;
  requester_email: string;
  requester_name: string | null;
}) {
  const modules = Array.isArray(item.modules) ? item.modules.join(" + ") : "";
  const processors = Array.isArray(item.processors) ? item.processors.join(", ") : "";
  const dsps = Array.isArray(item.dsps) ? item.dsps.join(", ") : "";
  const scopeDetails = [
    item.locations ? `${item.locations} locations` : null,
    processors ? `processors: ${processors}` : null,
    dsps ? `DSPs: ${dsps}` : null,
    item.monthly_volume ? `volume: ${item.monthly_volume}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return `${item.requester_name || item.requester_email} requested ${modules} via ${item.module_plan}.${scopeDetails ? ` ${scopeDetails}.` : ""}`;
}
