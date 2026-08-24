import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateManager = vi.fn();
const checkRateLimits = vi.fn();
const getRetryAfterSeconds = vi.fn();

vi.mock("@/lib/auth/manager-auth", () => ({ authenticateManager }));
vi.mock("@/lib/ops/rate-limit", () => ({ checkRateLimits, getRetryAfterSeconds }));
vi.mock("@/lib/ops/audit", () => ({
  logServerError: vi.fn(),
  logServerEvent: vi.fn(),
  writeAuditLog: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: { $executeRaw: vi.fn() } }));

describe("POST /api/auth/login rate limiting", () => {
  beforeEach(() => {
    authenticateManager.mockReset();
    checkRateLimits.mockReset();
    getRetryAfterSeconds.mockReset();
  });

  it("returns a consistent 429 with Retry-After before authentication", async () => {
    checkRateLimits.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 321_000,
      storeAvailable: true,
    });
    getRetryAfterSeconds.mockReturnValue(321);
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(new Request("http://test/api/auth/login", {
      body: JSON.stringify({ email: "  User@Example.Test ", password: "secret" }),
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.99" },
      method: "POST",
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("321");
    expect(await response.json()).toEqual({ error: "Too many login attempts. Try again later." });
    expect(authenticateManager).not.toHaveBeenCalled();
    expect(checkRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({ failureMode: "closed", key: "login-account:user@example.test", limit: 8 }),
      expect.objectContaining({ failureMode: "closed", key: "login-address:unknown", limit: 40 }),
    ]);
  });
});
