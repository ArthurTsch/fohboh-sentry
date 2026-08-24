import { afterEach, describe, expect, it } from "vitest";
import { getRequestContextFromRequest } from "@/lib/ops/request";

const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

describe("trusted client IP policy", () => {
  it("ignores spoofable forwarding headers outside Vercel", () => {
    delete process.env.VERCEL;
    const request = new Request("http://test", {
      headers: {
        "x-forwarded-for": "198.51.100.10",
        "x-real-ip": "198.51.100.11",
        "x-vercel-forwarded-for": "198.51.100.12",
      },
    });
    expect(getRequestContextFromRequest(request).ipAddress).toBeNull();
  });

  it("uses only a valid Vercel-controlled address on Vercel", () => {
    process.env.VERCEL = "1";
    const request = new Request("http://test", {
      headers: {
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "203.0.113.2",
        "x-vercel-forwarded-for": "198.51.100.20",
      },
    });
    expect(getRequestContextFromRequest(request).ipAddress).toBe("198.51.100.20");
  });

  it("rejects malformed trusted-header values", () => {
    process.env.VERCEL = "1";
    const request = new Request("http://test", {
      headers: { "x-vercel-forwarded-for": "chosen-by-client" },
    });
    expect(getRequestContextFromRequest(request).ipAddress).toBeNull();
  });
});
