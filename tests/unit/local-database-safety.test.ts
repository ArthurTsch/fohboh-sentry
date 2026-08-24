import { describe, expect, it } from "vitest";

import { assertSafeLocalSeedDatabaseUrl } from "../../scripts/local-database-safety";

describe("local database seeding safety", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:55431/fohboh_sentry_dev",
    "postgresql://postgres:postgres@localhost:55432/fohboh_sentry_test",
  ])("allows a local development or test database: %s", (url) => {
    expect(assertSafeLocalSeedDatabaseUrl(url)).toBe(url);
  });

  it.each([
    "postgresql://postgres:postgres@db.example.com:5432/fohboh_sentry_dev",
    "postgresql://postgres:postgres@localhost:5432/fohboh_sentry_prod",
  ])("rejects a remote or production-like database: %s", (url) => {
    expect(() => assertSafeLocalSeedDatabaseUrl(url)).toThrow(/Refusing to seed/);
  });
});
