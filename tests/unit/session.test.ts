import { describe, expect, it } from "vitest";
import { createSessionCookieValue, parseSessionCookieValue } from "@/lib/auth/session";

describe("signed manager sessions", () => {
  it("round-trips an intact session", () => {
    const session = { accountId: "tenant-a", email: "owner@example.com", managerId: 7, role: "Admin" as const };
    expect(parseSessionCookieValue(createSessionCookieValue(session))).toEqual(session);
  });

  it("rejects a tampered cookie", () => {
    const cookie = createSessionCookieValue({ accountId: "tenant-a", email: "viewer@example.com", role: "Viewer" });
    expect(parseSessionCookieValue(`${cookie}x`)).toBeNull();
  });
});
