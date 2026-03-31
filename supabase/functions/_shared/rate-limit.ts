type RateLimitOptions = {
  maxRequests: number;
  windowSeconds: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
};

const buckets = new Map<string, RateLimitState>();

function pruneExpired(now: number): void {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const windowMs = options.windowSeconds * 1000;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: Math.max(0, options.maxRequests - 1),
      reset: Math.ceil(resetAt / 1000),
      retryAfter: options.windowSeconds,
    };
  }

  current.count += 1;
  const allowed = current.count <= options.maxRequests;
  const secondsUntilReset = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

  return {
    allowed,
    limit: options.maxRequests,
    remaining: Math.max(0, options.maxRequests - current.count),
    reset: Math.ceil(current.resetAt / 1000),
    retryAfter: secondsUntilReset,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    "Retry-After": String(result.retryAfter),
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
