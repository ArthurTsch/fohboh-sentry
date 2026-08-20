import { beforeEach, describe, expect, it, vi } from "vitest";

const requireManagerSession = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/auth/session", () => ({ requireManagerSession }));
vi.mock("@/lib/prisma", () => ({
  default: {
    restaurant_sentry_state: { upsert },
    restaurants: { findFirst: vi.fn() },
  },
}));

describe("POST /api/location-states authorization boundary", () => {
  beforeEach(() => {
    requireManagerSession.mockReset();
    upsert.mockReset();
  });

  it("rejects anonymous writes without touching persistence", async () => {
    requireManagerSession.mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(new Request("http://test/api/location-states", { method: "POST", body: JSON.stringify({ locationId: "LOC-A" }) }));
    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects Viewer writes without touching persistence", async () => {
    requireManagerSession.mockResolvedValue({ accountId: "tenant-a", email: "viewer@example.com", managerId: 2, role: "Viewer" });
    const { POST } = await import("@/app/api/location-states/route");
    const response = await POST(new Request("http://test/api/location-states", { method: "POST", body: JSON.stringify({ locationId: "LOC-A" }) }));
    expect(response.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });
});
