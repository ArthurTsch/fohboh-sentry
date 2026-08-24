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

  const manager = await prisma.managers.upsert({
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
  const customer = await prisma.customers.upsert({
    where: { account_id: "e2e-test-account" },
    create: {
      account_id: "e2e-test-account",
      name: "E2E Test Account",
    },
    update: {
      name: "E2E Test Account",
    },
  });
  const restaurant = await prisma.restaurants.upsert({
    where: { unit_id: "E2E-LOC-001" },
    create: {
      active: true,
      created_by: manager.id,
      name: "E2E Test Restaurant",
      unit_id: "E2E-LOC-001",
    },
    update: {
      active: true,
      created_by: manager.id,
      name: "E2E Test Restaurant",
    },
  });
  await prisma.locations_v2.upsert({
    where: {
      customer_id_external_id: {
        customer_id: customer.id,
        external_id: "E2E-LOC-001",
      },
    },
    create: {
      customer_id: customer.id,
      external_id: "E2E-LOC-001",
      name: "E2E Test Restaurant",
    },
    update: { deleted_at: null, name: "E2E Test Restaurant" },
  });
  await prisma.account_memberships_v2.upsert({
    where: { manager_id: manager.id },
    create: {
      access_scope: "all_locations",
      account_holder: true,
      account_id: "e2e-test-account",
      manager_id: manager.id,
      status: "active",
      team_role: "Owner",
    },
    update: {
      access_scope: "all_locations",
      account_holder: true,
      account_id: "e2e-test-account",
      status: "active",
      team_role: "Owner",
    },
  });
  await prisma.restaurant_sentry_state.upsert({
    where: { restaurant_id: restaurant.id },
    create: {
      account_id: "e2e-test-account",
      created_by: manager.id,
      location_id: "E2E-LOC-001",
      modules_json: [
        { label: "M01", status: "Active" },
        { label: "M02", status: "Active" },
      ],
      onboarding_progress: {
        selectedVendors: { m01: ["toast"], m02: ["uber-eats"] },
      },
      restaurant_id: restaurant.id,
    },
    update: {
      account_id: "e2e-test-account",
      created_by: manager.id,
      location_id: "E2E-LOC-001",
      modules_json: [
        { label: "M01", status: "Active" },
        { label: "M02", status: "Active" },
      ],
      onboarding_progress: {
        selectedVendors: { m01: ["toast"], m02: ["uber-eats"] },
      },
    },
  });
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
