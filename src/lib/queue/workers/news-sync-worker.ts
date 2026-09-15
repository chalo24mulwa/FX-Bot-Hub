import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { runNewsSync } from "@/services/news/sync-service";
import { logger } from "@/lib/logger";
import type { NewsSyncJobData } from "../queues";

// Run standalone: `npx tsx src/lib/queue/workers/news-sync-worker.ts`
export const newsSyncWorker = new Worker<NewsSyncJobData>(
  "news-sync",
  async () => runNewsSync(),
  { connection: queueConnection }
);

newsSyncWorker.on("failed", (job, err) => {
  logger.error("news-sync job failed", { jobId: job?.id, error: err.message });
});
