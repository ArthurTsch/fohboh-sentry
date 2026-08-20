import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

const baselineEntityId = `WEB002-BASELINE-${Date.now()}`;

function post(body: Record<string, unknown>) {
  return new Request("http://test/api/v1/activity-log", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

describe("POST /api/v1/activity-log against PostgreSQL", () => {
  beforeAll(async () => {
    await prisma.audit_log_v2.create({
      data: {
        action: "web002_server_baseline",
        entity_id: baselineEntityId,
        entity_type: "test_control",
        summary: "Server-created WEB-002 control row.",
      },
    });
  });

  afterAll(async () => {
    await prisma.audit_log_v2.deleteMany({
      where: { entity_id: { in: [baselineEntityId, "FORGED-SAME-TENANT", "FORGED-CROSS-TENANT"] } },
    });
    await prisma.$disconnect();
  });

  it.each([
    {
      accountId: "same-tenant",
      action: "certification_completed",
      entityId: "FORGED-SAME-TENANT",
      entityType: "cert_runs_v2",
      immutable: true,
      metadata: { immutable: true, secret: "client-authored" },
      summary: "Forged same-tenant certification.",
    },
    {
      accountId: "other-tenant",
      action: "governance_workspace_sealed",
      entityId: "FORGED-CROSS-TENANT",
      entityType: "contract_configs_v2",
      immutable: true,
      locationId: "OTHER-TENANT-LOCATION",
      summary: "Forged cross-tenant governance seal.",
    },
  ])("rejects forged audit semantics and creates no row", async (payload) => {
    const before = await prisma.audit_log_v2.count();
    const { POST } = await import("@/app/api/v1/activity-log/route");
    const postHandler = POST as (request: Request) => Promise<Response>;
    const response = await postHandler(post(payload));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(await response.json()).toEqual({
      error: "Audit records are created only by the server operation they describe.",
    });
    await expect(prisma.audit_log_v2.count()).resolves.toBe(before);
    await expect(
      prisma.audit_log_v2.count({ where: { entity_id: payload.entityId } }),
    ).resolves.toBe(0);
  });

  it("preserves server-authored audit records", async () => {
    await expect(
      prisma.audit_log_v2.count({ where: { entity_id: baselineEntityId } }),
    ).resolves.toBe(1);
  });
});
