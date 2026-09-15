import { Worker } from "bullmq";
import { queueConnection } from "../connection";
import { db } from "@/lib/db";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import type { EventReminderJobData } from "../queues";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Run standalone: `npx tsx src/lib/queue/workers/event-reminder-worker.ts`
// Delayed one-off jobs scheduled by scheduleEventReminder() — fires once,
// ~30 minutes before the specific event a user subscribed to.
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

    if (alert.channels.includes("IN_APP")) {
      await createNotification({ userId: alert.userId, type: "ECONOMIC_EVENT_ALERT", title, link });
    }
    if (alert.channels.includes("EMAIL")) {
      const user = await db.user.findUnique({ where: { id: alert.userId }, select: { email: true } });
      if (user) {
        await enqueueEmail(user.email, {
          subject: title,
          html: `<p>${event.title} (${event.currency}) is scheduled in 30 minutes.</p><p><a href="${siteUrl}${link}">View details</a></p>`,
          text: `${title}: ${siteUrl}${link}`,
        });
      }
    }
  },
  { connection: queueConnection }
);

eventReminderWorker.on("failed", (job, err) => {
  console.error(`[event-reminder-worker] job ${job?.id} failed:`, err);
});
