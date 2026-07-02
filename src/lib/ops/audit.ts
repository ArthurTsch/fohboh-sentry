import { Prisma } from "@/app/generated/prisma/client";
import type { PrismaClient } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

type AuditLogArgs = {
  action: string;
  actorUserId?: number | null;
  customerId?: number | null;
  entityId: string;
  entityType: string;
  ipAddress?: string | null;
  locationId?: number | null;
  metadata?: Prisma.InputJsonValue | null;
  summary: string;
  userAgent?: string | null;
};

type TxClient = PrismaClient | Prisma.TransactionClient;

function toJsonValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  args: AuditLogArgs,
  tx: TxClient = prisma,
) {
  return tx.audit_log_v2.create({
    data: {
      action: args.action,
      actor_user_id: args.actorUserId ?? null,
      customer_id: args.customerId ?? null,
      entity_id: args.entityId,
      entity_type: args.entityType,
      ip_address: args.ipAddress ?? null,
      location_id: args.locationId ?? null,
      metadata: toJsonValue(args.metadata ?? null),
      summary: args.summary,
      user_agent: args.userAgent ?? null,
    },
  });
}

export function logServerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event,
      level: "info",
      ts: new Date().toISOString(),
      ...payload,
    }),
  );
}

export function logServerError(
  event: string,
  error: unknown,
  payload: Record<string, unknown>,
) {
  const normalized =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
        }
      : { error };

  console.error(
    JSON.stringify({
      event,
      level: "error",
      ts: new Date().toISOString(),
      ...payload,
      ...normalized,
    }),
  );
}
