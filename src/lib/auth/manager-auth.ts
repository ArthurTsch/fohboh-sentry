import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";
import type { Role, SessionState } from "@/components/sentry/types";

type ManagerRecord = {
  active: boolean | null;
  email: string;
  email_verified: boolean | null;
  full_name: string | null;
  id: number;
  password_hash: string;
  role: string;
};

const SEEDED_ACCOUNT_BY_EMAIL: Record<string, string> = {
  "romeo-adorapos@fohboh.ai": "C001",
};

function mapManagerRole(role: string): Role | null {
  const normalizedRole = role.trim().toLowerCase();

  if (normalizedRole === "wgs manager") return "WGS Manager";
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

function resolveManagerAccountId(email: string, role: Role): string | null {
  if (role === "WGS Manager") {
    return null;
  }

  return SEEDED_ACCOUNT_BY_EMAIL[email.trim().toLowerCase()] ?? `mgr:${email.trim().toLowerCase()}`;
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

  return {
    ok: true,
    session: {
      accountId: resolveManagerAccountId(manager.email, appRole),
      email: manager.email,
      managerId: manager.id,
      name: manager.full_name?.trim() || undefined,
      role: appRole,
    },
  };
}
