import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import type {
  SupportTicketAttachment,
  SupportTicketCategory,
  SupportTicketRecord,
  SupportTicketUrgency,
} from "@/components/sentry/types";
import { requireManagerSession } from "@/lib/auth/session";
import { logServerError, writeAuditLog } from "@/lib/ops/audit";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";
import { prepareSupportTicketEmail } from "@/lib/support/email";
import {
  canManageSupportTickets,
  getSupportTicketAccountId,
  getSupportTicketScope,
} from "@/lib/support/authorization";
import {
  getSupportTicketPriority,
  normalizeEmailDeliveryStatus,
  normalizeTicketStatus,
  parseSupportTicketIssue,
  serializeSupportTicketIssue,
  type SupportTicketDraft,
} from "@/lib/support/tickets";
import { persistUploadBlob } from "@/lib/uploads/storage";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

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

function toPublicAttachment(attachment: SupportTicketAttachment): SupportTicketAttachment {
  return {
    contentType: attachment.contentType,
    id: attachment.id,
    name: attachment.name,
    sizeBytes: attachment.sizeBytes,
  };
}

function mapTicketRecord(params: {
  accountId: string | null;
  accountName: string | null;
  createdAt: Date | null;
  externalId: string;
  issue: string;
  locationId: string | null;
  priority: string;
  requesterEmail: string;
  requesterName: string | null;
  requesterRole: string | null;
  resolvedAt?: Date | null;
  source: string;
  status: string;
  updatedAt: Date | null;
}): SupportTicketRecord {
  const parsed = parseSupportTicketIssue(params.issue);
  return {
    accountId: params.accountId,
    accountName: params.accountName?.trim() || "Portfolio",
    attachments: parsed.attachments.map(toPublicAttachment),
    category: parsed.category,
    createdAt: params.createdAt?.toISOString() ?? null,
    description: parsed.description,
    emailDelivery: normalizeEmailDeliveryStatus(
      params.source === "support_ticket_portal_email_ready" ? "prepared" : "not_configured",
    ),
    id: params.externalId,
    lastUpdatedAt: params.updatedAt?.toISOString() ?? params.resolvedAt?.toISOString() ?? null,
    locationId: params.locationId,
    locationName: parsed.locationName,
    priority: normalizePriority(params.priority),
    requesterEmail: params.requesterEmail,
    requesterName: params.requesterName,
    requesterRole: params.requesterRole,
    status: normalizeTicketStatus(params.status),
    subject: parsed.subject,
    urgency: parsed.urgency,
    workflow: parsed.workflow,
  };
}

export async function GET(request: Request) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    const url = new URL(request.url);
    const queueMode = url.searchParams.get("queue") === "1";

    if (queueMode && !canManageSupportTickets(session)) {
      return withRequestHeaders(
        NextResponse.json({ error: "This account cannot view the support queue." }, { status: 403 }),
        requestContext,
      );
    }

    const tickets = await prisma.support_tickets_v2.findMany({
      where: {
        AND: [
          getSupportTicketScope(session),
          ...(queueMode
            ? [{ status: { in: ["open", "in_review", "waiting_on_customer"] } }]
            : []),
        ],
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

    const mappedTickets = tickets.map((ticket) =>
      mapTicketRecord({
        accountId: ticket.account_id ?? null,
        accountName: ticket.account_id,
        createdAt: ticket.created_at ?? null,
        externalId: ticket.external_id,
        issue: ticket.issue,
        locationId: ticket.location_id ?? null,
        priority: ticket.priority,
        requesterEmail: ticket.requester_email,
        requesterName: ticket.requester_name ?? null,
        requesterRole: ticket.requester_role ?? null,
        resolvedAt: ticket.resolved_at ?? null,
        source: ticket.source,
        status: ticket.status,
        updatedAt: ticket.updated_at ?? null,
      }),
    );

    return withRequestHeaders(NextResponse.json({ tickets: mappedTickets }), requestContext);
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
    const contentType = request.headers.get("content-type") || "";
    const externalId = `TCK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const parsed =
      contentType.includes("multipart/form-data")
        ? await parseMultipartTicketRequest(request, externalId, session.accountId || null)
        : await parseJsonTicketRequest(request, session.accountId || null);
    parsed.accountId = getSupportTicketAccountId(session, parsed.accountId);

    if (!parsed.subject) {
      return withRequestHeaders(
        NextResponse.json({ error: "Ticket subject is required." }, { status: 400 }),
        requestContext,
      );
    }
    if (!parsed.description) {
      return withRequestHeaders(
        NextResponse.json({ error: "Ticket description is required." }, { status: 400 }),
        requestContext,
      );
    }

    const draft: SupportTicketDraft = {
      accountId: parsed.accountId,
      accountName: parsed.accountName,
      attachments: parsed.attachments,
      category: parsed.category,
      description: parsed.description,
      locationId: parsed.locationId,
      locationName: parsed.locationName,
      requesterEmail: session.email,
      requesterName: session.name ?? null,
      requesterRole: session.role,
      subject: parsed.subject,
      urgency: parsed.urgency,
      workflow: parsed.workflow,
    };

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
        source: true,
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
        attachmentCount: draft.attachments.length,
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

    return withRequestHeaders(
      NextResponse.json({
        ticket: mapTicketRecord({
          accountId: created.account_id ?? null,
          accountName: draft.accountName || created.account_id,
          createdAt: created.created_at ?? null,
          externalId: created.external_id,
          issue: created.issue,
          locationId: created.location_id ?? null,
          priority: created.priority,
          requesterEmail: created.requester_email,
          requesterName: created.requester_name ?? null,
          requesterRole: created.requester_role ?? null,
          source: created.source,
          status: created.status,
          updatedAt: created.updated_at ?? null,
        }),
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
      NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create support ticket right now." }, { status: 500 }),
      requestContext,
    );
  }
}

async function parseJsonTicketRequest(request: Request, fallbackAccountId: string | null) {
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

  return {
    accountId: body.accountId?.trim() || fallbackAccountId,
    accountName: body.accountName?.trim() || null,
    attachments: [] as SupportTicketAttachment[],
    category: normalizeCategory(body.category),
    description: body.description?.trim() ?? "",
    locationId: body.locationId?.trim() || null,
    locationName: body.locationName?.trim() || null,
    subject: body.subject?.trim() ?? "",
    urgency: normalizeUrgency(body.urgency),
    workflow: body.workflow?.trim() || null,
  };
}

async function parseMultipartTicketRequest(request: Request, externalId: string, fallbackAccountId: string | null) {
  const formData = await request.formData();
  const files = formData
    .getAll("attachments")
    .filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File);

  if (files.length > MAX_ATTACHMENTS) {
    throw new Error(`A support ticket can include at most ${MAX_ATTACHMENTS} attachments.`);
  }

  const attachments = await Promise.all(
    files.map(async (file) => {
      if (!file.name.trim()) {
        throw new Error("Every attachment must have a file name.");
      }

      const contentType = file.type?.trim().toLowerCase() || "application/octet-stream";
      if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
        throw new Error(`Unsupported attachment type for ${file.name}. Upload PDF, CSV, text, Office, or image files only.`);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength === 0) {
        throw new Error(`${file.name} is empty.`);
      }
      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new Error(`${file.name} exceeds the 10 MB attachment limit.`);
      }

      const attachmentId = randomUUID();
      const safeName = sanitizeFilename(file.name);
      const objectKey = `support-tickets/${externalId}/${attachmentId}-${safeName}`;
      await persistUploadBlob({ buffer, objectKey });

      return {
        contentType,
        id: attachmentId,
        name: safeName,
        objectKey,
        sizeBytes: buffer.byteLength,
      } satisfies SupportTicketAttachment;
    }),
  );

  return {
    accountId: stringValue(formData.get("accountId")) || fallbackAccountId,
    accountName: stringValue(formData.get("accountName")),
    attachments,
    category: normalizeCategory(stringValue(formData.get("category")) as SupportTicketCategory | null),
    description: stringValue(formData.get("description")) ?? "",
    locationId: stringValue(formData.get("locationId")),
    locationName: stringValue(formData.get("locationName")),
    subject: stringValue(formData.get("subject")) ?? "",
    urgency: normalizeUrgency(stringValue(formData.get("urgency")) as SupportTicketUrgency | null),
    workflow: stringValue(formData.get("workflow")),
  };
}

function sanitizeFilename(value: string) {
  const cleaned = value.trim().replace(/[^\w.\-]+/g, "_");
  return cleaned || `attachment-${Date.now()}`;
}

function stringValue(entry: FormDataEntryValue | null) {
  return typeof entry === "string" ? entry.trim() || null : null;
}
