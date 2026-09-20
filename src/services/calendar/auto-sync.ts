import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { listDataSources, upsertDataSource } from "@/repositories/data-source-repository";
import { runCalendarSync, type CalendarSyncResult } from "./sync-service";
import { FINANCECALENDAR_PROVIDER_KEY } from "./providers/financecalendar-mapping";

// Keeps the calendar fresh WITHOUT a scheduler or Redis. The BullMQ
// worker/cron scripts (`npm run worker:calendar-sync`, `sync:trigger`) need a
// persistent process and Redis — neither exists on the current Hostinger
// shared plan (see CLAUDE.md's known gaps) — so this is the path that
// actually keeps production current:
//
//   * Whenever the calendar page renders (`after()` — never blocking the
//     response), `runCalendarSyncIfDue()` checks each external source's
//     `lastSyncAt`; if it's older than ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES
//     (default 60) one background sync runs.
//   * Visitors are always served from our own Postgres rows; the upstream
//     API is hit at most about once per interval no matter the traffic.
//   * Which process syncs is decided by an atomic compare-and-set on the
//     DataSource row (`claimSource`), so concurrent page views / server
//     instances / the cron endpoint never double-run a pass.
//   * A cron hit on /api/cron/calendar-sync (optional) calls the same
//     function, so hourly freshness holds even with zero page views.

/** After a fully failed pass, retry after this long rather than a full interval. */
const FAILURE_RETRY_MINUTES = 10;
/** First-ever pass also backfills this many days of history (env max is 30). */
const FIRST_RUN_RECENT_DAYS = 30;
/** A forced run still refuses to overlap one that started this recently. */
const FORCE_MIN_GAP_SECONDS = 60;

/** Pure: is a source due for a sync pass? Never-synced sources always are. */
export function isSyncDue(lastSyncAt: Date | null, now: Date, intervalMinutes: number): boolean {
  if (!lastSyncAt) return true;
  return now.getTime() - lastSyncAt.getTime() >= intervalMinutes * 60_000;
}

export type AutoSyncOutcome =
  | { status: "disabled" }
  | { status: "no_sources" }
  | { status: "not_due"; nextDueAt: Date | null }
  | { status: "claimed_elsewhere" }
  | { status: "ran"; result: CalendarSyncResult; backfilled: boolean }
  | { status: "failed"; error: string };

/**
 * Returns every calendar DataSource, first registering the Finance Calendar
 * source if it has no row yet — production's `data_sources` table starts
 * empty (it's never seeded there). Create-only: an existing row (enabled or
 * not) is never touched, so an admin who later disables it (e.g. to switch
 * providers) is never silently overridden. Checks the real rows every time
 * rather than remembering "already done" in memory, so the row being
 * removed out from under a running server self-heals on the next trigger.
 */
async function listCalendarSourcesEnsuringDefault() {
  let sources = await listDataSources("CALENDAR");
  if (!sources.some((s) => s.providerKey === FINANCECALENDAR_PROVIDER_KEY)) {
    await upsertDataSource({
      name: "Finance Calendar",
      kind: "CALENDAR",
      providerKey: FINANCECALENDAR_PROVIDER_KEY,
      enabled: true,
    });
    sources = await listDataSources("CALENDAR");
  }
  return sources;
}

/** Atomic compare-and-set: true only for the one caller that moved this
 * source's lastSyncAt forward while it was still due. */
async function claimSource(id: string, dueBefore: Date, now: Date): Promise<boolean> {
  const claimed = await db.dataSource.updateMany({
    where: { id, enabled: true, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: dueBefore } }] },
    data: { lastSyncAt: now, lastSyncStatus: "RUNNING" },
  });
  return claimed.count === 1;
}

export async function runCalendarSyncIfDue(options: { trigger: "page" | "cron"; force?: boolean }): Promise<AutoSyncOutcome> {
  // The page trigger honors the on/off switch; an explicit cron call is a
  // deliberate request and always allowed.
  if (options.trigger === "page" && !env.ECONOMIC_CALENDAR_AUTO_SYNC) return { status: "disabled" };

  try {
    // "manual" reads our own table — nothing external to keep fresh.
    const sources = (await listCalendarSourcesEnsuringDefault()).filter((s) => s.enabled && s.providerKey !== "manual");
    if (sources.length === 0) return { status: "no_sources" };

    const now = new Date();
    const intervalMs = env.ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES * 60_000;
    const dueBefore = options.force
      ? new Date(now.getTime() - FORCE_MIN_GAP_SECONDS * 1000)
      : new Date(now.getTime() - intervalMs);

    const due = options.force ? sources : sources.filter((s) => isSyncDue(s.lastSyncAt, now, env.ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES));
    if (due.length === 0) {
      const oldest = sources.map((s) => s.lastSyncAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
      return { status: "not_due", nextDueAt: oldest ? new Date(oldest.getTime() + intervalMs) : null };
    }

    const claimedSources: typeof due = [];
    for (const source of due) {
      if (await claimSource(source.id, dueBefore, now)) claimedSources.push(source);
    }
    if (claimedSources.length === 0) return { status: "claimed_elsewhere" };

    // A never-synced source gets a one-time history backfill so past
    // releases (with their actual values) are on the calendar from day one.
    const backfill = claimedSources.some((s) => s.lastSyncAt === null);
    const result = await runCalendarSync(
      backfill ? { recentDays: FIRST_RUN_RECENT_DAYS, upcomingDays: env.ECONOMIC_CALENDAR_SYNC_UPCOMING_DAYS } : undefined,
      backfill ? "calendarSyncBackfill" : "calendarSync"
    );

    // A source whose fetch failed (upstream down, changed response shape)
    // retries sooner than a full interval, but not immediately — never
    // hammer a struggling API. Judged per source from its own recorded
    // status, not from the run's totals: another source (e.g. "manual")
    // processing rows would otherwise mask this one failing.
    const failedIds = (
      await db.dataSource.findMany({
        where: { id: { in: claimedSources.map((s) => s.id) }, lastSyncStatus: "FAILED" },
        select: { id: true },
      })
    ).map((s) => s.id);
    if (failedIds.length > 0) {
      await db.dataSource.updateMany({
        where: { id: { in: failedIds } },
        data: { lastSyncAt: new Date(Date.now() - intervalMs + FAILURE_RETRY_MINUTES * 60_000) },
      });
    }

    return { status: "ran", result, backfilled: backfill };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("calendar auto-sync failed", { trigger: options.trigger, error: message });
    return { status: "failed", error: message };
  }
}
