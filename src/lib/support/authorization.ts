import type { Prisma } from "@/app/generated/prisma/client";
import type { SessionState } from "@/components/sentry/types";

export function hasGlobalSupportAccess(session: SessionState) {
  return session.role === "WGS Manager" || session.role === "SuperAdmin";
}

export function canManageSupportTickets(session: SessionState) {
  return hasGlobalSupportAccess(session) || session.role === "Admin";
}

export function getSupportTicketScope(
  session: SessionState,
): Prisma.support_tickets_v2WhereInput {
  if (hasGlobalSupportAccess(session)) return {};

  const accountId = session.accountId?.trim() || null;
  if (session.role === "Admin") {
    return accountId ? { account_id: accountId } : { id: -1 };
  }

  const accessRules: Prisma.support_tickets_v2WhereInput[] = [];
  if (accountId) accessRules.push({ account_id: accountId });
  if (typeof session.managerId === "number") accessRules.push({ created_by: session.managerId });
  if (session.email.trim()) {
    accessRules.push({ requester_email: { equals: session.email.trim(), mode: "insensitive" } });
  }

  return accessRules.length > 0 ? { OR: accessRules } : { id: -1 };
}

export function getSupportTicketAccountId(
  session: SessionState,
  requestedAccountId: string | null | undefined,
) {
  const sessionAccountId = session.accountId?.trim() || null;
  if (!hasGlobalSupportAccess(session)) return sessionAccountId;
  return requestedAccountId?.trim() || sessionAccountId;
}
