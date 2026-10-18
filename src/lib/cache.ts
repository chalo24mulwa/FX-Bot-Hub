import { redis, redisReady, withRedisTimeout, REDIS_FAST_TIMEOUT_MS } from "@/lib/redis";

// Two tiers, one entry point:
//
//  1. Redis (when REDIS_URL is configured and the connection is ready) — shared between processes, JSON round-trip.
//  2. An in-process memory cache otherwise (the Hostinger plan has no Redis). This is what makes public pages fast there: the
//     database lives in another continent (~100 ms per round trip), so a page that needs five queries spends half a second just
//     waiting on the network. Cached, the same page needs none.
//
// Memory-tier behaviour: a value is "fresh" for `ttlSeconds`; for another `ttlSeconds` it is served immediately while ONE background
// refresh recomputes it (stale-while-revalidate), so after the first load nobody waits on the database; beyond that window the next
// caller recomputes and waits. Concurrent callers for the same key share one computation. Writers that must show up at once call
// invalidateCachePrefix() (see src/lib/product-cache.ts). Values are structuredClone()d on the way out, so a page can never corrupt
// what the next visitor receives.
//
// Redis tier notes (unchanged): racing every Redis call against a short, independent budget keeps a *down* Redis from stalling a
// request (see src/lib/redis.ts); cache lookups must never make a request slower than not caching at all.
const CACHE_LOOKUP_TIMEOUT_MS = REDIS_FAST_TIMEOUT_MS;
const MAX_MEMORY_ENTRIES = 600;

interface MemoryEntry {
  value: unknown;
  freshUntil: number;
  staleUntil: number;
}

interface MemoryState {
  entries: Map<string, MemoryEntry>;
  inflight: Map<string, Promise<unknown>>;
}

declare global {
  var __memoryCache: MemoryState | undefined;
}

// Survives dev hot reloads, and is shared by every module instance in the process.
const memory: MemoryState = (globalThis.__memoryCache ??= { entries: new Map(), inflight: new Map() });

/** `CACHE_MEMORY_DISABLED=true` turns the memory tier off (the end-to-end suite writes to the database directly and expects to read it back at once). */
function memoryEnabled(): boolean {
  return process.env.CACHE_MEMORY_DISABLED !== "true";
}

function load<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const running = memory.inflight.get(key);
  if (running) return running as Promise<T>;
  const promise = compute()
    .then((value) => {
      const now = Date.now();
      memory.entries.set(key, { value, freshUntil: now + ttlSeconds * 1000, staleUntil: now + ttlSeconds * 2000 });
      if (memory.entries.size > MAX_MEMORY_ENTRIES) {
        // Map iterates in insertion order: drop the oldest entries.
        for (const oldest of memory.entries.keys()) {
          memory.entries.delete(oldest);
          if (memory.entries.size <= MAX_MEMORY_ENTRIES * 0.9) break;
        }
      }
      return value;
    })
    .finally(() => {
      memory.inflight.delete(key);
    });
  memory.inflight.set(key, promise);
  return promise;
}

async function memoryWrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const hit = memory.entries.get(key);
  const now = Date.now();
  if (hit && now < hit.freshUntil) return structuredClone(hit.value) as T;
  if (hit && now < hit.staleUntil) {
    // Serve what we have, refresh for the next visitor. A failed refresh keeps the stale value until it expires.
    void load(key, ttlSeconds, compute).catch(() => undefined);
    return structuredClone(hit.value) as T;
  }
  return structuredClone(await load(key, ttlSeconds, compute)) as T;
}

/**
 * Cache-aside helper: return the cached value for `key` if present, otherwise compute it, cache it for `ttlSeconds`, and return it.
 * Use for read-heavy, slow-changing data (homepage sections, category lists, public listings) — not for anything per-user or that
 * must reflect a write immediately (call invalidateCachePrefix() from the writer if it should show at once).
 */
export async function cacheWrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  if (!redisReady()) {
    return memoryEnabled() ? memoryWrap(key, ttlSeconds, compute) : compute();
  }

  try {
    const cached = await withRedisTimeout(redis.get(key), CACHE_LOOKUP_TIMEOUT_MS);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // Redis unavailable or slow — fall through to computing directly
    // rather than failing (or stalling) the request over a cache miss.
  }

  const value = await compute();

  // Best-effort write: fire-and-forget with the same short timeout budget rather than awaited, so a slow/unreachable Redis never
  // adds latency to the response on the write side either — the caller already has its answer by the time this settles.
  withRedisTimeout(redis.set(key, JSON.stringify(value), "EX", ttlSeconds), CACHE_LOOKUP_TIMEOUT_MS).catch(() => {
    // Best-effort; a failed cache write shouldn't fail the request.
  });

  return value;
}

export async function cacheInvalidate(key: string): Promise<void> {
  memory.entries.delete(key);
  if (!redisReady()) return;
  try {
    await withRedisTimeout(redis.del(key), CACHE_LOOKUP_TIMEOUT_MS);
  } catch {
    // Best-effort.
  }
}

/** Drops every in-process entry whose key starts with one of the prefixes. (Redis entries simply expire by TTL.) */
export function invalidateCachePrefix(...prefixes: string[]): void {
  for (const key of [...memory.entries.keys()]) {
    if (prefixes.some((p) => key.startsWith(p))) memory.entries.delete(key);
  }
}

/** For tests. */
export function __memoryCacheSize(): number {
  return memory.entries.size;
}
