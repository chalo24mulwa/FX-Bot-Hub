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
//
// calendarSync is the one exception: an optional `windowOverride` lets a
// caller narrow the sync window for a single run (e.g. "just today,"
// intended for a tighter external-cron cadence that catches same-day
// actual-value releases faster than the full recent/upcoming window run
// needs) instead of always using ECONOMIC_CALENDAR_SYNC_RECENT_DAYS/
// UPCOMING_DAYS from env — see runCalendarSync in
// src/services/calendar/sync-service.ts. `jobName` tags the resulting
// SyncLog row distinctly (default "calendarSync") so a narrower/more
// frequent run is visible separately from a full-window run in the
// admin "Recent sync runs" table, without adding a second SyncLog job
// type outside this one queue.
export interface CalendarSyncJobData {
  windowOverride?: { recentDays: number; upcomingDays: number };
  jobName?: string;
}
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
