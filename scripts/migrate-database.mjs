import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local", override: false, quiet: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[database migration] DATABASE_URL is missing. Add it to .env.local or the current shell environment.");
  process.exit(1);
}

let target;
try {
  target = new URL(databaseUrl);
} catch {
  console.error("[database migration] DATABASE_URL is not a valid URL.");
  process.exit(1);
}

if (target.protocol !== "postgresql:" && target.protocol !== "postgres:") {
  console.error("[database migration] DATABASE_URL must use the postgresql:// or postgres:// protocol.");
  process.exit(1);
}

const databaseName = target.pathname.replace(/^\//, "") || "(default)";
console.log(`[database migration] Target: ${target.hostname}:${target.port || "5432"}/${databaseName}`);

function runPrisma(args, label) {
  console.log(`\n[database migration] ${label}`);
  const pnpmEntry = process.env.npm_execpath;
  const result = pnpmEntry
    ? pnpmEntry.toLowerCase().endsWith(".exe")
      ? spawnSync(pnpmEntry, ["exec", "prisma", ...args], {
          env: process.env,
          shell: false,
          stdio: "inherit",
        })
      : spawnSync(process.execPath, [pnpmEntry, "exec", "prisma", ...args], {
          env: process.env,
          shell: false,
          stdio: "inherit",
        })
    : spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "prisma", ...args], {
        env: process.env,
        shell: process.platform === "win32",
        stdio: "inherit",
      });

  if (result.error) {
    console.error(`[database migration] Could not run Prisma: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runPrisma(["migrate", "status"], "Checking migration status");

if (process.argv.includes("--status-only")) {
  process.exit(0);
}

runPrisma(["migrate", "deploy"], "Applying pending migrations");
runPrisma(["migrate", "status"], "Verifying final migration status");
console.log("\n[database migration] Database migrations are up to date.");
