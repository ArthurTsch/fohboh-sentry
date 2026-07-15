import { compare } from "bcryptjs";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import type { Role, SessionState } from "@/components/sentry/types";
import { normalizeTeamRole } from "@/lib/auth/team-access";

type ManagerRecord = {
  active: boolean | null;
  email: string;
  email_verified: boolean | null;
  full_name: string | null;
  id: number;
  password_hash: string;
  role: string;
};

type MembershipRecord = {
  account_id: string;
  team_role: string;
};

function mapManagerRole(role: string): Role | null {
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

  const membershipRows = await prisma.$queryRaw<MembershipRecord[]>(Prisma.sql`
    SELECT account_id, team_role
    FROM public.account_memberships_v2
    WHERE manager_id = ${manager.id}
      AND status = 'active'
    LIMIT 1
  `).catch(() => []);

  const membership = membershipRows[0] ?? null;
  const normalizedTeamRole = normalizeTeamRole(membership?.team_role);

  return {
    ok: true,
    session: {
      accountId: membership?.account_id ?? null,
      email: manager.email,
      managerId: manager.id,
      name: manager.full_name?.trim() || undefined,
      role: appRole,
      teamRole: normalizedTeamRole,
    },
  };
}
