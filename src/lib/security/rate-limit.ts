import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

export class RateLimitError extends Error {
  status = 429;
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Too many requests.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "auth:register". Combined with the key. */
  bucket: string;
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window counter in Redis (INCR + EXPIRE) — cheap and good enough for
 * Phase 1's abuse surfaces (registration, moderation actions). Swap for a
 * sliding-window/token-bucket implementation behind this same signature if
 * burst behavior at window boundaries ever becomes a real problem.
 *
 * Fails OPEN: if Redis is unreachable, the request is allowed rather than
 * blocked — rate limiting is a defense-in-depth layer, and a Redis outage
 * should degrade abuse protection, not take down registration/login with
 * it. This mirrors the fallback in src/lib/cache.ts.
 *
 * Set RATE_LIMIT_DISABLED=true to bypass entirely in tests/CI; never set
 * that in production.
 */
export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<void> {
  if (env.RATE_LIMIT_DISABLED) return;

  const redisKey = `ratelimit:${options.bucket}:${key}`;
  let count: number;
  try {
    count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, options.windowSeconds);
    }
  } catch (err) {
    console.warn(`[rate-limit] Redis unavailable, failing open for "${options.bucket}":`, err);
    return;
  }

  if (count > options.limit) {
    const ttl = await redis.ttl(redisKey).catch(() => options.windowSeconds);
    throw new RateLimitError(ttl > 0 ? ttl : options.windowSeconds);
  }
}

/** Best-effort client identifier for anonymous rate limiting. */
export function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
