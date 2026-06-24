import "dotenv/config";
import { hash } from "bcryptjs";
import prisma from "../src/lib/prisma";

async function main() {
  const [, , emailArg, passwordArg] = process.argv;

  const email = emailArg?.trim();
  const password = passwordArg ?? "";

  if (!email || !password) {
    console.error("Usage: pnpm tsx scripts/set-manager-password.ts <email> <new-password>");
    process.exit(1);
  }

  const existing = await prisma.managers.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true, email: true },
  });

  if (!existing) {
    console.error(`Manager not found: ${email}`);
    process.exit(1);
  }

  const passwordHash = await hash(password, 12);

  await prisma.managers.update({
    where: { id: existing.id },
    data: {
      password_hash: passwordHash,
    },
  });

  console.log(`Password updated for ${existing.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
