import { spawnSync } from "node:child_process";

const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:55431/fohboh_sentry_dev";
const composeFile = "docker-compose.dev.yml";
const docker = process.platform === "win32" ? "docker.exe" : "docker";

const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: "",
  DB_HOST: "",
  DB_NAME: "",
  DB_PASSWORD: "",
  DB_PORT: "",
  DB_SSLMODE: "disable",
  DB_USER: "",
  PGSSLMODE: "disable",
  SENTRY_SESSION_SECRET:
    process.env.SENTRY_SESSION_SECRET || "local-development-session-secret-not-for-production",
};

function run(command, args, label) {
  process.stdout.write(`\n[development] ${label}\n`);
  const result = spawnSync(command, args, {
    env: environment,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`\n[development] Could not run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
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

run(docker, ["compose", "-f", composeFile, "up", "-d", "--wait"], "Starting persistent PostgreSQL");
runPnpm(["exec", "prisma", "migrate", "deploy"], "Applying database migrations");
runPnpm(["seed:test"], "Creating the local test account");

console.log("\n[development] Ready");
console.log("  URL:      http://localhost:3000");
console.log("  Email:    e2e-superadmin@fohboh.test");
console.log("  Password: E2eFohBohTestOnly!\n");

runPnpm(["dev:app", ...process.argv.slice(2)], "Starting Next.js");
