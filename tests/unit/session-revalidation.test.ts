import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  findManager: vi.fn(),
  queryMembership: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: database.queryMembership,
    managers: { findUnique: database.findManager },
  },
}));

import { revalidateManagerSession } from "@/lib/auth/manager-auth";

const cookieSession = {
  accountId: "stale-account",
  email: "stale@test.invalid",
  managerId: 7,
  role: "Admin" as const,
  sessionVersion: 3,
  teamRole: "Owner" as const,
};

describe("manager session revalidation", () => {
  beforeEach(() => {
    database.findManager.mockReset();
    database.queryMembership.mockReset();
    database.findManager.mockResolvedValue({
      active: true,
      email: "current@test.invalid",
      full_name: "Current User",
      id: 7,
      role: "Manager",
      session_version: 3,
    });
    database.queryMembership.mockResolvedValue([{
      account_id: "current-account",
      status: "active",
      team_role: "Location Manager",
    }]);
  });

  it("replaces cookie privileges with the current database role and account", async () => {
    await expect(revalidateManagerSession(cookieSession)).resolves.toMatchObject({
      accountId: "current-account",
      email: "current@test.invalid",
      role: "Manager",
      teamRole: "Location Manager",
    });
  });

  it("rejects a deactivated manager", async () => {
    database.findManager.mockResolvedValue({
      active: false,
      email: "current@test.invalid",
      full_name: null,
      id: 7,
      role: "Manager",
      session_version: 3,
    });
    await expect(revalidateManagerSession(cookieSession)).resolves.toBeNull();
  });

  it("rejects a revoked membership", async () => {
    database.queryMembership.mockResolvedValue([{
      account_id: "current-account",
      status: "revoked",
      team_role: "Location Manager",
    }]);
    await expect(revalidateManagerSession(cookieSession)).resolves.toBeNull();
  });

  it("applies a team-role demotion immediately", async () => {
    database.queryMembership.mockResolvedValue([{
      account_id: "current-account",
      status: "active",
      team_role: "Read-only",
    }]);
    await expect(revalidateManagerSession(cookieSession)).resolves.toMatchObject({
      role: "Viewer",
      teamRole: "Read-only",
    });
  });

  it("rejects a cookie after the session version changes", async () => {
    database.findManager.mockResolvedValue({
      active: true,
      email: "current@test.invalid",
      full_name: null,
      id: 7,
      role: "Manager",
      session_version: 4,
    });
    await expect(revalidateManagerSession(cookieSession)).resolves.toBeNull();
  });
});
