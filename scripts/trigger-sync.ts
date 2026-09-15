// Enqueues one run of each of the three Phase 3 sync jobs. Meant to be
// invoked by an external scheduler (system cron, a platform's scheduled-job
// feature, or a manual `npm run sync:trigger`) — there's no in-process
// cron here since that would only run while a long-lived Next.js process
// is up, which isn't guaranteed in every deployment target.
import { calendarSyncQueue, newsSyncQueue, marketDataSyncQueue, SYNC_JOB_OPTIONS } from "@/lib/queue/queues";

async function main() {
  await Promise.all([
    calendarSyncQueue.add("sync", {}, SYNC_JOB_OPTIONS),
    newsSyncQueue.add("sync", {}, SYNC_JOB_OPTIONS),
    marketDataSyncQueue.add("sync", {}, SYNC_JOB_OPTIONS),
  ]);
  console.log("Enqueued calendarSync, newsSync, marketDataSync.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
