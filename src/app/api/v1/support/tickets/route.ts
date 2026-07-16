import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import type { SupportTicketCategory, SupportTicketRecord, SupportTicketUrgency } from "@/components/sentry/types";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";
import { prepareSupportTicketEmail } from "@/lib/support/email";
import {
  getSupportTicketPriority,
  normalizeEmailDeliveryStatus,
  normalizeTicketStatus,
  parseSupportTicketIssue,
  serializeSupportTicketIssue,
  type SupportTicketDraft,
} from "@/lib/support/tickets";

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
    const url = new URL(request.url);
    const queueMode = url.searchParams.get("queue") === "1";
    const accountId = session.accountId?.trim() || null;

    if (queueMode && session.role !== "WGS Manager" && session.role !== "SuperAdmin" && session.role !== "Admin") {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot view the support queue." }, { status: 403 }),
        requestContext,
      );
    }

    const tickets = await prisma.support_tickets_v2.findMany({
      where: {
        ...(queueMode
          ? {
              status: {
                in: ["open", "in_review", "waiting_on_customer"],
              },
            }
          : {
              OR: [
                ...(accountId ? [{ account_id: accountId }] : []),
                ...(typeof session.managerId === "number" ? [{ created_by: session.managerId }] : []),
                { requester_email: session.email },
              ],
            }),
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        account_id: true,
        created_at: true,
        external_id: true,
        issue: true,
        location_id: true,
        priority: true,
        requester_email: true,
        requester_name: true,
        requester_role: true,
        resolved_at: true,
        source: true,
        status: true,
        updated_at: true,
      },
    });

    const mappedTickets = tickets.map<SupportTicketRecord>((ticket) => {
      const parsed = parseSupportTicketIssue(ticket.issue);
      return {
        accountId: ticket.account_id ?? null,
        accountName: ticket.account_id ?? "Portfolio",
        category: parsed.category,
        createdAt: ticket.created_at?.toISOString() ?? null,
        description: parsed.description,
        emailDelivery: normalizeEmailDeliveryStatus(
          ticket.source === "support_ticket_portal_email_ready" ? "prepared" : "not_configured",
        ),
        id: ticket.external_id,
        lastUpdatedAt: ticket.updated_at?.toISOString() ?? ticket.resolved_at?.toISOString() ?? null,
        locationId: ticket.location_id ?? null,
        locationName: parsed.locationName,
        priority: normalizePriority(ticket.priority),
        requesterEmail: ticket.requester_email,
        requesterName: ticket.requester_name ?? null,
        requesterRole: ticket.requester_role ?? null,
        status: normalizeTicketStatus(ticket.status),
        subject: parsed.subject,
        urgency: parsed.urgency,
        workflow: parsed.workflow,
      };
    });

    return withRequestHeaders(
      NextResponse.json({
        tickets: mappedTickets,
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
      category?: SupportTicketCategory | null;
      description?: string | null;
      locationId?: string | null;
      locationName?: string | null;
      subject?: string | null;
      urgency?: SupportTicketUrgency | null;
      workflow?: string | null;
    };

    const subject = body.subject?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    if (!subject) {
      return withRequestHeaders(
        NextResponse.json({ error: "Ticket subject is required." }, { status: 400 }),
        requestContext,
      );
    }
    if (!description) {
      return withRequestHeaders(
        NextResponse.json({ error: "Ticket description is required." }, { status: 400 }),
        requestContext,
      );
    }

    const draft: SupportTicketDraft = {
      accountId: body.accountId?.trim() || session.accountId || null,
      accountName: body.accountName?.trim() || null,
      category: normalizeCategory(body.category),
      description,
      locationId: body.locationId?.trim() || null,
      locationName: body.locationName?.trim() || null,
      requesterEmail: session.email,
      requesterName: session.name ?? null,
      requesterRole: session.role,
      subject,
      urgency: normalizeUrgency(body.urgency),
      workflow: body.workflow?.trim() || null,
    };
    const externalId = `TCK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const priority = getSupportTicketPriority(draft);
    const emailDispatch = await prepareSupportTicketEmail(externalId, draft);

    const created = await prisma.support_tickets_v2.create({
      data: {
        account_id: draft.accountId,
        created_by: session.managerId ?? null,
        external_id: externalId,
        issue: serializeSupportTicketIssue(draft),
        location_id: draft.locationId,
        priority,
        requester_email: session.email,
        requester_name: session.name ?? null,
        requester_role: session.role,
        source:
          emailDispatch.delivery === "not_configured"
            ? "support_ticket_portal"
            : "support_ticket_portal_email_ready",
        status: "open",
        updated_at: new Date(),
      },
      select: {
        account_id: true,
        created_at: true,
        external_id: true,
        issue: true,
        location_id: true,
        priority: true,
        requester_email: true,
        requester_name: true,
        requester_role: true,
        status: true,
        updated_at: true,
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
        category: draft.category,
        emailDelivery: emailDispatch.delivery,
        locationId: draft.locationId,
        requestId: requestContext.requestId,
        subject: draft.subject,
        workflow: draft.workflow,
      }),
      summary: `Created support ticket ${created.external_id}.`,
      userAgent: requestContext.userAgent,
    });

    const parsed = parseSupportTicketIssue(created.issue);
    return withRequestHeaders(
      NextResponse.json({
        ticket: {
          accountId: created.account_id ?? null,
          accountName: draft.accountName?.trim() || created.account_id || "Portfolio",
          category: parsed.category,
          createdAt: created.created_at?.toISOString() ?? null,
          description: parsed.description,
          emailDelivery: emailDispatch.delivery,
          id: created.external_id,
          lastUpdatedAt: created.updated_at?.toISOString() ?? null,
          locationId: created.location_id ?? null,
          locationName: parsed.locationName,
          priority: normalizePriority(created.priority),
          requesterEmail: created.requester_email,
          requesterName: created.requester_name ?? null,
          requesterRole: created.requester_role ?? null,
          status: normalizeTicketStatus(created.status),
          subject: parsed.subject,
          urgency: parsed.urgency,
          workflow: parsed.workflow,
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

function normalizeCategory(value: SupportTicketCategory | null | undefined): SupportTicketCategory {
  return (
    value === "Certification" ||
    value === "Upload / Schema" ||
    value === "Team & Access" ||
    value === "Billing" ||
    value === "Account / Login" ||
    value === "Other"
  )
    ? value
    : "Other";
}

function normalizeUrgency(value: SupportTicketUrgency | null | undefined): SupportTicketUrgency {
  return value === "Low" || value === "Medium" || value === "High" || value === "Critical"
    ? value
    : "Medium";
}
