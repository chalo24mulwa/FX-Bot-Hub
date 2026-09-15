import { Queue } from "bullmq";
import { queueConnection } from "./connection";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

// Empty payloads — these jobs pull their own work list (enabled
// DataSource rows) from the DB rather than being told what to sync, so
// they can be triggered on a schedule or manually with no arguments.
export type CalendarSyncJobData = Record<string, never>;
export type NewsSyncJobData = Record<string, never>;
export type MarketDataSyncJobData = Record<string, never>;
// Same "pulls its own work list" shape: finds due Subscription rows itself.
export type SubscriptionRenewalJobData = Record<string, never>;

export interface EventReminderJobData {
  alertId: string;
  eventId: string;
}

// Default retry policy for the three sync jobs: 3 attempts with
// exponential backoff, so a transient provider/network failure doesn't
// need a human to notice and re-run it manually.
export const SYNC_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

// Phase 5 fix: emailQueue and eventReminderQueue's `.add()` call sites
// passed no options at all — 1 attempt, no retry, so a transient SMTP
// hiccup or a reminder-job crash was a silent, permanent loss
// (docs/PHASE5_AUDIT.md). Setting `defaultJobOptions` on the Queue itself
// (rather than only at scattered `.add()` call sites, which is how the
// sync queues got this before) means every future `.add()` inherits it
// automatically — the same policy as the sync jobs, since none of these
// have a reason to retry differently.
const queueOptions = { connection: queueConnection, defaultJobOptions: SYNC_JOB_OPTIONS };

// One Queue instance per job type. Add new queues here as features need
// background work (e.g. license-key generation, payout processing).
export const emailQueue = new Queue<EmailJobData>("email", queueOptions);

export const calendarSyncQueue = new Queue<CalendarSyncJobData>("calendar-sync", queueOptions);

export const newsSyncQueue = new Queue<NewsSyncJobData>("news-sync", queueOptions);

export const marketDataSyncQueue = new Queue<MarketDataSyncJobData>("market-data-sync", queueOptions);

// Delayed one-off jobs (30 minutes before a specific event a user
// subscribed to) rather than a recurring sync — see scheduleEventReminder
// in src/features/alerts/dispatch-service.ts.
export const eventReminderQueue = new Queue<EventReminderJobData>("event-reminder", queueOptions);

export const subscriptionRenewalQueue = new Queue<SubscriptionRenewalJobData>("subscription-renewal", queueOptions);
