/**
 * Shared, reusable rate limiter for Edge Functions.
 *
 * Uses an in-memory sliding-window counter (same strategy as rate-limit.ts)
 * keyed by a caller-supplied identifier and endpoint name.
 *
 * Usage:
 *   const rl = checkRate(identifier, "send-sms", 30, 60);
 *   if (!rl.allowed) { return rateLimitedResponse(rl, req); }
 */

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Remove expired buckets so the map doesn't grow unbounded. */
function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * Check (and increment) the rate limit for a given caller.
 *
 * @param identifier  Unique caller key — e.g. user ID, org ID, or IP address.
 * @param endpoint    Logical endpoint name (used to namespace the key).
 * @param maxRequests Maximum number of allowed requests in the window.
 * @param windowSecs  Window duration in seconds.
 * @returns           { allowed, remaining, retryAfter }
 */
export function checkRate(
  identifier: string,
  endpoint: string,
  maxRequests: number,
  windowSecs: number,
): RateLimitInfo {
  const now = Date.now();
  prune(now);

  const key = `${endpoint}:${identifier}`;
  const windowMs = windowSecs * 1000;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfter: windowSecs };
  }

  current.count += 1;
  const allowed = current.count <= maxRequests;
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

  return {
    allowed,
    remaining: Math.max(0, maxRequests - current.count),
    retryAfter,
  };
}

/**
 * Convenience: build a 429 JSON response with standard rate-limit headers.
 */
export function rateLimitedResponse(info: RateLimitInfo, req?: Request): Response {
  // Import would create a circular dep, so inline the CORS origin logic.
  const origin = req?.headers.get("Origin") ?? "";
  return new Response(
    JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(info.retryAfter),
        "X-RateLimit-Remaining": String(info.remaining),
        ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      },
    },
  );
}
