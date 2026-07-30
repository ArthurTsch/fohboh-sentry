import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$transaction((tx) =>
    tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1::integer AS "locked"
      FROM pg_advisory_xact_lock(hashtext(${"governance-workspace:verification"}))
    `,
  );

  if (rows.length !== 1 || rows[0]?.locked !== 1) {
    throw new Error(`Unexpected advisory-lock result: ${JSON.stringify(rows)}`);
  }

  console.log("Governance workspace advisory lock acquired successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
