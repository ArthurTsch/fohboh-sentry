import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ops/rate-limit";

const key = `test-shared-rate-limit-${Date.now()}`;
const keyHash = createHash("sha256").update(key).digest("hex");

describe("shared PostgreSQL rate limiter", () => {
  beforeEach(async () => {
    await prisma.rate_limit_buckets.deleteMany({ where: { key_hash: keyHash } });
  });

  afterAll(async () => {
    await prisma.rate_limit_buckets.deleteMany({ where: { key_hash: keyHash } });
    await prisma.$disconnect();
  });

  it("atomically shares one limit across concurrent callers", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        checkRateLimit({ failureMode: "closed", key, limit: 5, windowMs: 60_000 }),
      ),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(7);
    await expect(prisma.rate_limit_buckets.findUniqueOrThrow({ where: { key_hash: keyHash } }))
      .resolves.toMatchObject({ count: 12 });
  });

  it("resets an expired bucket on its next atomic increment", async () => {
    await prisma.rate_limit_buckets.create({
      data: { count: 99, key_hash: keyHash, reset_at: new Date(Date.now() - 1_000) },
    });
    await expect(checkRateLimit({ failureMode: "closed", key, limit: 5, windowMs: 60_000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 4, storeAvailable: true });
  });
});
