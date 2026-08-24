import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const logServerError = vi.fn();
vi.mock("@/lib/prisma", () => ({ default: { $queryRaw: queryRaw } }));
vi.mock("@/lib/ops/audit", () => ({ logServerError }));

describe("rate limiter failure behavior", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    logServerError.mockReset();
  });

  it("fails closed for authentication when PostgreSQL is unavailable", async () => {
    queryRaw.mockRejectedValue(new Error("database unavailable"));
    const { checkRateLimit } = await import("@/lib/ops/rate-limit");
    const result = await checkRateLimit({
      failureMode: "closed",
      key: "login-account:user@example.test",
      limit: 8,
      windowMs: 60_000,
    });
    expect(result).toMatchObject({ allowed: false, remaining: 0, storeAvailable: false });
    expect(logServerError).toHaveBeenCalledWith(
      "rate_limit_store_failed",
      expect.any(Error),
      expect.objectContaining({ failureMode: "closed", keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    );
  });

  it("fails open for authenticated expensive operations", async () => {
    queryRaw.mockRejectedValue(new Error("database unavailable"));
    const { checkRateLimit } = await import("@/lib/ops/rate-limit");
    const result = await checkRateLimit({
      failureMode: "open",
      key: "upload-identity:42",
      limit: 120,
      windowMs: 60_000,
    });
    expect(result).toMatchObject({ allowed: true, remaining: 120, storeAvailable: false });
  });

  it("returns a minimum one-second Retry-After value", async () => {
    const { getRetryAfterSeconds } = await import("@/lib/ops/rate-limit");
    expect(getRetryAfterSeconds({ allowed: false, remaining: 0, resetAt: Date.now() - 1, storeAvailable: true })).toBe(1);
  });
});
