import { redis } from "@/lib/redis";

// BullMQ Queue/Worker instances take an ioredis connection directly.
export const queueConnection = redis;
