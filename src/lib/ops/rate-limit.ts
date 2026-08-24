import { createHash } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logServerError } from "@/lib/ops/audit";

export type RateLimitFailureMode = "closed" | "open";

export type LimitConfig = {
  failureMode: RateLimitFailureMode;
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  storeAvailable: boolean;
};

type BucketRow = {
  count: number;
  reset_at: Date;
};

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function checkRateLimit(config: LimitConfig): Promise<RateLimitResult> {
  const now = Date.now();
  const fallbackResetAt = now + config.windowMs;

  try {
    const rows = await prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      INSERT INTO public.rate_limit_buckets (key_hash, count, reset_at, updated_at)
      VALUES (${hashKey(config.key)}, 1, ${new Date(fallbackResetAt)}, now())
      ON CONFLICT (key_hash) DO UPDATE
      SET
        count = CASE
          WHEN public.rate_limit_buckets.reset_at <= now() THEN 1
          ELSE public.rate_limit_buckets.count + 1
        END,
        reset_at = CASE
          WHEN public.rate_limit_buckets.reset_at <= now() THEN EXCLUDED.reset_at
          ELSE public.rate_limit_buckets.reset_at
        END,
        updated_at = now()
      RETURNING count, reset_at
    `);

    const bucket = rows[0];
    if (!bucket) throw new Error("Rate limiter did not return a bucket.");

    return {
      allowed: bucket.count <= config.limit,
      remaining: Math.max(0, config.limit - bucket.count),
      resetAt: bucket.reset_at.getTime(),
      storeAvailable: true,
    };
  } catch (error) {
    logServerError("rate_limit_store_failed", error, {
      failureMode: config.failureMode,
      keyHash: hashKey(config.key),
    });
    return {
      allowed: config.failureMode === "open",
      remaining: config.failureMode === "open" ? config.limit : 0,
      resetAt: fallbackResetAt,
      storeAvailable: false,
    };
  }
}

export async function checkRateLimits(configs: LimitConfig[]): Promise<RateLimitResult> {
  const results = await Promise.all(configs.map(checkRateLimit));
  return results.reduce((strictest, result) => {
    if (!result.allowed && strictest.allowed) return result;
    if (result.allowed === strictest.allowed && result.remaining < strictest.remaining) return result;
    return strictest;
  });
}

export function getRetryAfterSeconds(result: RateLimitResult) {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}
