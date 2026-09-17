// Enqueues one calendarSync run narrowed to "today only" (recentDays: 0,
// upcomingDays: 1) — intended for a tighter external-cron cadence than
// `npm run sync:trigger`'s full recent/upcoming window, so a same-day
// actual-value release (or a late forecast/time revision) is picked up
// sooner without re-requesting the whole multi-month window every time.
// Tagged with a distinct SyncLog jobName ("calendarSyncToday") so it's
// visible separately from full-window runs in the admin "Recent sync
// runs" table at /admin/data-sources — see runCalendarSync's doc comment
// in src/services/calendar/sync-service.ts.
//
// Suggested cadence: every 5-15 minutes, alongside `npm run sync:trigger`
// on a slower cadence (e.g. hourly) for the full window — see
// docs/ENVIRONMENT.md.
import { calendarSyncQueue, SYNC_JOB_OPTIONS } from "@/lib/queue/queues";

async function main() {
  await calendarSyncQueue.add(
    "sync-today",
    { windowOverride: { recentDays: 0, upcomingDays: 1 }, jobName: "calendarSyncToday" },
    SYNC_JOB_OPTIONS
  );
  console.log("Enqueued calendarSyncToday (today-only window).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
