import { describe, expect, it } from "vitest";
import { assertSafeTestDatabaseUrl } from "../helpers/test-database";

describe("integration database safety", () => {
  it("accepts an explicitly named test database", () => {
    expect(assertSafeTestDatabaseUrl("postgresql://user:pass@localhost:5432/fohboh_sentry_test")).toContain("fohboh_sentry_test");
  });

  it.each([
    undefined,
    "postgresql://user:pass@prod.example.com:5432/fohboh_sentry",
  ])("rejects missing or non-test database URLs", (value) => {
    expect(() => assertSafeTestDatabaseUrl(value)).toThrow();
  });
});
