import prisma from "@/lib/prisma";

export async function ensureNormalizedLocation({
  accountId,
  address,
  externalId,
  name,
  posSystem,
}: {
  accountId: string;
  address?: string | null;
  externalId: string;
  name: string;
  posSystem?: string | null;
}) {
  const customer = await prisma.customers.findUnique({
    where: { account_id: accountId },
    select: { id: true },
  });
  if (!customer) throw new Error(`Customer account ${accountId} has no normalized customer record.`);
  return prisma.locations_v2.upsert({
    where: { customer_id_external_id: { customer_id: customer.id, external_id: externalId } },
    create: { address: address?.trim() || null, customer_id: customer.id, external_id: externalId, name, pos_system: posSystem?.trim() || null },
    update: { address: address?.trim() || null, deleted_at: null, name, pos_system: posSystem?.trim() || null, updated_at: new Date() },
    select: { id: true },
  });
}
