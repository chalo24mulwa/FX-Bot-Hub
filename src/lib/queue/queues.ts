import { Queue } from "bullmq";
import { queueConnection } from "./connection";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

export interface CalendarSyncJobData {
  source: string;
}

// One Queue instance per job type. Add new queues here as features need
// background work (e.g. license-key generation, payout processing).
export const emailQueue = new Queue<EmailJobData>("email", {
  connection: queueConnection,
});

export const calendarSyncQueue = new Queue<CalendarSyncJobData>("calendar-sync", {
  connection: queueConnection,
});
