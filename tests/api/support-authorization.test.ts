import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionState } from "@/components/sentry/types";
import {
  canManageSupportTickets,
  getSupportTicketAccountId,
  getSupportTicketScope,
  hasGlobalSupportAccess,
} from "@/lib/support/authorization";

const requireManagerSession = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const findUniqueOrThrow = vi.fn();
const updateMany = vi.fn();
const create = vi.fn();
const writeAuditLog = vi.fn();
const readUploadBlob = vi.fn();
const persistUploadBlob = vi.fn();
const deleteUploadBlob = vi.fn();

vi.mock("@/lib/auth/session", () => ({ requireManagerSession }));
vi.mock("@/lib/ops/audit", () => ({
  logServerError: vi.fn(),
  writeAuditLog,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    support_tickets_v2: { create, findFirst, findMany, findUniqueOrThrow, updateMany },
  },
}));
vi.mock("@/lib/uploads/storage", () => ({ deleteUploadBlob, persistUploadBlob, readUploadBlob }));

const sessions = {
  admin: { accountId: "tenant-a", email: "admin@a.test", managerId: 1, role: "Admin" },
  manager: { accountId: "tenant-a", email: "manager@a.test", managerId: 2, role: "Manager" },
  superAdmin: { accountId: null, email: "super@test", managerId: 3, role: "SuperAdmin" },
  viewer: { accountId: "tenant-a", email: "viewer@a.test", managerId: 4, role: "Viewer" },
  wgs: { accountId: null, email: "wgs@test", managerId: 5, role: "WGS Manager" },
} satisfies Record<string, SessionState>;

describe("support ticket authorization matrix", () => {
  beforeEach(() => {
    requireManagerSession.mockReset();
    findMany.mockReset();
    findFirst.mockReset();
    findUniqueOrThrow.mockReset();
    updateMany.mockReset();
    create.mockReset();
    writeAuditLog.mockReset();
    readUploadBlob.mockReset();
    persistUploadBlob.mockReset();
    deleteUploadBlob.mockReset();
  });

  it.each([sessions.wgs, sessions.superAdmin])("grants $role global queue access", (session) => {
    expect(hasGlobalSupportAccess(session)).toBe(true);
    expect(canManageSupportTickets(session)).toBe(true);
    expect(getSupportTicketScope(session)).toEqual({});
  });

  it("limits Account Admin scope and ticket creation to the current tenant", () => {
    expect(canManageSupportTickets(sessions.admin)).toBe(true);
    expect(getSupportTicketScope(sessions.admin)).toEqual({ account_id: "tenant-a" });
    expect(getSupportTicketAccountId(sessions.admin, "tenant-b")).toBe("tenant-a");
  });

  it.each([sessions.manager, sessions.viewer])(
    "limits $role reads to account, creator, or requester identity",
    (session) => {
      expect(canManageSupportTickets(session)).toBe(false);
      expect(getSupportTicketScope(session)).toEqual({
        OR: [
          { account_id: "tenant-a" },
          { created_by: session.managerId },
          { requester_email: { equals: session.email, mode: "insensitive" } },
        ],
      });
    },
  );

  it("applies Account Admin tenant scope to queue queries", async () => {
    requireManagerSession.mockResolvedValue(sessions.admin);
    findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/v1/support/tickets/route");
    const response = await GET(new Request("http://test/api/v1/support/tickets?queue=1"));
    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { account_id: "tenant-a" },
          { status: { in: ["open", "in_review", "waiting_on_customer"] } },
        ],
      },
    }));
  });

  it("returns 404 when Account Admin tries to resolve an out-of-scope ticket", async () => {
    requireManagerSession.mockResolvedValue(sessions.admin);
    updateMany.mockResolvedValue({ count: 0 });
    const { PATCH } = await import("@/app/api/v1/support/tickets/[ticketId]/route");
    const response = await PATCH(
      new Request("http://test/api/v1/support/tickets/TENANT-B", { method: "PATCH" }),
      { params: Promise.resolve({ ticketId: "TENANT-B" }) },
    );
    expect(response.status).toBe(404);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ external_id: "TENANT-B" }, { account_id: "tenant-a" }] },
    }));
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("allows Account Admin to resolve a same-tenant ticket", async () => {
    requireManagerSession.mockResolvedValue(sessions.admin);
    updateMany.mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockResolvedValue({ external_id: "TENANT-A", issue: "Issue" });
    writeAuditLog.mockResolvedValue({});
    const { PATCH } = await import("@/app/api/v1/support/tickets/[ticketId]/route");
    const response = await PATCH(
      new Request("http://test/api/v1/support/tickets/TENANT-A", { method: "PATCH" }),
      { params: Promise.resolve({ ticketId: "TENANT-A" }) },
    );
    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ external_id: "TENANT-A" }, { account_id: "tenant-a" }] },
    }));
  });

  it("returns 404 without reading storage for an out-of-scope attachment", async () => {
    requireManagerSession.mockResolvedValue(sessions.admin);
    findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "@/app/api/v1/support/tickets/[ticketId]/attachments/[attachmentId]/route"
    );
    const response = await GET(
      new Request("http://test/api/v1/support/tickets/TENANT-B/attachments/ATT-1"),
      { params: Promise.resolve({ attachmentId: "ATT-1", ticketId: "TENANT-B" }) },
    );
    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ external_id: "TENANT-B" }, { account_id: "tenant-a" }] },
    }));
    expect(readUploadBlob).not.toHaveBeenCalled();
  });

  it("rejects oversized multipart requests before buffering or storage", async () => {
    requireManagerSession.mockResolvedValue(sessions.admin);
    const { POST } = await import("@/app/api/v1/support/tickets/route");
    const response = await POST(new Request("http://test/api/v1/support/tickets", {
      method: "POST",
      headers: {
        "content-length": String(Math.floor(4.5 * 1024 * 1024) + 1),
        "content-type": "multipart/form-data; boundary=test",
      },
    }));
    expect(response.status).toBe(413);
    expect(persistUploadBlob).not.toHaveBeenCalled();
  });

  it("deletes staged attachments when ticket insertion fails", async () => {
    requireManagerSession.mockResolvedValue(sessions.admin);
    persistUploadBlob.mockResolvedValue({ objectKey: "support/TCK/attachment.txt" });
    deleteUploadBlob.mockResolvedValue({ count: 1 });
    create.mockRejectedValue(new Error("database unavailable"));
    const body = new FormData();
    body.set("subject", "Upload issue");
    body.set("description", "The submitted evidence could not be processed.");
    body.set("attachments", new File(["evidence"], "attachment.txt", { type: "text/plain" }));
    const { POST } = await import("@/app/api/v1/support/tickets/route");
    const response = await POST(new Request("http://test/api/v1/support/tickets", {
      body,
      method: "POST",
    }));
    expect(response.status).toBe(500);
    expect(persistUploadBlob).toHaveBeenCalledOnce();
    expect(deleteUploadBlob).toHaveBeenCalledOnce();
  });
});
