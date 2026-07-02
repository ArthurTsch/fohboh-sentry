import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function getPriority(issue: string) {
  const normalized = issue.toLowerCase();
  if (
    normalized.includes("trust score") ||
    normalized.includes("certification") ||
    normalized.includes("failed") ||
    normalized.includes("blocked")
  ) {
    return "High" as const;
  }
  if (normalized.includes("upload") || normalized.includes("schema")) {
    return "Medium" as const;
  }
  return "Low" as const;
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
        NextResponse.json({ error: "This account cannot view support tickets." }, { status: 403 }),
        requestContext,
      );
    }

    const tickets = await prisma.support_tickets_v2.findMany({
      where: {
        status: "open",
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        account_id: true,
        created_at: true,
        external_id: true,
        issue: true,
        priority: true,
      },
    });

    return withRequestHeaders(
      NextResponse.json({
        tickets: tickets.map((ticket) => ({
          account: ticket.account_id ?? "Portfolio",
          age: formatAge(ticket.created_at),
          id: ticket.external_id,
          issue: ticket.issue,
          priority: normalizePriority(ticket.priority),
        })),
      }),
      requestContext,
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }
    logServerError("support_tickets_fetch_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to load support tickets right now." }, { status: 500 }),
      requestContext,
    );
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    const body = (await request.json()) as {
      accountId?: string | null;
      accountName?: string | null;
      issue?: string | null;
      locationId?: string | null;
    };

    const issue = body.issue?.trim() ?? "";
    if (!issue) {
      return withRequestHeaders(
        NextResponse.json({ error: "Support ticket message is required." }, { status: 400 }),
        requestContext,
      );
    }

    const created = await prisma.support_tickets_v2.create({
      data: {
        account_id: body.accountId?.trim() || session.accountId || null,
        created_by: session.managerId ?? null,
        external_id: `TCK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        issue,
        location_id: body.locationId?.trim() || null,
        priority: getPriority(issue),
        requester_email: session.email,
        requester_name: session.name ?? null,
        requester_role: session.role,
        source: "support_chat",
        status: "open",
        updated_at: new Date(),
      },
      select: {
        account_id: true,
        created_at: true,
        external_id: true,
        issue: true,
        priority: true,
      },
    });

    await writeAuditLog({
      action: "support_ticket_created",
      actorUserId: session.managerId ?? null,
      entityId: created.external_id,
      entityType: "support_tickets_v2",
      ipAddress: requestContext.ipAddress,
      metadata: toJsonValue({
        accountId: created.account_id,
        requestId: requestContext.requestId,
      }),
      summary: `Created support ticket ${created.external_id}.`,
      userAgent: requestContext.userAgent,
    });

    return withRequestHeaders(
      NextResponse.json({
        ticket: {
          account: body.accountName?.trim() || created.account_id || "Portfolio",
          age: formatAge(created.created_at),
          id: created.external_id,
          issue: created.issue,
          priority: normalizePriority(created.priority),
        },
      }),
      requestContext,
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }
    logServerError("support_ticket_create_failed", error, {
      requestId: requestContext.requestId,
    });
    return withRequestHeaders(
      NextResponse.json({ error: "Unable to create support ticket right now." }, { status: 500 }),
      requestContext,
    );
  }
}

function formatAge(createdAt: Date | null) {
  if (!createdAt) return "Now";
  const diffMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60)),
  );
  if (diffMinutes < 60) return diffMinutes <= 1 ? "Now" : `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

function normalizePriority(value: string): "High" | "Medium" | "Low" {
  return value === "High" || value === "Medium" || value === "Low" ? value : "Medium";
}
