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

export const SUPPORT_EMAIL_TIMEOUT_MS = 4_000;

export function buildSupportTicketEmailPayload(ticketId: string, draft: SupportTicketDraft) {
  const to = process.env.SUPPORT_INBOX_EMAIL?.trim() || "";
  const subject = `[Sentry Support] ${ticketId} | ${draft.subject}`;
  const locationLine = draft.locationName
    ? `${draft.locationName}${draft.locationId ? ` (${draft.locationId})` : ""}`
    : "Portfolio / no specific location";
  const attachmentLines = draft.attachments.length
    ? [
        "",
        "Attachments:",
        ...draft.attachments.map(
          (attachment) =>
            `- ${attachment.name} (${attachment.contentType}, ${formatBytes(attachment.sizeBytes)})`,
        ),
      ]
    : [];

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
    ...attachmentLines,
  ].join("\n");

  const attachmentHtml = draft.attachments.length
    ? `
      <p><strong>Attachments:</strong></p>
      <ul>
        ${draft.attachments
          .map(
            (attachment) =>
              `<li>${escapeHtml(attachment.name)} (${escapeHtml(attachment.contentType)}, ${escapeHtml(formatBytes(attachment.sizeBytes))})</li>`,
          )
          .join("")}
      </ul>
    `
    : "";

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
      ${attachmentHtml}
      <hr style="margin:20px 0;border:none;border-top:1px solid #ddd" />
      <p style="white-space:pre-wrap">${escapeHtml(draft.description)}</p>
    </div>
  `.trim();

  return { html, subject, text, to };
}

export async function prepareSupportTicketEmail(
  ticketId: string,
  draft: SupportTicketDraft,
  options: { timeoutMs?: number } = {},
): Promise<SupportTicketEmailDispatch> {
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
      signal: AbortSignal.timeout(options.timeoutMs ?? SUPPORT_EMAIL_TIMEOUT_MS),
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `support-ticket/${ticketId}`,
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
      return {
        delivery: "failed",
        error: `Email provider returned HTTP ${response.status}.`,
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
      error: error instanceof Error && error.name === "TimeoutError"
        ? "Email provider request timed out."
        : "Email provider request failed.",
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

function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 102.4) / 10} KB`;
  }
  return `${value} B`;
}
