import { afterAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { ensureNormalizedLocation } from "@/lib/restaurants/normalized-location";

const runId = Date.now();
const accountId = `test-normalized-${runId}`;
const externalId = `TEST-NORMALIZED-LOC-${runId}`;
let customerId = 0;

describe("normalized upload location lineage", () => {
  afterAll(async () => {
    await prisma.locations_v2.deleteMany({ where: { customer_id: customerId } }).catch(() => null);
    await prisma.customers.deleteMany({ where: { id: customerId } }).catch(() => null);
  });

  it("creates one stable locations_v2 parent for repeated legacy-location resolution", async () => {
    const customer = await prisma.customers.create({ data: { account_id: accountId, name: "TEST Normalized" } });
    customerId = customer.id;
    const first = await ensureNormalizedLocation({ accountId, externalId, name: "Initial name" });
    const second = await ensureNormalizedLocation({ accountId, externalId, name: "Updated name" });
    expect(second.id).toBe(first.id);
    await expect(prisma.locations_v2.findUniqueOrThrow({ where: { id: first.id } })).resolves.toMatchObject({
      external_id: externalId,
      name: "Updated name",
    });
  });
});
