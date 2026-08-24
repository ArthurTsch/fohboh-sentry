import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupportTicketDraft } from "@/lib/support/tickets";
import { prepareSupportTicketEmail } from "@/lib/support/email";

const draft: SupportTicketDraft = {
  accountId: "tenant-a",
  accountName: "Tenant A",
  attachments: [],
  category: "Other",
  description: "The support request description.",
  locationId: null,
  locationName: null,
  requesterEmail: "manager@example.test",
  requesterName: "Manager",
  requesterRole: "Manager",
  subject: "Support request",
  urgency: "Medium",
  workflow: null,
};

describe("support email delivery", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.SUPPORT_FROM_EMAIL = "support@example.test";
    process.env.SUPPORT_INBOX_EMAIL = "inbox@example.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.SUPPORT_FROM_EMAIL;
    delete process.env.SUPPORT_INBOX_EMAIL;
  });

  it("queues a successful request with a stable idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await prepareSupportTicketEmail("TCK-123", draft);
    expect(result.delivery).toBe("queued");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": "support-ticket/TCK-123" }),
      }),
    );
  });

  it.each([400, 503])("returns a sanitized failure for HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("provider-secret-diagnostic", { status }),
    ));
    const result = await prepareSupportTicketEmail("TCK-HTTP", draft);
    expect(result).toMatchObject({
      delivery: "failed",
      error: `Email provider returned HTTP ${status}.`,
    });
    expect(result.error).not.toContain("provider-secret-diagnostic");
  });

  it("bounds a slow provider call with an abort timeout", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Timed out", "TimeoutError"));
      }, { once: true });
    })));
    const result = await prepareSupportTicketEmail("TCK-SLOW", draft, { timeoutMs: 5 });
    expect(result).toMatchObject({
      delivery: "failed",
      error: "Email provider request timed out.",
    });
  });
});
