import IORedis from "ioredis";
import { env } from "@/lib/env";

declare global {
  var __redis: IORedis | undefined;
}

// BullMQ requires maxRetriesPerRequest: null on the connection it's given;
// sharing one connection across the app (queues, cache, rate limiting) also
// avoids exhausting Redis connections across dev hot reloads. commandTimeout
// makes non-BullMQ callers (cache.ts, rate-limit.ts) fail fast and fall back
// gracefully instead of hanging when Redis is unreachable (e.g. local dev
// without `docker compose up redis`), and the "error" listener stops ioredis
// from logging noisy "Unhandled error event" stack traces for every retry.
export const redis =
  globalThis.__redis ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    commandTimeout: 2000,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

redis.on("error", (err) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[redis] connection error: ${err.message}`);
  }
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}

// commandTimeout (2000ms, above) is tuned for BullMQ and only starts
// counting once a command is actually dispatched over a live connection —
// when Redis is unreachable outright (not just slow), ioredis's own
// connect/retryStrategy overhead runs *before* that, so a caller relying
// solely on commandTimeout can still wait well past 2s. Cache reads
// (src/lib/cache.ts) already race against this shorter, independent
// budget instead; rate limiting (src/lib/security/rate-limit.ts) uses it
// too, for the same reason — both exist to make a request faster/safer,
// not to add multi-second latency when their backing store is down.
export const REDIS_FAST_TIMEOUT_MS = 250;

export function withRedisTimeout<T>(promise: Promise<T>, ms: number = REDIS_FAST_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("redis operation timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
