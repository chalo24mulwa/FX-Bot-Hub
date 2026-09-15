import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { db } from "@/lib/db";
import { notify, type NotificationChannel } from "@/lib/notifications/notify";
import { logger } from "@/lib/logger";
import type { EventReminderJobData } from "../queues";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Run standalone: `npx tsx src/lib/queue/workers/event-reminder-worker.ts`
// Delayed one-off jobs scheduled by scheduleEventReminder() — fires once,
// ~30 minutes before the specific event a user subscribed to. Migrated to
// the unified notify() helper (src/lib/notifications/notify.ts) as a
// working example of the Phase 5 notification-service pattern.
export const eventReminderWorker = new Worker<EventReminderJobData>(
  "event-reminder",
  async (job) => {
    const [alert, event] = await Promise.all([
      db.alert.findUnique({ where: { id: job.data.alertId } }),
      db.economicEvent.findUnique({ where: { id: job.data.eventId } }),
    ]);
    if (!alert || !event) return; // alert or event was removed since scheduling

    const title = `Reminder: ${event.title} in 30 minutes`;
    const link = `/calendar/event/${event.id}`;

    await notify({
      userId: alert.userId,
      type: "ECONOMIC_EVENT_ALERT",
      title,
      link,
      channels: alert.channels as NotificationChannel[],
      email: {
        subject: title,
        html: `<p>${event.title} (${event.currency}) is scheduled in 30 minutes.</p><p><a href="${siteUrl}${link}">View details</a></p>`,
        text: `${title}: ${siteUrl}${link}`,
      },
    });
  },
  { connection: queueConnection }
);

eventReminderWorker.on("failed", (job, err) => {
  logger.error("event-reminder job failed", { jobId: job?.id, error: err.message });
});
