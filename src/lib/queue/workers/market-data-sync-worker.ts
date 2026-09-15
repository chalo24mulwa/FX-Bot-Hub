import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { runMarketDataSync } from "@/services/market-data/sync-service";
import type { MarketDataSyncJobData } from "../queues";

// Run standalone: `npx tsx src/lib/queue/workers/market-data-sync-worker.ts`
// See src/services/market-data/sync-service.ts — this is currently a stub
// job (no market-data model/provider exists yet), wired up so the queue,
// retry, and SyncLog architecture is proven and ready.
export const marketDataSyncWorker = new Worker<MarketDataSyncJobData>(
  "market-data-sync",
  async () => runMarketDataSync(),
  { connection: queueConnection }
);

marketDataSyncWorker.on("failed", (job, err) => {
  console.error(`[market-data-sync-worker] job ${job?.id} failed:`, err);
});
