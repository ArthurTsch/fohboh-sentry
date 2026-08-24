import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";

const requireManagerSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireManagerSession }));

const managerId = 920001;
let tenantARestaurantId = 0;
let tenantBRestaurantId = 0;

function post(body: Record<string, unknown>) {
  return new Request("http://test/api/location-states", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

describe("POST /api/location-states against PostgreSQL", () => {
  beforeAll(async () => {
    const suffix = Date.now();
    await prisma.managers.create({
      data: { id: managerId, email: `web001-manager-${suffix}@test.invalid`, password_hash: "test-only", role: "Admin" },
    });
    await prisma.customers.createMany({
      data: [
        { account_id: "web001-tenant-a", name: "TEST WEB-001 Tenant A" },
        { account_id: "web001-tenant-b", name: "TEST WEB-001 Tenant B" },
      ],
    });
    const [tenantA, tenantB] = await Promise.all([
      prisma.restaurants.create({
        data: { active: true, name: "TEST WEB-001 Tenant A", store_id: `WEB001-A-STORE-${suffix}`, unit_id: `WEB001-A-UNIT-${suffix}` },
      }),
      prisma.restaurants.create({
        data: { active: true, name: "TEST WEB-001 Tenant B", store_id: `WEB001-B-STORE-${suffix}`, unit_id: `WEB001-B-UNIT-${suffix}` },
      }),
    ]);
    tenantARestaurantId = tenantA.id;
    tenantBRestaurantId = tenantB.id;
    await Promise.all([
      prisma.restaurant_sentry_state.create({
        data: {
          account_id: "web001-tenant-a",
          created_by: managerId,
          governance_status: "sealed",
          last_certified: "Jun 2026",
          location_id: `WEB001-A-LOC-${suffix}`,
          m01_score: 91,
          m02_score: 92,
          recovery_display: "$123.45",
          restaurant_id: tenantA.id,
          status: "Certified",
        },
      }),
      prisma.restaurant_sentry_state.create({
        data: {
          account_id: "web001-tenant-b",
          governance_status: "sealed",
          last_certified: "Jun 2026",
          location_id: `WEB001-B-LOC-${suffix}`,
          m01_score: 88,
          m02_score: 89,
          recovery_display: "$999.99",
          restaurant_id: tenantB.id,
          status: "Certified",
        },
      }),
      prisma.account_memberships_v2.create({
        data: { access_scope: "all_locations", account_id: "web001-tenant-a", manager_id: managerId, team_role: "Owner" },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.account_memberships_v2.deleteMany({ where: { manager_id: managerId } });
    await prisma.restaurant_sentry_state.deleteMany({ where: { restaurant_id: { in: [tenantARestaurantId, tenantBRestaurantId] } } });
    await prisma.restaurants.deleteMany({ where: { id: { in: [tenantARestaurantId, tenantBRestaurantId] } } });
    await prisma.managers.deleteMany({ where: { id: managerId } });
    await prisma.customers.deleteMany({ where: { account_id: { in: ["web001-tenant-a", "web001-tenant-b"] } } });
    await prisma.$disconnect();
  });

  it("rejects every cross-tenant identifier without changing Tenant B", async () => {
    requireManagerSession.mockResolvedValue({
      accountId: "web001-tenant-a",
      email: "owner@tenant-a.test",
      managerId,
      role: "Admin",
    });
    const tenantBRestaurant = await prisma.restaurants.findUniqueOrThrow({ where: { id: tenantBRestaurantId } });
    const tenantBState = await prisma.restaurant_sentry_state.findUniqueOrThrow({ where: { restaurant_id: tenantBRestaurantId } });
    const before = await prisma.restaurant_sentry_state.findUniqueOrThrow({ where: { restaurant_id: tenantBRestaurantId } });
    const { POST } = await import("@/app/api/location-states/route");

    for (const selector of [
      { restaurantId: tenantBRestaurantId },
      { unitId: tenantBRestaurant.unit_id },
      { storeId: tenantBRestaurant.store_id },
      { locationId: tenantBState.location_id },
    ]) {
      const response = await POST(post({ ...selector, onboardingProgress: { stepIndex: 99 } }));
      expect(response.status).toBe(404);
    }

    const after = await prisma.restaurant_sentry_state.findUniqueOrThrow({ where: { restaurant_id: tenantBRestaurantId } });
    expect(after).toEqual(before);
  });

  it("persists onboarding data while preserving authoritative certification fields", async () => {
    requireManagerSession.mockResolvedValue({
      accountId: "web001-tenant-a",
      email: "owner@tenant-a.test",
      managerId,
      role: "Admin",
    });
    const before = await prisma.restaurant_sentry_state.findUniqueOrThrow({ where: { restaurant_id: tenantARestaurantId } });
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({
      locationId: before.location_id,
      onboardingChecklist: { M02: [true, false] },
      onboardingProgress: { completed: false, stepIndex: 2 },
    }));
    expect(response.status).toBe(200);

    const after = await prisma.restaurant_sentry_state.findUniqueOrThrow({ where: { restaurant_id: tenantARestaurantId } });
    expect(after.onboarding_checklist).toEqual({ M02: [true, false] });
    expect(after.onboarding_progress).toEqual({ completed: false, stepIndex: 2 });
    expect(after).toMatchObject({
      account_id: before.account_id,
      created_by: before.created_by,
      governance_status: before.governance_status,
      last_certified: before.last_certified,
      location_id: before.location_id,
      m01_score: before.m01_score,
      m02_score: before.m02_score,
      recovery_display: before.recovery_display,
      status: before.status,
    });
  });

  it("rejects Viewer writes against an authorized restaurant", async () => {
    requireManagerSession.mockResolvedValue({
      accountId: "web001-tenant-a",
      email: "viewer@tenant-a.test",
      managerId,
      role: "Viewer",
    });
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({ restaurantId: tenantARestaurantId, onboardingProgress: { stepIndex: 3 } }));
    expect(response.status).toBe(403);
  });
});
