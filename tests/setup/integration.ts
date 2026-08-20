import { beforeAll } from "vitest";
import { assertSafeTestDatabaseUrl } from "../helpers/test-database";

beforeAll(() => {
  const rawUrl = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = rawUrl;
  process.env.DB_SSLMODE ||= "disable";
});
