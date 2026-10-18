import { db } from "@/lib/db";
import { listProductsQuerySchema } from "@/lib/validations/product";
import { MARKETPLACE_CONFIG } from "@/config/marketplace";
import { listFeaturedProducts, listNewestProducts, listPublishedProducts } from "@/server/services/product-service";
import { listPublishedVps } from "@/features/vps/queries";
import { listPublishedBrokers } from "@/features/brokers/queries";

// The database sits on another continent (~100 ms per round trip) and the serverless-style Postgres suspends itself when idle, so the
// first visitor after a quiet spell used to pay for a cold connection plus every query a page needs. Two cheap background jobs fix
// that without changing what any page shows:
//  1. a tiny query every 45 s keeps the connection (and the database compute) awake;
//  2. the public listings that make up the busiest pages are re-read in the background just before their cache entries expire (the
//     memory cache serves stale-while-revalidating, see src/lib/cache.ts), so a visitor is served from memory.
// Everything here is best-effort: a failure is ignored and the normal on-demand path still works.

declare global {
  var __warmersStarted: boolean | undefined;
}

const KEEP_ALIVE_MS = 45_000;

async function warmPublicReads() {
  const marketplace = listProductsQuerySchema.parse({});
  await Promise.allSettled([
    listFeaturedProducts(MARKETPLACE_CONFIG.featuredLimit),
    listNewestProducts(MARKETPLACE_CONFIG.newestLimit),
    listPublishedProducts(marketplace),
    listPublishedVps(),
    listPublishedBrokers(),
  ]);
}

export function startBackgroundWarmers() {
  if (globalThis.__warmersStarted) return;
  if (process.env.DISABLE_WARMUP === "true") return;
  globalThis.__warmersStarted = true;

  const tick = async () => {
    try {
      await db.$queryRaw`SELECT 1`;
      await warmPublicReads();
    } catch {
      // Best-effort.
    }
  };

  // First warm-up a moment after start so it never competes with the first real request, then on a steady beat. unref(): these timers
  // must never keep the process alive on their own.
  setTimeout(() => void tick(), 1500).unref();
  setInterval(() => void tick(), KEEP_ALIVE_MS).unref();
}
