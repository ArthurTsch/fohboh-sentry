import type { SupportTicketDraft } from "./tickets";

export type SupportTicketEmailDispatch = {
  delivery: "not_configured" | "prepared" | "queued" | "sent" | "failed";
  error?: string;
  payload: {
    html: string;
    subject: string;
    text: string;
    to: string;
  };
};

export function buildSupportTicketEmailPayload(ticketId: string, draft: SupportTicketDraft) {
  const to = process.env.SUPPORT_INBOX_EMAIL?.trim() || "";
  const subject = `[Sentry Support] ${ticketId} · ${draft.subject}`;
  const locationLine = draft.locationName
    ? `${draft.locationName}${draft.locationId ? ` (${draft.locationId})` : ""}`
    : "Portfolio / no specific location";

  const text = [
    `Ticket ID: ${ticketId}`,
    `Account: ${draft.accountName || draft.accountId || "Portfolio"}`,
    `Requester: ${draft.requesterName || draft.requesterEmail}`,
    `Requester email: ${draft.requesterEmail}`,
    `Role: ${draft.requesterRole || "Unknown"}`,
    `Category: ${draft.category}`,
    `Urgency: ${draft.urgency}`,
    `Workflow: ${draft.workflow || "General"}`,
    `Location: ${locationLine}`,
    "",
    "Description:",
    draft.description,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 16px">Sentry Support Ticket ${ticketId}</h2>
      <p><strong>Account:</strong> ${escapeHtml(draft.accountName || draft.accountId || "Portfolio")}</p>
      <p><strong>Requester:</strong> ${escapeHtml(draft.requesterName || draft.requesterEmail)}</p>
      <p><strong>Requester email:</strong> ${escapeHtml(draft.requesterEmail)}</p>
      <p><strong>Role:</strong> ${escapeHtml(draft.requesterRole || "Unknown")}</p>
      <p><strong>Category:</strong> ${escapeHtml(draft.category)}</p>
      <p><strong>Urgency:</strong> ${escapeHtml(draft.urgency)}</p>
      <p><strong>Workflow:</strong> ${escapeHtml(draft.workflow || "General")}</p>
      <p><strong>Location:</strong> ${escapeHtml(locationLine)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(draft.subject)}</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #ddd" />
      <p style="white-space:pre-wrap">${escapeHtml(draft.description)}</p>
    </div>
  `.trim();

  return { html, subject, text, to };
}

export async function prepareSupportTicketEmail(ticketId: string, draft: SupportTicketDraft): Promise<SupportTicketEmailDispatch> {
  const payload = buildSupportTicketEmailPayload(ticketId, draft);
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SUPPORT_FROM_EMAIL?.trim();

  if (!payload.to || !apiKey || !from) {
    return {
      delivery: "not_configured",
      payload,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        html: payload.html,
        subject: payload.subject,
        text: payload.text,
        to: [payload.to],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        delivery: "failed",
        error: body || `Email API responded with ${response.status}.`,
        payload,
      };
    }

    return {
      delivery: "queued",
      payload,
    };
  } catch (error) {
    return {
      delivery: "failed",
      error: error instanceof Error ? error.message : "Unknown email dispatch error.",
      payload,
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
