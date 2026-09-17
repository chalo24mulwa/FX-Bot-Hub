import type { EventImpact } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { cacheInvalidate } from "@/lib/cache";
import { listEnabledDataSources, markSyncResult } from "@/repositories/data-source-repository";
import { startSyncLog, finishSyncLog } from "@/repositories/sync-log-repository";
import { recordEventRevisions } from "@/repositories/economic-event-revision-repository";
import { getCalendarProvider } from "./providers";
import { detectFieldChanges, detectDisappearedEvents } from "./revision-detection";
import { dispatchEconomicEventAlert } from "@/features/alerts/dispatch-service";

/** Pure gating rule, split out for unit testing: alert only on a row that
 * did not already exist (a genuinely new event) and only for HIGH impact —
 * otherwise every re-sync pass touching the same row would re-spam
 * subscribers. */
export function shouldDispatchHighImpactAlert(wasExisting: boolean, impact: EventImpact): boolean {
  return !wasExisting && impact === "HIGH";
}

// Shared cross-domain shape — newsSync and marketDataSync (src/services/news
// and src/services/market-data) also return this exact type, so it stays
// minimal; calendar's own richer per-run breakdown is CalendarSyncResult
// below, not a change to this shared interface.
export interface SyncResult {
  itemsProcessed: number;
  itemsFailed: number;
}

export interface CalendarSyncResult extends SyncResult {
  itemsInserted: number;
  itemsUpdated: number;
  itemsCancelled: number;
  revisionsRecorded: number;
}

/**
 * The sync window is a single contiguous range around "now" — from
 * `recentDays` in the past (catches actual/previous revisions on events
 * that already released) through `upcomingDays` ahead (catches new/
 * changed upcoming events). One bounded range per provider per run,
 * never the whole historical table — see CLAUDE.md's calendar-service
 * note on the same principle for reads. Defaults to the env-configured
 * full window; a caller can pass a narrower override (see
 * `CalendarSyncWindowOverride` below) for a tighter, more frequent pass.
 */
function getSyncWindow(now: Date, windowDays: { recentDays: number; upcomingDays: number }): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - windowDays.recentDays * 86_400_000),
    to: new Date(now.getTime() + windowDays.upcomingDays * 86_400_000),
  };
}

export interface CalendarSyncWindowOverride {
  recentDays: number;
  upcomingDays: number;
}

/**
 * Pulls events from every enabled CALENDAR DataSource and upserts them by
 * externalId (dedup — a re-run never creates duplicates, only updates
 * actual/forecast/previous/status as they change, logging each changed
 * field to EconomicEventRevision). One provider failing doesn't abort the
 * others; each source's own lastSyncStatus reflects its own run, and a
 * failure never deletes previously-synced data (see the per-source
 * try/catch below and CLAUDE.md's "provider failure" note). Called by the
 * calendarSync queue worker — see src/lib/queue/workers.
 *
 * `windowOverride` narrows the sync window for this one run instead of
 * using the env-configured recent/upcoming days — intended for a
 * tighter, more frequent external-cron pass (e.g. "today only," every
 * few minutes, to catch same-day actual-value releases faster than a
 * full multi-month pass needs to run) alongside a normal periodic
 * full-window pass. `jobName` tags the SyncLog row so the two cadences
 * are distinguishable in the admin "Recent sync runs" table — see
 * `CalendarSyncJobData` in src/lib/queue/queues.ts.
 */
export async function runCalendarSync(
  windowOverride?: CalendarSyncWindowOverride,
  jobName = "calendarSync"
): Promise<CalendarSyncResult> {
  const log = await startSyncLog(jobName);
  const result: CalendarSyncResult = {
    itemsProcessed: 0,
    itemsInserted: 0,
    itemsUpdated: 0,
    itemsCancelled: 0,
    itemsFailed: 0,
    revisionsRecorded: 0,
  };

  try {
    const sources = await listEnabledDataSources("CALENDAR");
    const now = new Date();
    const { from, to } = getSyncWindow(
      now,
      windowOverride ?? {
        recentDays: env.ECONOMIC_CALENDAR_SYNC_RECENT_DAYS,
        upcomingDays: env.ECONOMIC_CALENDAR_SYNC_UPCOMING_DAYS,
      }
    );

    for (const source of sources) {
      const provider = getCalendarProvider(source.providerKey);
      if (!provider) {
        result.itemsFailed += 1;
        await markSyncResult(source.id, "FAILED");
        logger.error("calendarSync: unknown provider key", { providerKey: source.providerKey });
        continue;
      }

      try {
        const events = await provider.getEvents({ from, to });
        const returnedExternalIds = new Set<string>();
        const revisionRows: Parameters<typeof recordEventRevisions>[0] = [];

        for (const event of events) {
          if (!event.externalId) continue;
          returnedExternalIds.add(event.externalId);

          const existing = await db.economicEvent.findUnique({ where: { externalId: event.externalId } });
          const diff = detectFieldChanges(existing, event);

          const saved = await db.economicEvent.upsert({
            where: { externalId: event.externalId },
            update: {
              eventTime: event.eventTime,
              impact: event.impact,
              category: event.category,
              lastSyncedAt: now,
              ...(event.actual !== undefined ? { actual: event.actual } : {}),
              ...(event.forecast !== undefined ? { forecast: event.forecast } : {}),
              ...(event.previous !== undefined ? { previous: event.previous } : {}),
              ...(event.unit !== undefined ? { unit: event.unit } : {}),
              ...(event.frequency !== undefined ? { frequency: event.frequency } : {}),
              ...(event.sourceUrl !== undefined ? { sourceUrl: event.sourceUrl } : {}),
              ...(event.status !== undefined ? { status: event.status } : {}),
              ...(diff.revisedPreviousUpdate !== undefined ? { revisedPrevious: diff.revisedPreviousUpdate } : {}),
            },
            create: { ...event, source: source.providerKey, lastSyncedAt: now },
          });
          result.itemsProcessed += 1;

          if (existing) {
            if (diff.revisions.length > 0) {
              result.itemsUpdated += 1;
              revisionRows.push(
                ...diff.revisions.map((r) => ({ eventId: saved.id, provider: source.providerKey, ...r }))
              );
            }
          } else {
            result.itemsInserted += 1;
          }

          if (shouldDispatchHighImpactAlert(!!existing, saved.impact)) {
            void dispatchEconomicEventAlert(saved);
          }
        }

        // Cancellation detection: a SCHEDULED row from this same provider,
        // still ahead of "now", inside this sync's window, that the
        // provider simply stopped returning — see CLAUDE.md's "never
        // delete existing events" rule. The row stays, flagged CANCELLED,
        // not removed.
        const previouslyScheduled = await db.economicEvent.findMany({
          where: { source: source.providerKey, status: "SCHEDULED", eventTime: { gte: now, lte: to } },
          select: { id: true, externalId: true },
        });
        const disappearedIds = detectDisappearedEvents(
          previouslyScheduled.map((e) => e.externalId).filter((id): id is string => !!id),
          returnedExternalIds
        );
        if (disappearedIds.length > 0) {
          const disappeared = previouslyScheduled.filter((e) => e.externalId && disappearedIds.includes(e.externalId));
          await db.economicEvent.updateMany({
            where: { id: { in: disappeared.map((e) => e.id) } },
            data: { status: "CANCELLED", lastSyncedAt: now },
          });
          revisionRows.push(
            ...disappeared.map((e) => ({
              eventId: e.id,
              fieldChanged: "status",
              oldValue: "SCHEDULED",
              newValue: "CANCELLED",
              provider: source.providerKey,
            }))
          );
          result.itemsCancelled += disappeared.length;
        }

        if (revisionRows.length > 0) {
          await recordEventRevisions(revisionRows);
          result.revisionsRecorded += revisionRows.length;
        }

        await markSyncResult(source.id, "SUCCESS");
      } catch (err) {
        result.itemsFailed += 1;
        await markSyncResult(source.id, "FAILED");
        logger.error("calendarSync provider failed", { providerKey: source.providerKey, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // The calendar page's cached reads (calendar-service.ts) would
    // otherwise serve up to CALENDAR_EVENTS_TTL_SECONDS of stale data
    // after a sync that just wrote real changes — invalidate the
    // currency list; per-query event caches expire on their own short TTL
    // and are addressed by section 14's cache strategy (see docs).
    await cacheInvalidate("calendar-currencies");

    await finishSyncLog(log.id, result.itemsFailed > 0 && result.itemsProcessed === 0 ? "FAILED" : "SUCCESS", {
      itemsProcessed: result.itemsProcessed,
      itemsFailed: result.itemsFailed,
      itemsInserted: result.itemsInserted,
      itemsUpdated: result.itemsUpdated,
      itemsCancelled: result.itemsCancelled,
    });
    return result;
  } catch (err) {
    await finishSyncLog(log.id, "FAILED", {
      itemsProcessed: result.itemsProcessed,
      itemsFailed: result.itemsFailed,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
