import "dotenv/config";
import { hash } from "bcryptjs";
import { assertSafeTestDatabaseUrl } from "../tests/helpers/test-database";

async function main() {
  const databaseUrl = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
  process.env.DATABASE_URL = databaseUrl;
  process.env.DB_SSLMODE ||= "disable";
  const { default: prisma } = await import("../src/lib/prisma");
  const email = process.env.E2E_MANAGER_EMAIL || "e2e-superadmin@fohboh.test";
  const password = process.env.E2E_MANAGER_PASSWORD || "E2eFohBohTestOnly!";

  await prisma.managers.upsert({
    where: { email },
    create: {
      active: true,
      email,
      email_verified: true,
      full_name: "E2E SuperAdmin",
      password_hash: await hash(password, 10),
      role: "SuperAdmin",
    },
    update: {
      active: true,
      password_hash: await hash(password, 10),
      role: "SuperAdmin",
    },
  });
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
