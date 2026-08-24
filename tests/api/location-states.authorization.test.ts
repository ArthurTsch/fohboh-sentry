import { beforeEach, describe, expect, it, vi } from "vitest";

const requireManagerSession = vi.fn();
const getScopedRestaurantWhere = vi.fn();
const getTeamAccountId = vi.fn();
const findRestaurant = vi.fn();
const findState = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireManagerSession }));
vi.mock("@/lib/auth/team-access", () => ({ getScopedRestaurantWhere, getTeamAccountId }));
vi.mock("@/lib/prisma", () => ({
  default: {
    restaurant_sentry_state: { findUnique: findState, upsert },
    restaurants: { findFirst: findRestaurant },
  },
}));

const managerSession = {
  accountId: "tenant-a",
  email: "manager@example.com",
  managerId: 2,
  role: "Manager" as const,
};

function post(body: Record<string, unknown>) {
  return new Request("http://test/api/location-states", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

describe("POST /api/location-states authorization boundary", () => {
  beforeEach(() => {
    requireManagerSession.mockReset();
    getScopedRestaurantWhere.mockReset();
    getTeamAccountId.mockReset();
    findRestaurant.mockReset();
    findState.mockReset();
    upsert.mockReset();
  });

  it("rejects anonymous writes without touching persistence", async () => {
    requireManagerSession.mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({ locationId: "LOC-A" }));
    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects Viewer writes without touching persistence", async () => {
    requireManagerSession.mockResolvedValue({ accountId: "tenant-a", email: "viewer@example.com", managerId: 2, role: "Viewer" });
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({ locationId: "LOC-A" }));
    expect(response.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    "accountId",
    "completed",
    "createdBy",
    "governanceInitializedAt",
    "governanceSealedAt",
    "governanceStatus",
    "ium",
    "lastCertified",
    "m01Score",
    "m02Score",
    "recoveryDisplay",
    "status",
  ])("rejects the server-owned %s field", async (field) => {
    requireManagerSession.mockResolvedValue(managerSession);
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({ locationId: "LOC-A", [field]: "forged" }));
    expect(response.status).toBe(400);
    expect(findRestaurant).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    { modules: {} },
    { onboardingChecklist: [] },
    { onboardingProgress: "complete" },
  ])("rejects malformed onboarding payloads", async (payload) => {
    requireManagerSession.mockResolvedValue(managerSession);
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({ locationId: "LOC-A", ...payload }));
    expect(response.status).toBe(400);
    expect(findRestaurant).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    { restaurantId: 22 },
    { unitId: "TENANT-B-UNIT" },
    { storeId: "TENANT-B-STORE" },
    { locationId: "TENANT-B-LOCATION" },
  ])("returns 404 when $key resolves outside the session scope", async (selector) => {
    requireManagerSession.mockResolvedValue(managerSession);
    getScopedRestaurantWhere.mockResolvedValue({ id: { in: [11] } });
    findState.mockResolvedValue(null);
    findRestaurant.mockResolvedValue(null);
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post(selector));
    expect(response.status).toBe(404);
    expect(findRestaurant).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [11] } }),
    }));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("persists authorized onboarding fields without overwriting server-owned state", async () => {
    requireManagerSession.mockResolvedValue(managerSession);
    getScopedRestaurantWhere.mockResolvedValue({ id: { in: [11] } });
    findState.mockResolvedValue({
      account_id: "tenant-a",
      created_by: 1,
      location_id: "LOC-A",
      restaurant_id: 11,
    });
    findRestaurant.mockResolvedValue({ created_by: 1, id: 11, store_id: "STORE-A", unit_id: "UNIT-A" });
    upsert.mockResolvedValue({ id: 7, location_id: "LOC-A", restaurant_id: 11 });
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({
      locationId: "LOC-A",
      modules: [{ label: "M02" }],
      onboardingChecklist: { M02: [true] },
      onboardingProgress: { completed: false, stepIndex: 2 },
    }));
    expect(response.status).toBe(200);
    const args = upsert.mock.calls[0][0];
    expect(args.update).toMatchObject({
      modules_json: [{ label: "M02" }],
      onboarding_checklist: { M02: [true] },
      onboarding_progress: { completed: false, stepIndex: 2 },
    });
    for (const key of [
      "account_id", "created_by", "governance_status", "m01_score", "m02_score",
      "recovery_display", "status", "last_certified",
    ]) {
      expect(args.update).not.toHaveProperty(key);
    }
  });

  it("moves a completed onboarding location out of Onboarding", async () => {
    requireManagerSession.mockResolvedValue(managerSession);
    getScopedRestaurantWhere.mockResolvedValue({ id: { in: [11] } });
    findState.mockResolvedValue({
      account_id: "tenant-a",
      created_by: 1,
      location_id: "LOC-A",
      m01_score: 21,
      m02_score: 0,
      restaurant_id: 11,
      status: "Onboarding",
    });
    findRestaurant.mockResolvedValue({ created_by: 1, id: 11, store_id: "STORE-A", unit_id: "UNIT-A" });
    upsert.mockResolvedValue({ id: 7, location_id: "LOC-A", restaurant_id: 11 });
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({
      locationId: "LOC-A",
      onboardingProgress: { completed: true, stepIndex: 5 },
    }));

    expect(response.status).toBe(200);
    expect(upsert.mock.calls[0][0].update).toMatchObject({ status: "At Risk" });
  });

  it("derives account, creator, and canonical location when creating state", async () => {
    requireManagerSession.mockResolvedValue(managerSession);
    getScopedRestaurantWhere.mockResolvedValue({ created_by: 2 });
    getTeamAccountId.mockResolvedValue("tenant-a");
    findState.mockResolvedValue(null);
    findRestaurant.mockResolvedValue({ created_by: 9, id: 11, store_id: "STORE-A", unit_id: "UNIT-A" });
    upsert.mockResolvedValue({ id: 8, location_id: "UNIT-A", restaurant_id: 11 });
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(post({ restaurantId: 11, onboardingProgress: { stepIndex: 1 } }));
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        account_id: "tenant-a",
        created_by: 9,
        location_id: "UNIT-A",
        restaurant_id: 11,
      }),
    }));
  });
});
