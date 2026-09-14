import { redis } from "@/lib/redis";

/**
 * Cache-aside helper: return the cached JSON value for `key` if present,
 * otherwise compute it, cache it for `ttlSeconds`, and return it. Use for
 * read-heavy, slow-changing data (homepage sections, category lists) —
 * not for anything that must reflect a write immediately.
 */
export async function cacheWrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Redis unavailable — fall through to computing directly rather than
    // failing the request over a cache miss.
  }

  const value = await compute();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Best-effort; a failed cache write shouldn't fail the request.
  }

  return value;
}

export async function cacheInvalidate(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // Best-effort.
  }
}
