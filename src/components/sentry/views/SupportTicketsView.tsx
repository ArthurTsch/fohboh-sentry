"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type {
  LocationRecord,
  SessionState,
  SupportTicketCategory,
  SupportTicketRecord,
  SupportTicketUrgency,
} from "../types";
import { Badge, HelpTip, SectionCard } from "../ui/primitives";

const CATEGORY_OPTIONS: SupportTicketCategory[] = [
  "Certification",
  "Upload / Schema",
  "Team & Access",
  "Billing",
  "Account / Login",
  "Other",
];

const URGENCY_OPTIONS: SupportTicketUrgency[] = ["Low", "Medium", "High", "Critical"];
const MAX_ATTACHMENTS = 5;

type DraftAttachment = {
  file: File;
  id: string;
};

type FormState = {
  attachments: DraftAttachment[];
  category: SupportTicketCategory;
  description: string;
  locationId: string;
  subject: string;
  urgency: SupportTicketUrgency;
};

function emptyForm(locations: LocationRecord[]): FormState {
  return {
    attachments: [],
    category: "Certification",
    description: "",
    locationId: locations[0]?.id ?? "",
    subject: "",
    urgency: "Medium",
  };
}

function toneForStatus(status: SupportTicketRecord["status"]) {
  if (status === "resolved") return "success" as const;
  if (status === "waiting_on_customer") return "warning" as const;
  if (status === "in_review") return "info" as const;
  return "neutral" as const;
}

function toneForPriority(priority: SupportTicketRecord["priority"]) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function formatTimestamp(value: string | null) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function locationLabel(id: string, locations: LocationRecord[]) {
  const match = locations.find((location) => location.id === id);
  return match ? `${match.name} (${match.id})` : id;
}

function attachmentHref(ticketId: string, attachmentId: string) {
  return `/api/v1/support/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function SupportTicketsView({
  accountId,
  accountName,
  locations,
  onTicketCreated,
  session,
}: {
  accountId: string | null;
  accountName: string;
  locations: LocationRecord[];
  onTicketCreated?: () => void | Promise<void>;
  session: SessionState;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(locations));
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTickets() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/support/tickets", { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; tickets?: SupportTicketRecord[] };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load support tickets.");
      }
      setTickets(payload.tickets ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load support tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    setForm((current) =>
      current.locationId || locations.length === 0
        ? current
        : { ...current, locationId: locations[0]?.id ?? "" },
    );
  }, [locations]);

  function handleAttachmentPick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setForm((current) => {
      const additions = files.map((file, index) => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      }));

      return {
        ...current,
        attachments: [...current.attachments, ...additions].slice(0, MAX_ATTACHMENTS),
      };
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeAttachment(attachmentId: string) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  }

  async function handleSubmit() {
    if (!form.subject.trim()) {
      setError("Ticket subject is required.");
      return;
    }
    if (!form.description.trim()) {
      setError("Ticket description is required.");
      return;
    }
    if (form.attachments.length > MAX_ATTACHMENTS) {
      setError(`A support ticket can include at most ${MAX_ATTACHMENTS} attachments.`);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const selectedLocation = locations.find((location) => location.id === form.locationId);

    try {
      const formData = new FormData();
      formData.append("accountId", accountId ?? "");
      formData.append("accountName", accountName);
      formData.append("category", form.category);
      formData.append("description", form.description.trim());
      formData.append("locationId", selectedLocation?.id || "");
      formData.append("locationName", selectedLocation?.name || "");
      formData.append("subject", form.subject.trim());
      formData.append("urgency", form.urgency);
      for (const attachment of form.attachments) {
        formData.append("attachments", attachment.file, attachment.file.name);
      }

      const response = await fetch("/api/v1/support/tickets", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ticket?: SupportTicketRecord;
      };

      if (!response.ok || !payload.ticket) {
        throw new Error(payload.error ?? "Unable to create support ticket.");
      }

      setTickets((current) => [payload.ticket!, ...current]);
      setForm(emptyForm(locations));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMessage("Support ticket created. The WGS queue has been updated.");
      await onTicketCreated?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create support ticket.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
              <span>Support Tickets</span>
              <HelpTip
                title="Support Tickets"
                sections={[
                  {
                    label: "What It Is",
                    text: "Structured support intake for certification blockers, upload issues, account access, and account operations.",
                  },
                  {
                    label: "What It Does",
                    text: "Creates a persisted support ticket with severity, location scope, requester identity, and supporting attachments for the WGS team.",
                  },
                  {
                    label: "Email Path",
                    text: "The email payload is prepared server-side. If support email credentials are added later, this same workflow can deliver directly to the support inbox.",
                  },
                ]}
                footerLabel="Routing"
                footerValue="WGS support queue"
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Submit a support request with the right operational context instead of sending a free-form
              message. This creates a real ticket for the WGS queue and keeps the request traceable.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            <div>
              <span className="font-semibold text-[var(--text)]">Account:</span> {accountName}
            </div>
            <div className="mt-1">
              <span className="font-semibold text-[var(--text)]">Requester:</span> {session.name || session.email}
            </div>
          </div>
        </div>
      </SectionCard>

      {message ? (
        <SectionCard className="border-[rgba(0,200,83,0.2)] bg-[rgba(0,200,83,0.04)] py-4 text-sm text-[var(--success)]">
          {message}
        </SectionCard>
      ) : null}

      {error ? (
        <SectionCard className="border-[rgba(214,48,49,0.2)] bg-[rgba(214,48,49,0.04)] py-4 text-sm text-[var(--accent)]">
          {error}
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <SectionCard className="space-y-5">
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
              Create support ticket
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Give the WGS team enough structure to triage the issue immediately.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Category
              </span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value as SupportTicketCategory }))
                }
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Urgency
              </span>
              <select
                value={form.urgency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, urgency: event.target.value as SupportTicketUrgency }))
                }
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
              >
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Subject
            </span>
            <input
              type="text"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="e.g. M02 bank statement passed upload but certification is blocked"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Location Scope
            </span>
            <select
              value={form.locationId}
              onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
            >
              <option value="">No specific location / portfolio issue</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.id})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Description
            </span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe what happened, what you expected, and what you already tried."
              rows={8}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-6 outline-none"
            />
          </label>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Attach files
                </div>
                <div className="mt-2 text-sm text-[var(--muted)]">
                  Add screenshots, PDFs, CSVs, or office documents. Max 5 files, 10 MB each.
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Add attachments
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.csv,.txt,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx"
              onChange={handleAttachmentPick}
              className="hidden"
            />
            {form.attachments.length > 0 ? (
              <div className="mt-4 space-y-2">
                {form.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--text)]">{attachment.file.name}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {attachment.file.type || "application/octet-stream"} · {formatBytes(attachment.file.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="rounded-full border border-[rgba(214,48,49,0.24)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[rgba(214,48,49,0.06)]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[rgba(0,97,255,0.14)] bg-[rgba(0,97,255,0.04)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
            Email delivery is not the primary workflow yet. The system already prepares the outbound
            support email payload server-side, including attachment metadata, so activation later does
            not require a new ticket UI.
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="rounded-full bg-[var(--text)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating ticket..." : "Submit support ticket"}
            </button>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard className="space-y-4">
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
              Recent tickets
            </div>
            <div className="text-sm text-[var(--muted)]">
              Your account's latest support requests and current handling status.
            </div>
            {loading ? (
              <div className="text-sm text-[var(--muted)]">Loading tickets...</div>
            ) : tickets.length > 0 ? (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--text)]">{ticket.subject}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {ticket.id} · {formatTimestamp(ticket.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={toneForPriority(ticket.priority)}>{ticket.priority}</Badge>
                        <Badge tone={toneForStatus(ticket.status)}>{ticket.status.replaceAll("_", " ")}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span>{ticket.category}</span>
                      {ticket.locationId ? (
                        <>
                          <span>•</span>
                          <span>{ticket.locationName || locationLabel(ticket.locationId, locations)}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{ticket.description}</div>
                    {ticket.attachments.length > 0 ? (
                      <div className="mt-4">
                        <div className="mb-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Attachments
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ticket.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachmentHref(ticket.id, attachment.id)}
                              className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            >
                              {attachment.name} · {formatBytes(attachment.sizeBytes)}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
                No support tickets exist for this account yet.
              </div>
            )}
          </SectionCard>

          <SectionCard className="space-y-4">
            <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
              Routing guide
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Certification
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Use for blocked runs, unexpected Trust Score drops, missing CAAR output, or release
                  gates that do not align with uploaded evidence.
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Upload / Schema
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Use when a source file fails intake checks, extracted text looks wrong, or schema/vault
                  controls do not reflect the expected vendor document.
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Team / Billing / Account
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Use for access scope, ownership, statements, payment setup, or account session issues
                  that block operations outside the certification engine.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
