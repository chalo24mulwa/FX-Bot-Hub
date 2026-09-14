import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { emailProvider } from "@/lib/email";
import type { EmailJobData } from "../queues";

// Run standalone: `npx tsx src/lib/queue/workers/email-worker.ts`
// (wire into a `worker` npm script / separate container before deploying).
export const emailWorker = new Worker<EmailJobData>(
  "email",
  async (job) => {
    await emailProvider.send(job.data);
  },
  { connection: queueConnection }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[email-worker] job ${job?.id} failed:`, err);
});
