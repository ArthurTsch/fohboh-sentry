export function assertSafeTestDatabaseUrl(rawUrl: string | undefined) {
  const value = rawUrl?.trim();
  if (!value) throw new Error("TEST_DATABASE_URL is required for integration tests.");

  const parsed = new URL(value);
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  if (!databaseName.includes("test")) {
    throw new Error(`Refusing integration tests against non-test database '${databaseName}'.`);
  }
  return value;
}
