import { describe, expect, it } from "vitest";
import { createSessionCookieValue, getSessionCookieOptions, parseSessionCookieValue } from "@/lib/auth/session";

describe("signed manager sessions", () => {
  it("round-trips an intact session", () => {
    const session = { accountId: "tenant-a", email: "owner@example.com", managerId: 7, role: "Admin" as const, sessionVersion: 1 };
    expect(parseSessionCookieValue(createSessionCookieValue(session))).toEqual(session);
  });

  it("rejects a tampered cookie", () => {
    const cookie = createSessionCookieValue({ accountId: "tenant-a", email: "viewer@example.com", role: "Viewer", sessionVersion: 1 });
    expect(parseSessionCookieValue(`${cookie}x`)).toBeNull();
  });

  it("rejects legacy cookies without a revocable session version", () => {
    const legacyCookie = createSessionCookieValue({
      accountId: "tenant-a",
      email: "legacy@example.com",
      managerId: 8,
      role: "Manager",
    });

    expect(parseSessionCookieValue(legacyCookie)).toBeNull();
  });

  it("keeps defensive cookie attributes enabled", () => {
    expect(getSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
  });
});
