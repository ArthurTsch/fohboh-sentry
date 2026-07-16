import type {
  SupportTicketCategory,
  SupportTicketRecord,
  SupportTicketUrgency,
} from "@/components/sentry/types";

const TICKET_V2_PREFIX = "TICKET_V2:";

export type SupportTicketDraft = {
  accountId: string | null;
  accountName: string | null;
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
  category: SupportTicketCategory;
  description: string;
  locationName: string | null;
  subject: string;
  urgency: SupportTicketUrgency;
  workflow: string | null;
};

export function serializeSupportTicketIssue(draft: SupportTicketDraft) {
  return `${TICKET_V2_PREFIX}${JSON.stringify({
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

function fallbackParsedTicket(issue: string): ParsedStoredTicket {
  const clean = issue.trim();
  const [firstLine, ...rest] = clean.split(/\r?\n/);
  return {
    category: "Other",
    description: rest.join("\n").trim() || clean,
    locationName: null,
    subject: firstLine?.trim() || "Support request",
    urgency: "Medium",
    workflow: null,
  };
}
