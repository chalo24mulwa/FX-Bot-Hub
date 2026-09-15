import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { runNewsSync } from "@/services/news/sync-service";
import type { NewsSyncJobData } from "../queues";

// Run standalone: `npx tsx src/lib/queue/workers/news-sync-worker.ts`
export const newsSyncWorker = new Worker<NewsSyncJobData>(
  "news-sync",
  async () => runNewsSync(),
  { connection: queueConnection }
);

newsSyncWorker.on("failed", (job, err) => {
  console.error(`[news-sync-worker] job ${job?.id} failed:`, err);
});
