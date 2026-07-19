import type {
  SupportTicketAttachment,
  SupportTicketCategory,
  SupportTicketRecord,
  SupportTicketUrgency,
} from "@/components/sentry/types";

const TICKET_V2_PREFIX = "TICKET_V2:";

export type SupportTicketDraft = {
  accountId: string | null;
  accountName: string | null;
  attachments: SupportTicketAttachment[];
  category: SupportTicketCategory;
  description: string;
  locationId: string | null;
  locationName: string | null;
  requesterEmail: string;
  requesterName: string | null;
  requesterRole: string | null;
  subject: string;
  urgency: SupportTicketUrgency;
  workflow: string | null;
};

type ParsedStoredTicket = {
  attachments: SupportTicketAttachment[];
  category: SupportTicketCategory;
  description: string;
  locationName: string | null;
  subject: string;
  urgency: SupportTicketUrgency;
  workflow: string | null;
};

export function serializeSupportTicketIssue(draft: SupportTicketDraft) {
  return `${TICKET_V2_PREFIX}${JSON.stringify({
    attachments: draft.attachments.map((attachment) => ({
      contentType: attachment.contentType,
      id: attachment.id,
      name: attachment.name,
      objectKey: attachment.objectKey ?? null,
      sizeBytes: attachment.sizeBytes,
    })),
    category: draft.category,
    description: draft.description,
    locationName: draft.locationName,
    subject: draft.subject,
    urgency: draft.urgency,
    workflow: draft.workflow,
  })}`;
}

export function parseSupportTicketIssue(issue: string): ParsedStoredTicket {
  if (issue.startsWith(TICKET_V2_PREFIX)) {
    try {
      const payload = JSON.parse(issue.slice(TICKET_V2_PREFIX.length)) as Partial<ParsedStoredTicket>;
      return {
        attachments: normalizeAttachments((payload as { attachments?: unknown }).attachments),
        category: normalizeCategory(payload.category),
        description: String(payload.description ?? "").trim(),
        locationName: payload.locationName?.trim() || null,
        subject: String(payload.subject ?? "").trim() || "Support request",
        urgency: normalizeUrgency(payload.urgency),
        workflow: payload.workflow?.trim() || null,
      };
    } catch {
      return fallbackParsedTicket(issue);
    }
  }

  return fallbackParsedTicket(issue);
}

export function getSupportTicketPriority(draft: Pick<SupportTicketDraft, "category" | "description" | "urgency">) {
  if (draft.urgency === "Critical" || draft.urgency === "High") {
    return "High" as const;
  }

  if (
    draft.category === "Certification" ||
    draft.category === "Upload / Schema" ||
    /blocked|failed|trust score|certification|seal/i.test(draft.description)
  ) {
    return "Medium" as const;
  }

  return "Low" as const;
}

export function normalizeTicketStatus(value: string | null | undefined): SupportTicketRecord["status"] {
  if (
    value === "open" ||
    value === "in_review" ||
    value === "waiting_on_customer" ||
    value === "resolved"
  ) {
    return value;
  }
  return "open";
}

export function normalizeEmailDeliveryStatus(value: string | null | undefined): SupportTicketRecord["emailDelivery"] {
  if (
    value === "not_configured" ||
    value === "prepared" ||
    value === "queued" ||
    value === "sent" ||
    value === "failed"
  ) {
    return value;
  }
  return "not_configured";
}

function normalizeCategory(value: unknown): SupportTicketCategory {
  if (
    value === "Certification" ||
    value === "Upload / Schema" ||
    value === "Team & Access" ||
    value === "Billing" ||
    value === "Account / Login" ||
    value === "Other"
  ) {
    return value;
  }
  return "Other";
}

function normalizeUrgency(value: unknown): SupportTicketUrgency {
  if (value === "Low" || value === "Medium" || value === "High" || value === "Critical") {
    return value;
  }
  return "Medium";
}

function normalizeAttachments(value: unknown): SupportTicketAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<SupportTicketAttachment>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const contentType = typeof candidate.contentType === "string" ? candidate.contentType.trim() : "";
    const objectKey =
      typeof candidate.objectKey === "string" && candidate.objectKey.trim().length > 0
        ? candidate.objectKey.trim()
        : undefined;
    const sizeBytes =
      typeof candidate.sizeBytes === "number" && Number.isFinite(candidate.sizeBytes) && candidate.sizeBytes > 0
        ? candidate.sizeBytes
        : 0;

    if (!id || !name || !contentType || !objectKey || sizeBytes <= 0) {
      return [];
    }

    return [{ contentType, id, name, objectKey, sizeBytes }];
  });
}

function fallbackParsedTicket(issue: string): ParsedStoredTicket {
  const clean = issue.trim();
  const [firstLine, ...rest] = clean.split(/\r?\n/);
  return {
    attachments: [],
    category: "Other",
    description: rest.join("\n").trim() || clean,
    locationName: null,
    subject: firstLine?.trim() || "Support request",
    urgency: "Medium",
    workflow: null,
  };
}
