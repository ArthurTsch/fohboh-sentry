import { beforeEach, describe, expect, it, vi } from "vitest";

const getManagerSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getManagerSession }));

describe("GET /api/auth/session", () => {
  beforeEach(() => getManagerSession.mockReset());

  it("returns null for an anonymous request", async () => {
    getManagerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: null });
  });

  it("returns the server-resolved session", async () => {
    getManagerSession.mockResolvedValue({ accountId: "tenant-a", email: "a@example.com", managerId: 1, role: "Manager" });
    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET();
    expect((await response.json()).session).toMatchObject({ accountId: "tenant-a", role: "Manager" });
  });
});
