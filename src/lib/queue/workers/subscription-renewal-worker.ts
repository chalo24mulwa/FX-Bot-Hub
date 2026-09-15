import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { runSubscriptionRenewals } from "@/services/subscriptions/renewal-service";
import type { SubscriptionRenewalJobData } from "../queues";

// Run standalone: `npx tsx src/lib/queue/workers/subscription-renewal-worker.ts`
export const subscriptionRenewalWorker = new Worker<SubscriptionRenewalJobData>(
  "subscription-renewal",
  async () => runSubscriptionRenewals(),
  { connection: queueConnection }
);

subscriptionRenewalWorker.on("failed", (job, err) => {
  console.error(`[subscription-renewal-worker] job ${job?.id} failed:`, err);
});
