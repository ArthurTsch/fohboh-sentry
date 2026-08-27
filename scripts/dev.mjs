import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:55431/fohboh_sentry_dev";
const composeFile = "docker-compose.dev.yml";
const docker = process.platform === "win32" ? "docker.exe" : "docker";
const dockerStartupTimeoutMs = 120_000;

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

function dockerIsReady() {
  const result = spawnSync(docker, ["info"], {
    env: environment,
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureDockerIsReady() {
  if (dockerIsReady()) {
    console.log("\n[development] Docker is already running");
    return;
  }

  if (process.platform !== "win32") {
    console.error("\n[development] Docker is not running. Start the Docker daemon, then run pnpm dev again.");
    process.exit(1);
  }

  const candidates = [
    process.env.ProgramFiles
      ? join(process.env.ProgramFiles, "Docker", "Docker", "Docker Desktop.exe")
      : null,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Docker", "Docker Desktop.exe")
      : null,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Programs", "DockerDesktop", "Docker Desktop.exe")
      : null,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Programs", "DockerDesktop", "frontend", "Docker Desktop.exe")
      : null,
  ].filter(Boolean);
  const dockerDesktop = candidates.find((candidate) => existsSync(candidate));

  if (!dockerDesktop) {
    console.error("\n[development] Docker is not running and Docker Desktop could not be found. Start Docker Desktop, then run pnpm dev again.");
    process.exit(1);
  }

  console.log("\n[development] Docker is not running; starting Docker Desktop");
  const desktop = spawn(dockerDesktop, [], {
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  desktop.unref();

  const startedAt = Date.now();
  let nextProgressAt = startedAt + 10_000;
  while (Date.now() - startedAt < dockerStartupTimeoutMs) {
    if (dockerIsReady()) {
      console.log("[development] Docker Desktop is ready");
      return;
    }
    if (Date.now() >= nextProgressAt) {
      console.log("[development] Waiting for Docker Desktop...");
      nextProgressAt += 10_000;
    }
    await wait(2_000);
  }

  console.error("\n[development] Docker Desktop did not become ready within 120 seconds. Check Docker Desktop, then run pnpm dev again.");
  process.exit(1);
}

await ensureDockerIsReady();
run(docker, ["compose", "-f", composeFile, "up", "-d", "--wait"], "Starting persistent PostgreSQL");
runPnpm(["exec", "prisma", "migrate", "deploy"], "Applying database migrations");

console.log("\n[development] Ready");
console.log("  URL: http://localhost:3000");
console.log("  Existing database records were left unchanged.\n");

runPnpm(["dev:app", ...process.argv.slice(2)], "Starting Next.js");
