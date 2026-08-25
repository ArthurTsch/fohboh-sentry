import { spawnSync } from "node:child_process";

const localTestDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:55432/fohboh_sentry_test";
const suppliedTestDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testDatabaseUrl = suppliedTestDatabaseUrl || localTestDatabaseUrl;
const parsedDatabaseUrl = new URL(testDatabaseUrl);
const managesLocalDatabase = !suppliedTestDatabaseUrl;
const docker = process.platform === "win32" ? "docker.exe" : "docker";
const composeArgs = [
  "compose",
  "--project-name",
  "fohboh-sentry-release-test",
  "-f",
  "docker-compose.test.yml",
];

const environment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
  DB_HOST: parsedDatabaseUrl.hostname,
  DB_NAME: parsedDatabaseUrl.pathname.slice(1),
  DB_PASSWORD: decodeURIComponent(parsedDatabaseUrl.password),
  DB_PORT: parsedDatabaseUrl.port || "5432",
  DB_SSLMODE: "disable",
  DB_USER: decodeURIComponent(parsedDatabaseUrl.username),
  E2E_MANAGER_EMAIL: process.env.E2E_MANAGER_EMAIL || "e2e-superadmin@fohboh.test",
  E2E_MANAGER_PASSWORD: process.env.E2E_MANAGER_PASSWORD || "E2eFohBohTestOnly!",
  PGSSLMODE: "disable",
  SENTRY_SESSION_SECRET:
    process.env.SENTRY_SESSION_SECRET || "local-release-test-session-secret-not-for-production",
};

function run(command, args, label) {
  process.stdout.write(`\n[release validation] ${label}\n`);
  const result = spawnSync(command, args, {
    env: environment,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
  }
}

function runPnpm(args, label) {
  if (process.env.npm_execpath) {
    const executable = process.env.npm_execpath;
    if (executable.toLowerCase().endsWith(".exe")) {
      run(executable, args, label);
    } else {
      run(process.execPath, [executable, ...args], label);
    }
    return;
  }
  run("pnpm", args, label);
}

let exitCode = 0;
let localDatabaseStarted = false;
try {
  if (managesLocalDatabase) {
    run(docker, [...composeArgs, "up", "-d", "--wait"], "Starting disposable PostgreSQL");
    localDatabaseStarted = true;
  }
  runPnpm(["exec", "prisma", "migrate", "deploy"], "Applying test database migrations");
  runPnpm(["seed:test"], "Seeding the browser-test identity");
  runPnpm(["verify"], "Running lint, unit, type, and production-build checks");
  runPnpm(["test:integration"], "Running PostgreSQL integration tests");
  runPnpm(["test:e2e"], "Running Playwright browser tests");
} catch (error) {
  console.error(`\n[release validation] ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  if (localDatabaseStarted) {
    try {
      run(docker, [...composeArgs, "down", "--volumes"], "Removing disposable PostgreSQL");
    } catch (error) {
      console.error(`\n[release validation] ${error instanceof Error ? error.message : String(error)}`);
      exitCode = 1;
    }
  }
}

process.exit(exitCode);
