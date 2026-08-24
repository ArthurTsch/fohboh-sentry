import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { revalidateManagerSession } from "@/lib/auth/manager-auth";

let managerId = 0;
let membershipId = 0;

describe("database-backed session revocation", () => {
  beforeAll(async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const manager = await prisma.managers.create({
      data: {
        active: true,
        email: `session-revocation-${unique}@test.invalid`,
        password_hash: "unused-test-hash",
        role: "Manager",
        session_version: 1,
      },
    });
    managerId = manager.id;
    const membership = await prisma.account_memberships_v2.create({
      data: {
        access_scope: "all_locations",
        account_id: `session-test-${unique}`,
        manager_id: manager.id,
        status: "active",
        team_role: "Location Manager",
      },
    });
    membershipId = membership.id;
  });

  afterAll(async () => {
    if (membershipId) {
      await prisma.account_member_locations_v2.deleteMany({ where: { membership_id: membershipId } });
      await prisma.account_memberships_v2.deleteMany({ where: { id: membershipId } });
    }
    if (managerId) await prisma.managers.deleteMany({ where: { id: managerId } });
    await prisma.$disconnect();
  });

  function existingSession() {
    return {
      accountId: "stale-cookie-account",
      email: "stale-cookie-email@test.invalid",
      managerId,
      role: "Admin" as const,
      sessionVersion: 1,
      teamRole: "Owner" as const,
    };
  }

  it("rebuilds role and account privileges from current membership", async () => {
    const current = await revalidateManagerSession(existingSession());
    expect(current).toMatchObject({
      managerId,
      role: "Manager",
      sessionVersion: 1,
      teamRole: "Location Manager",
    });
    expect(current?.accountId).not.toBe("stale-cookie-account");
  });

  it("applies role demotion to an existing cookie immediately", async () => {
    await prisma.account_memberships_v2.update({
      where: { id: membershipId },
      data: { team_role: "Read-only" },
    });
    expect(await revalidateManagerSession(existingSession())).toMatchObject({
      role: "Viewer",
      teamRole: "Read-only",
    });
    await prisma.account_memberships_v2.update({
      where: { id: membershipId },
      data: { team_role: "Location Manager" },
    });
  });

  it("invalidates an existing cookie when membership is revoked", async () => {
    await prisma.account_memberships_v2.update({
      where: { id: membershipId },
      data: { status: "revoked" },
    });
    expect(await revalidateManagerSession(existingSession())).toBeNull();
    await prisma.account_memberships_v2.update({
      where: { id: membershipId },
      data: { status: "active" },
    });
  });

  it("invalidates an existing cookie when the manager is deactivated", async () => {
    await prisma.managers.update({ where: { id: managerId }, data: { active: false } });
    expect(await revalidateManagerSession(existingSession())).toBeNull();
    await prisma.managers.update({ where: { id: managerId }, data: { active: true } });
  });

  it("invalidates all older cookies after a security-version rotation", async () => {
    await prisma.managers.update({
      where: { id: managerId },
      data: { session_version: { increment: 1 } },
    });
    expect(await revalidateManagerSession(existingSession())).toBeNull();
  });
});
