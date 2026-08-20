import { defineConfig, devices } from "@playwright/test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabase = testDatabaseUrl ? new URL(testDatabaseUrl) : null;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev --port 3100",
        env: {
          ...process.env,
          DATABASE_URL: testDatabaseUrl || process.env.DATABASE_URL || "",
          ...(testDatabase
            ? {
                DB_HOST: testDatabase.hostname,
                DB_NAME: testDatabase.pathname.slice(1),
                DB_PASSWORD: decodeURIComponent(testDatabase.password),
                DB_PORT: testDatabase.port || "5432",
                DB_USER: decodeURIComponent(testDatabase.username),
              }
            : {}),
          DB_SSLMODE: process.env.DB_SSLMODE || "disable",
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: "http://127.0.0.1:3100",
      },
});
