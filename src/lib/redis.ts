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
