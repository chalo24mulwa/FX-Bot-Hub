import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { runSubscriptionRenewals } from "@/services/subscriptions/renewal-service";
import { logger } from "@/lib/logger";
import type { SubscriptionRenewalJobData } from "../queues";

// Run standalone: `npx tsx src/lib/queue/workers/subscription-renewal-worker.ts`
export const subscriptionRenewalWorker = new Worker<SubscriptionRenewalJobData>(
  "subscription-renewal",
  async () => runSubscriptionRenewals(),
  { connection: queueConnection }
);

subscriptionRenewalWorker.on("failed", (job, err) => {
  logger.error("subscription-renewal job failed", { jobId: job?.id, error: err.message });
});
