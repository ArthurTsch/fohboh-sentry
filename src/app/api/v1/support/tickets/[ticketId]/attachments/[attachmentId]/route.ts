import { NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth/session";
import { getRequestContextFromRequest, withRequestHeaders } from "@/lib/ops/request";
import prisma from "@/lib/prisma";
import { parseSupportTicketIssue } from "@/lib/support/tickets";
import { readUploadBlob } from "@/lib/uploads/storage";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ attachmentId: string; ticketId: string }> },
) {
  const requestContext = getRequestContextFromRequest(request);
  try {
    const session = await requireManagerSession();
    const { attachmentId, ticketId } = await context.params;
    const accountId = session.accountId?.trim() || null;
    const privileged =
      session.role === "WGS Manager" || session.role === "SuperAdmin" || session.role === "Admin";

    const ticket = await prisma.support_tickets_v2.findFirst({
      where: {
        external_id: ticketId,
        ...(privileged
          ? {}
          : {
              OR: [
                ...(accountId ? [{ account_id: accountId }] : []),
                ...(typeof session.managerId === "number" ? [{ created_by: session.managerId }] : []),
                { requester_email: session.email },
              ],
            }),
      },
      select: {
        issue: true,
      },
    });

    if (!ticket) {
      return withRequestHeaders(
        NextResponse.json({ error: "Support ticket not found." }, { status: 404 }),
        requestContext,
      );
    }

    const parsed = parseSupportTicketIssue(ticket.issue);
    const attachment = parsed.attachments.find((entry) => entry.id === attachmentId);

    if (!attachment?.objectKey) {
      return withRequestHeaders(
        NextResponse.json({ error: "Attachment not found." }, { status: 404 }),
        requestContext,
      );
    }

    const buffer = await readUploadBlob(attachment.objectKey);
    return withRequestHeaders(
      new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Disposition": `attachment; filename="${attachment.name.replace(/"/g, "")}"`,
          "Content-Length": String(buffer.byteLength),
          "Content-Type": attachment.contentType,
        },
      }),
      requestContext,
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) {
      return withRequestHeaders(authResponse, requestContext);
    }

    return withRequestHeaders(
      NextResponse.json({ error: "Unable to download this attachment right now." }, { status: 500 }),
      requestContext,
    );
  }
}
