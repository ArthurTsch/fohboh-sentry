import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

type RestaurantScopeRecord = {
  accountId: string | null;
  address?: string | null;
  locationId: string;
  name: string;
  posSystem?: string | null;
};

export async function ensureCustomerForAccount(
  prisma: PrismaClient | Prisma.TransactionClient,
  accountId: string,
) {
  const existing = await prisma.customers.findFirst({
    where: {
      name: accountId,
      deleted_at: null,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.customers.create({
    data: {
      name: accountId,
      plan: "wgs",
      cortex_enabled: false,
      updated_at: new Date(),
    },
  });
}

export async function ensureLocationV2ForRestaurant(
  prisma: PrismaClient | Prisma.TransactionClient,
  record: RestaurantScopeRecord,
) {
  const accountId = record.accountId?.trim();
  if (!accountId) {
    throw new Error("This location is missing an accountId and cannot be governed yet.");
  }

  const customer = await ensureCustomerForAccount(prisma, accountId);
  const existing = await prisma.locations_v2.findFirst({
    where: {
      customer_id: customer.id,
      external_id: record.locationId,
      deleted_at: null,
    },
  });

  if (existing) {
    if (
      existing.name !== record.name ||
      existing.address !== (record.address ?? null) ||
      existing.pos_system !== (record.posSystem ?? null)
    ) {
      return prisma.locations_v2.update({
        where: { id: existing.id },
        data: {
          address: record.address ?? null,
          name: record.name,
          pos_system: record.posSystem ?? null,
          updated_at: new Date(),
        },
      });
    }

    return existing;
  }

  return prisma.locations_v2.create({
    data: {
      address: record.address ?? null,
      customer_id: customer.id,
      external_id: record.locationId,
      name: record.name,
      pos_system: record.posSystem ?? null,
      status: "onboarding",
      updated_at: new Date(),
    },
  });
}
