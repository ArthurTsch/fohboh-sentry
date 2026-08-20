import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ default: { $queryRaw: queryRaw } }));

describe("restaurant tenant-scope role matrix", () => {
  beforeEach(() => queryRaw.mockReset());

  it.each(["WGS Manager", "SuperAdmin"] as const)("allows %s to use global scope", async (role) => {
    const { getScopedRestaurantWhere } = await import("@/lib/auth/team-access");
    await expect(getScopedRestaurantWhere({ accountId: "platform", email: `${role}@example.com`, role })).resolves.toEqual({});
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it.each(["Admin", "Manager", "Viewer"] as const)("fails closed when %s has no manager identity", async (role) => {
    const { getScopedRestaurantWhere } = await import("@/lib/auth/team-access");
    await expect(getScopedRestaurantWhere({ accountId: "tenant-a", email: `${role}@example.com`, role })).resolves.toEqual({ id: -1 });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it.each(["Admin", "Manager", "Viewer"] as const)("limits selected-location %s sessions to assigned restaurant IDs", async (role) => {
    queryRaw
      .mockResolvedValueOnce([{ access_scope: "selected_locations", account_holder: false, account_id: "tenant-a", id: 10, manager_id: 7, status: "active", team_role: role === "Viewer" ? "Read-only" : "Location Manager" }])
      .mockResolvedValueOnce([{ restaurant_id: 101 }, { restaurant_id: 102 }]);
    const { getScopedRestaurantWhere } = await import("@/lib/auth/team-access");
    await expect(getScopedRestaurantWhere({ accountId: "tenant-a", email: `${role}@example.com`, managerId: 7, role })).resolves.toEqual({ id: { in: [101, 102] } });
  });
});
