import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { runCalendarSync } from "@/services/calendar/sync-service";
import { logger } from "@/lib/logger";
import type { CalendarSyncJobData } from "../queues";

// Run standalone: `npx tsx src/lib/queue/workers/calendar-sync-worker.ts`
// Retry/backoff comes from SYNC_JOB_OPTIONS on the job itself (set by
// whatever schedules it — see the "schedule" npm script or a cron
// trigger); the worker just runs the job and lets it fail loudly.
export const calendarSyncWorker = new Worker<CalendarSyncJobData>(
  "calendar-sync",
  async () => runCalendarSync(),
  { connection: queueConnection }
);

calendarSyncWorker.on("failed", (job, err) => {
  logger.error("calendar-sync job failed", { jobId: job?.id, error: err.message });
});
