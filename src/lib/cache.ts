import { redis, withRedisTimeout, REDIS_FAST_TIMEOUT_MS } from "@/lib/redis";

// Phase 5: `redis` (src/lib/redis.ts) is a single shared ioredis instance
// used by BullMQ, rate limiting, and this cache — its own commandTimeout
// (2000ms) is tuned for BullMQ, which can reasonably wait a couple of
// seconds for a job command. A *cache* lookup should never cost anywhere
// near that: caching exists to make a request faster, so a lookup that
// blocks for ~2s on a cache miss (the exact behavior when Redis is
// unreachable — ioredis queues the command and only rejects once
// commandTimeout elapses) makes the request *slower* than not caching at
// all, and multiple cacheWrap() calls on one page compound this instead of
// overlapping (found via a real e2e failure: a page calling two cached
// reads sequentially took ~4s to render with Redis down, well past a
// reasonable request budget). withRedisTimeout() (src/lib/redis.ts) races
// the Redis call against its own much shorter budget so a cache lookup can
// never meaningfully stall a request — independent of (and tighter than)
// the shared client's own timeout. rate-limit.ts uses the same helper for
// the same reason.
const CACHE_LOOKUP_TIMEOUT_MS = REDIS_FAST_TIMEOUT_MS;

/**
 * Cache-aside helper: return the cached JSON value for `key` if present,
 * otherwise compute it, cache it for `ttlSeconds`, and return it. Use for
 * read-heavy, slow-changing data (homepage sections, category lists) —
 * not for anything that must reflect a write immediately.
 */
export async function cacheWrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  try {
    const cached = await withRedisTimeout(redis.get(key), CACHE_LOOKUP_TIMEOUT_MS);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Redis unavailable or slow — fall through to computing directly
    // rather than failing (or stalling) the request over a cache miss.
  }

  const value = await compute();

  // Best-effort write: fire-and-forget with the same short timeout budget
  // rather than awaited, so a slow/unreachable Redis never adds latency
  // to the response on the write side either — the caller already has
  // its answer by the time this settles.
  withRedisTimeout(redis.set(key, JSON.stringify(value), "EX", ttlSeconds), CACHE_LOOKUP_TIMEOUT_MS).catch(() => {
    // Best-effort; a failed cache write shouldn't fail the request.
  });

  return value;
}

export async function cacheInvalidate(key: string): Promise<void> {
  try {
    await withRedisTimeout(redis.del(key), CACHE_LOOKUP_TIMEOUT_MS);
  } catch {
    // Best-effort.
  }
}
