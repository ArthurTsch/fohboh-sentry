type LimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const globalStore = globalThis as typeof globalThis & {
  __sentryRateLimitStore?: Map<string, Bucket>;
};

function getStore() {
  if (!globalStore.__sentryRateLimitStore) {
    globalStore.__sentryRateLimitStore = new Map<string, Bucket>();
  }
  return globalStore.__sentryRateLimitStore;
}

export function checkRateLimit(config: LimitConfig) {
  const now = Date.now();
  const store = getStore();
  const current = store.get(config.key);

  if (!current || current.resetAt <= now) {
    const next: Bucket = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(config.key, next);
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: next.resetAt,
    };
  }

  if (current.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(config.key, current);
  return {
    allowed: true,
    remaining: Math.max(0, config.limit - current.count),
    resetAt: current.resetAt,
  };
}
