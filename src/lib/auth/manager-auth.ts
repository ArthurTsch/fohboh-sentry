import { compare } from "bcryptjs";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import type { Role, SessionState } from "@/components/sentry/types";
import { mapTeamRoleToAppRole, normalizeTeamRole } from "@/lib/auth/team-access";

type ManagerRecord = {
  active: boolean | null;
  email: string;
  email_verified: boolean | null;
  full_name: string | null;
  id: number;
  password_hash: string;
  role: string;
  session_version: number;
};

type MembershipRecord = {
  status: string;
  account_id: string;
  team_role: string;
};

export function mapManagerRole(role: string): Role | null {
  const normalizedRole = role.trim().toLowerCase();

  if (normalizedRole === "wgs manager") return "WGS Manager";
  if (normalizedRole === "superadmin" || normalizedRole === "super admin") return "SuperAdmin";
  if (normalizedRole === "admin") return "Admin";
  if (normalizedRole === "viewer") return "Viewer";
  if (
    normalizedRole === "manager" ||
    normalizedRole === "restaurant owner" ||
    normalizedRole === "owner"
  ) {
    return "Manager";
  }

  return null;
}

async function getCurrentMembership(managerId: number) {
  const rows = await prisma.$queryRaw<MembershipRecord[]>(Prisma.sql`
    SELECT account_id, team_role, status
    FROM public.account_memberships_v2
    WHERE manager_id = ${managerId}
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC, id DESC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function revalidateManagerSession(session: SessionState): Promise<SessionState | null> {
  if (typeof session.managerId !== "number" || typeof session.sessionVersion !== "number") {
    return null;
  }

  const manager = await prisma.managers.findUnique({
    where: { id: session.managerId },
    select: {
      active: true,
      email: true,
      full_name: true,
      id: true,
      role: true,
      session_version: true,
    },
  });

  if (!manager || manager.active === false || manager.session_version !== session.sessionVersion) {
    return null;
  }

  const managerRole = mapManagerRole(manager.role);
  if (!managerRole) return null;

  const membership = await getCurrentMembership(manager.id);
  const activeMembership = membership?.status === "active" ? membership : null;
  const teamRole = normalizeTeamRole(activeMembership?.team_role);
  const globalRole = managerRole === "WGS Manager" || managerRole === "SuperAdmin";

  if (!globalRole && membership && !activeMembership) return null;
  if (!globalRole && activeMembership && !teamRole) return null;

  return {
    accountId: activeMembership?.account_id ?? null,
    email: manager.email,
    managerId: manager.id,
    name: manager.full_name?.trim() || undefined,
    role: !globalRole && teamRole ? mapTeamRoleToAppRole(teamRole) : managerRole,
    sessionVersion: manager.session_version,
    teamRole,
  };
}

export function resolveManagerAccountId(email: string, role: Role): string | null {
  void email;
  void role;
  return null;
}

export async function authenticateManager(
  email: string,
  password: string,
): Promise<
  | { ok: true; session: SessionState }
  | { ok: false; error: string; status: number }
> {
  const rawEmail = email.trim();
  const normalizedEmail = rawEmail.toLowerCase();

  if (!normalizedEmail || !password) {
    return { ok: false, error: "Email and password are required.", status: 400 };
  }

  const manager = (await prisma.managers.findFirst({
    where: {
      email: {
        equals: rawEmail,
        mode: "insensitive",
      },
    },
    select: {
      active: true,
      email: true,
      email_verified: true,
      full_name: true,
      id: true,
      password_hash: true,
      role: true,
      session_version: true,
    },
  })) as ManagerRecord | null;

  if (!manager) {
    return { ok: false, error: "Invalid email or password.", status: 401 };
  }

  if (manager.active === false) {
    return { ok: false, error: "This manager account is inactive.", status: 403 };
  }

  const appRole = mapManagerRole(manager.role);

  if (!appRole) {
    return {
      ok: false,
      error: `This account role is not allowed in Sentry: ${manager.role}.`,
      status: 403,
    };
  }

  const passwordMatches = await compare(password, manager.password_hash);

  if (!passwordMatches) {
    return { ok: false, error: "Invalid email or password.", status: 401 };
  }

  const membership = await getCurrentMembership(manager.id);
  const activeMembership = membership?.status === "active" ? membership : null;
  const normalizedTeamRole = normalizeTeamRole(activeMembership?.team_role);
  const globalRole = appRole === "WGS Manager" || appRole === "SuperAdmin";

  if (!globalRole && membership && !activeMembership) {
    return { ok: false, error: "This manager's team access has been revoked.", status: 403 };
  }

  if (!globalRole && activeMembership && !normalizedTeamRole) {
    return { ok: false, error: "This manager's team role is invalid.", status: 403 };
  }

  return {
    ok: true,
    session: {
      accountId: activeMembership?.account_id ?? null,
      email: manager.email,
      managerId: manager.id,
      name: manager.full_name?.trim() || undefined,
      role: !globalRole && normalizedTeamRole ? mapTeamRoleToAppRole(normalizedTeamRole) : appRole,
      sessionVersion: manager.session_version,
      teamRole: normalizedTeamRole,
    },
  };
}
