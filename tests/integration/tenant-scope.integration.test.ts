import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getScopedRestaurantWhere } from "@/lib/auth/team-access";

const managerIds = { admin: 910001, manager: 910002, viewer: 910003 };
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
    await prisma.account_memberships_v2.create({ data: { access_scope: "all_locations", account_id: "test-tenant-a", manager_id: managerIds.admin, team_role: "Owner" } });
    const managerMembership = await prisma.account_memberships_v2.create({ data: { access_scope: "selected_locations", account_id: "test-tenant-a", manager_id: managerIds.manager, team_role: "Location Manager" } });
    const viewerMembership = await prisma.account_memberships_v2.create({ data: { access_scope: "selected_locations", account_id: "test-tenant-a", manager_id: managerIds.viewer, team_role: "Read-only" } });
    await Promise.all([
      prisma.account_member_locations_v2.create({ data: { membership_id: managerMembership.id, restaurant_id: a2.id } }),
      prisma.account_member_locations_v2.create({ data: { membership_id: viewerMembership.id, restaurant_id: a1.id } }),
    ]);
  });

  afterAll(async () => {
    await prisma.account_member_locations_v2.deleteMany({ where: { restaurant_id: { in: [...tenantARestaurantIds, tenantBRestaurantId] } } });
    await prisma.account_memberships_v2.deleteMany({ where: { manager_id: { in: Object.values(managerIds) } } });
    await prisma.restaurant_sentry_state.deleteMany({ where: { restaurant_id: { in: [...tenantARestaurantIds, tenantBRestaurantId] } } });
    await prisma.restaurants.deleteMany({ where: { id: { in: [...tenantARestaurantIds, tenantBRestaurantId] } } });
    await prisma.$disconnect();
  });

  it("limits an all-location account owner to their tenant", async () => {
    const where = await getScopedRestaurantWhere({ accountId: "test-tenant-a", email: "owner@test", managerId: managerIds.admin, role: "Admin" });
    const rows = await prisma.restaurants.findMany({ where, select: { id: true } });
    expect(rows.map((row) => row.id).sort()).toEqual([...tenantARestaurantIds].sort());
    expect(rows.some((row) => row.id === tenantBRestaurantId)).toBe(false);
  });

  it("limits a selected-location manager to the assigned restaurant", async () => {
    const where = await getScopedRestaurantWhere({ accountId: "test-tenant-a", email: "manager@test", managerId: managerIds.manager, role: "Manager" });
    const rows = await prisma.restaurants.findMany({ where, select: { id: true } });
    expect(rows.map((row) => row.id)).toEqual([tenantARestaurantIds[1]]);
  });

  it("applies selected-location changes to an existing session immediately", async () => {
    const session = { accountId: "test-tenant-a", email: "manager@test", managerId: managerIds.manager, role: "Manager" as const };
    const membership = await prisma.account_memberships_v2.findFirstOrThrow({ where: { manager_id: managerIds.manager } });
    await prisma.account_member_locations_v2.deleteMany({ where: { membership_id: membership.id } });
    await prisma.account_member_locations_v2.create({
      data: { membership_id: membership.id, restaurant_id: tenantARestaurantIds[0] },
    });

    const changedWhere = await getScopedRestaurantWhere(session);
    const changedRows = await prisma.restaurants.findMany({ where: changedWhere, select: { id: true } });
    expect(changedRows.map((row) => row.id)).toEqual([tenantARestaurantIds[0]]);

    await prisma.account_member_locations_v2.deleteMany({ where: { membership_id: membership.id } });
    await prisma.account_member_locations_v2.create({
      data: { membership_id: membership.id, restaurant_id: tenantARestaurantIds[1] },
    });
  });

  it("limits a Viewer to the assigned same-tenant restaurant", async () => {
    const where = await getScopedRestaurantWhere({ accountId: "test-tenant-a", email: "viewer@test", managerId: managerIds.viewer, role: "Viewer" });
    const rows = await prisma.restaurants.findMany({ where, select: { id: true } });
    expect(rows.map((row) => row.id)).toEqual([tenantARestaurantIds[0]]);
    expect(rows.some((row) => row.id === tenantBRestaurantId)).toBe(false);
  });

  it.each(["WGS Manager", "SuperAdmin"] as const)("allows %s global restaurant scope", async (role) => {
    const where = await getScopedRestaurantWhere({ accountId: "platform", email: `${role}@test`, role });
    const rows = await prisma.restaurants.findMany({ where, select: { id: true } });
    expect(rows.some((row) => row.id === tenantARestaurantIds[0])).toBe(true);
    expect(rows.some((row) => row.id === tenantBRestaurantId)).toBe(true);
  });

  it("revokes an existing Manager identity immediately when membership is deactivated", async () => {
    const session = { accountId: "test-tenant-a", email: "manager@test", managerId: managerIds.manager, role: "Manager" as const };
    const membership = await prisma.account_memberships_v2.findFirstOrThrow({ where: { manager_id: managerIds.manager } });
    await prisma.account_memberships_v2.update({ where: { id: membership.id }, data: { status: "inactive" } });

    const where = await getScopedRestaurantWhere(session);
    const rows = await prisma.restaurants.findMany({ where, select: { id: true } });
    expect(rows).toEqual([]);

    await prisma.account_memberships_v2.update({ where: { id: membership.id }, data: { status: "active" } });
  });
});
