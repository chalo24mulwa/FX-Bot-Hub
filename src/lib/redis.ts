import IORedis from "ioredis";
import { env } from "@/lib/env";

declare global {
  var __redis: IORedis | undefined;
}

// BullMQ requires this exact option; sharing one connection avoids
// exhausting Redis connections across hot reloads / queue instances.
export const redis =
  globalThis.__redis ??
  new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
