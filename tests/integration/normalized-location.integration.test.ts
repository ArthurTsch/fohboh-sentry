import { afterAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { ensureNormalizedLocation } from "@/lib/restaurants/normalized-location";
import { ensureLocationV2ForRestaurant } from "@/lib/production/legacy-sync";

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

describe("legacy restaurant location synchronization", () => {
  const legacyAccountId = `test-legacy-sync-${runId}`;
  const legacyExternalId = `TEST-LEGACY-LOC-${runId}`;
  let legacyCustomerId = 0;
  let decoyCustomerId = 0;

  afterAll(async () => {
    await prisma.locations_v2.deleteMany({ where: { customer_id: legacyCustomerId } }).catch(() => null);
    await prisma.locations_v2.deleteMany({ where: { customer_id: decoyCustomerId } }).catch(() => null);
    await prisma.customers.deleteMany({ where: { id: legacyCustomerId } }).catch(() => null);
    await prisma.customers.deleteMany({ where: { id: decoyCustomerId } }).catch(() => null);
  });

  it("reuses the customer account_id instead of creating a name-based duplicate", async () => {
    const decoyCustomer = await prisma.customers.create({
      data: { name: legacyAccountId },
    });
    decoyCustomerId = decoyCustomer.id;
    const customer = await prisma.customers.create({
      data: { account_id: legacyAccountId, name: "Legacy Sync Account" },
    });
    legacyCustomerId = customer.id;
    const existingLocation = await prisma.locations_v2.create({
      data: {
        customer_id: customer.id,
        external_id: legacyExternalId,
        name: "Existing Location",
      },
    });

    const resolvedLocation = await ensureLocationV2ForRestaurant(prisma, {
      accountId: legacyAccountId,
      locationId: legacyExternalId,
      name: "Updated Location",
    });

    expect(resolvedLocation.id).toBe(existingLocation.id);
    expect(resolvedLocation.customer_id).toBe(customer.id);
    await expect(prisma.customers.count({ where: { account_id: legacyAccountId } })).resolves.toBe(1);
  });
});
