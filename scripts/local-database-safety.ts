export function assertSafeLocalSeedDatabaseUrl(rawUrl: string | undefined) {
  const value = rawUrl?.trim();
  if (!value) throw new Error("A local development or test database URL is required.");

  const parsed = new URL(value);
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  const isDisposableName = databaseName.includes("dev") || databaseName.includes("test");

  if (!isLocalHost || !isDisposableName) {
    throw new Error(`Refusing to seed non-local development database '${databaseName}'.`);
  }

  return value;
}
