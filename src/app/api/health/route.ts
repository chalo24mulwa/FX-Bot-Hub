import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

/**
 * Checks the two critical dependencies, reported separately rather than
 * collapsed into one boolean (Phase 5 — previously database-only, see
 * docs/PHASE5_AUDIT.md). Postgres is a hard dependency: if it's
 * unreachable the whole app is down, so that alone drives the 503.
 * Redis is deliberately NOT a hard dependency — every Redis-backed
 * feature (rate limiting, caching, queues) is built to fail open (see
 * src/lib/redis.ts, src/lib/cache.ts, src/lib/security/rate-limit.ts), so
 * Redis being down is reported as "degraded," not "error," and doesn't by
 * itself flip the response to 503 — that would misrepresent an app that's
 * actually still serving requests as fully down.
 */
export async function GET() {
  const [databaseOk, redisOk] = await Promise.all([
    db
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false),
    redis
      .ping()
      .then(() => true)
      .catch(() => false),
  ]);

  const status = !databaseOk ? "error" : !redisOk ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      checks: {
        database: databaseOk ? "ok" : "error",
        redis: redisOk ? "ok" : "error",
      },
    },
    { status: databaseOk ? 200 : 503 }
  );
}
