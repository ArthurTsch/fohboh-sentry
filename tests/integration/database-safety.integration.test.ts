import { afterAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

describe("isolated PostgreSQL integration environment", () => {
  afterAll(async () => prisma.$disconnect());

  it("uses a disposable test database and exposes the migrated schema", async () => {
    const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`SELECT current_database() AS database_name`;
    expect(rows[0]?.database_name.toLowerCase()).toContain("test");
    await expect(prisma.restaurants.count()).resolves.toBeTypeOf("number");
  });
});
