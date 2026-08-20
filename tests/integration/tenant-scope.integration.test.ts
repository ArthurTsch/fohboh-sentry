import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getScopedRestaurantWhere } from "@/lib/auth/team-access";

const managerIds = { all: 910001, selected: 910002 };
let tenantARestaurantIds: number[] = [];
let tenantBRestaurantId = 0;

describe("tenant restaurant scope against PostgreSQL", () => {
  beforeAll(async () => {
    const [a1, a2, b1] = await Promise.all([
      prisma.restaurants.create({ data: { active: true, name: "TEST Tenant A One", unit_id: `TEST-A-${Date.now()}-1` } }),
      prisma.restaurants.create({ data: { active: true, name: "TEST Tenant A Two", unit_id: `TEST-A-${Date.now()}-2` } }),
      prisma.restaurants.create({ data: { active: true, name: "TEST Tenant B One", unit_id: `TEST-B-${Date.now()}-1` } }),
    ]);
    tenantARestaurantIds = [a1.id, a2.id];
    tenantBRestaurantId = b1.id;

    await Promise.all([
      prisma.restaurant_sentry_state.create({ data: { account_id: "test-tenant-a", location_id: `TEST-LOC-${a1.id}`, restaurant_id: a1.id } }),
      prisma.restaurant_sentry_state.create({ data: { account_id: "test-tenant-a", location_id: `TEST-LOC-${a2.id}`, restaurant_id: a2.id } }),
      prisma.restaurant_sentry_state.create({ data: { account_id: "test-tenant-b", location_id: `TEST-LOC-${b1.id}`, restaurant_id: b1.id } }),
    ]);
    const allMembership = await prisma.account_memberships_v2.create({ data: { access_scope: "all_locations", account_id: "test-tenant-a", manager_id: managerIds.all, team_role: "Owner" } });
    const selectedMembership = await prisma.account_memberships_v2.create({ data: { access_scope: "selected_locations", account_id: "test-tenant-a", manager_id: managerIds.selected, team_role: "Location Manager" } });
    void allMembership;
    await prisma.account_member_locations_v2.create({ data: { membership_id: selectedMembership.id, restaurant_id: a2.id } });
  });

  afterAll(async () => {
    await prisma.account_member_locations_v2.deleteMany({ where: { restaurant_id: { in: [...tenantARestaurantIds, tenantBRestaurantId] } } });
    await prisma.account_memberships_v2.deleteMany({ where: { manager_id: { in: Object.values(managerIds) } } });
    await prisma.restaurant_sentry_state.deleteMany({ where: { restaurant_id: { in: [...tenantARestaurantIds, tenantBRestaurantId] } } });
    await prisma.restaurants.deleteMany({ where: { id: { in: [...tenantARestaurantIds, tenantBRestaurantId] } } });
    await prisma.$disconnect();
  });

  it("limits an all-location account owner to their tenant", async () => {
    const where = await getScopedRestaurantWhere({ accountId: "test-tenant-a", email: "owner@test", managerId: managerIds.all, role: "Admin" });
    const rows = await prisma.restaurants.findMany({ where, select: { id: true } });
    expect(rows.map((row) => row.id).sort()).toEqual([...tenantARestaurantIds].sort());
    expect(rows.some((row) => row.id === tenantBRestaurantId)).toBe(false);
  });

  it("limits a selected-location manager to the assigned restaurant", async () => {
    const where = await getScopedRestaurantWhere({ accountId: "test-tenant-a", email: "manager@test", managerId: managerIds.selected, role: "Manager" });
    const rows = await prisma.restaurants.findMany({ where, select: { id: true } });
    expect(rows.map((row) => row.id)).toEqual([tenantARestaurantIds[1]]);
  });
});
