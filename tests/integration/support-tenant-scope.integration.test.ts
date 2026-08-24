import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionState } from "@/components/sentry/types";
import prisma from "@/lib/prisma";
import { getSupportTicketScope } from "@/lib/support/authorization";

const runId = `${Date.now()}`;
const ticketIds = {
  tenantA: `TEST-WEB004-A-${runId}`,
  tenantB: `TEST-WEB004-B-${runId}`,
};

const sessions = {
  adminA: { accountId: "test-web004-a", email: "admin-a@test", managerId: 920001, role: "Admin" },
  managerA: { accountId: "test-web004-a", email: "manager-a@test", managerId: 920002, role: "Manager" },
  requesterB: { accountId: "test-web004-c", email: "requester-b@test", managerId: 920003, role: "Viewer" },
  superAdmin: { accountId: null, email: "super@test", managerId: 920004, role: "SuperAdmin" },
  wgs: { accountId: null, email: "wgs@test", managerId: 920005, role: "WGS Manager" },
} satisfies Record<string, SessionState>;

describe("support ticket tenant scope against PostgreSQL", () => {
  beforeAll(async () => {
    await prisma.customers.createMany({ data: [
      { account_id: "test-web004-a", name: "TEST WEB-004 Tenant A" },
      { account_id: "test-web004-b", name: "TEST WEB-004 Tenant B" },
    ] });
    await prisma.managers.createMany({ data: [
      { id: sessions.managerA.managerId, email: `web004-a-${runId}@test.invalid`, password_hash: "test-only", role: "Manager" },
      { id: 929999, email: `web004-b-${runId}@test.invalid`, password_hash: "test-only", role: "Manager" },
    ] });
    await prisma.support_tickets_v2.createMany({
      data: [
        {
          account_id: "test-web004-a",
          created_by: sessions.managerA.managerId,
          external_id: ticketIds.tenantA,
          issue: "Tenant A issue",
          priority: "Medium",
          requester_email: "manager-a@test",
        },
        {
          account_id: "test-web004-b",
          created_by: 929999,
          external_id: ticketIds.tenantB,
          issue: "Tenant B issue",
          priority: "High",
          requester_email: "requester-b@test",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.support_tickets_v2.deleteMany({
      where: { external_id: { in: Object.values(ticketIds) } },
    });
    await prisma.managers.deleteMany({ where: { id: { in: [sessions.managerA.managerId!, 929999] } } });
    await prisma.customers.deleteMany({ where: { account_id: { in: ["test-web004-a", "test-web004-b"] } } });
    await prisma.$disconnect();
  });

  it("limits Account Admin to their tenant", async () => {
    const rows = await prisma.support_tickets_v2.findMany({
      where: { AND: [{ external_id: { in: Object.values(ticketIds) } }, getSupportTicketScope(sessions.adminA)] },
      select: { external_id: true },
    });
    expect(rows.map((row) => row.external_id)).toEqual([ticketIds.tenantA]);
  });

  it("keeps same-tenant ordinary-user access", async () => {
    const rows = await prisma.support_tickets_v2.findMany({
      where: { AND: [{ external_id: { in: Object.values(ticketIds) } }, getSupportTicketScope(sessions.managerA)] },
      select: { external_id: true },
    });
    expect(rows.map((row) => row.external_id)).toEqual([ticketIds.tenantA]);
  });

  it("keeps requester access without leaking unrelated tickets", async () => {
    const rows = await prisma.support_tickets_v2.findMany({
      where: { AND: [{ external_id: { in: Object.values(ticketIds) } }, getSupportTicketScope(sessions.requesterB)] },
      select: { external_id: true },
    });
    expect(rows.map((row) => row.external_id)).toEqual([ticketIds.tenantB]);
  });

  it.each([sessions.wgs, sessions.superAdmin])("retains global access for $role", async (session) => {
    const rows = await prisma.support_tickets_v2.findMany({
      where: { AND: [{ external_id: { in: Object.values(ticketIds) } }, getSupportTicketScope(session)] },
      select: { external_id: true },
    });
    expect(rows.map((row) => row.external_id).sort()).toEqual(Object.values(ticketIds).sort());
  });
});
