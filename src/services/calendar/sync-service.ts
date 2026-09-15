import type { EventImpact } from "@prisma/client";
import { db } from "@/lib/db";
import { listEnabledDataSources, markSyncResult } from "@/repositories/data-source-repository";
import { startSyncLog, finishSyncLog } from "@/repositories/sync-log-repository";
import { getCalendarProvider } from "./providers";
import { dispatchEconomicEventAlert } from "@/features/alerts/dispatch-service";

const SYNC_WINDOW_DAYS = 14;

/** Pure gating rule, split out for unit testing: alert only on a row that
 * did not already exist (a genuinely new event) and only for HIGH impact —
 * otherwise every re-sync pass touching the same row would re-spam
 * subscribers. */
export function shouldDispatchHighImpactAlert(wasExisting: boolean, impact: EventImpact): boolean {
  return !wasExisting && impact === "HIGH";
}

export interface SyncResult {
  itemsProcessed: number;
  itemsFailed: number;
}

/**
 * Pulls events from every enabled CALENDAR DataSource and upserts them by
 * externalId (dedup — a re-run never creates duplicates, only updates
 * actual/forecast/previous as they come in). One provider failing doesn't
 * abort the others; each source's own lastSyncStatus reflects its own run.
 * Called by the calendarSync queue worker — see src/lib/queue/workers.
 */
export async function runCalendarSync(): Promise<SyncResult> {
  const log = await startSyncLog("calendarSync");
  let itemsProcessed = 0;
  let itemsFailed = 0;

  try {
    const sources = await listEnabledDataSources("CALENDAR");
    const from = new Date();
    const to = new Date(from.getTime() + SYNC_WINDOW_DAYS * 86_400_000);

    for (const source of sources) {
      const provider = getCalendarProvider(source.providerKey);
      if (!provider) {
        itemsFailed += 1;
        await markSyncResult(source.id, "FAILED");
        continue;
      }

      try {
        const events = await provider.getEvents({ from, to });
        for (const event of events) {
          if (!event.externalId) continue;
          const existing = await db.economicEvent.findUnique({ where: { externalId: event.externalId } });
          const saved = await db.economicEvent.upsert({
            where: { externalId: event.externalId },
            update: {
              actual: event.actual,
              forecast: event.forecast,
              previous: event.previous,
              eventTime: event.eventTime,
            },
            create: { ...event, source: source.providerKey },
          });
          itemsProcessed += 1;

          if (shouldDispatchHighImpactAlert(!!existing, saved.impact)) {
            void dispatchEconomicEventAlert(saved);
          }
        }
        await markSyncResult(source.id, "SUCCESS");
      } catch (err) {
        itemsFailed += 1;
        await markSyncResult(source.id, "FAILED");
        console.error(`[calendarSync] provider "${source.providerKey}" failed:`, err);
      }
    }

    await finishSyncLog(log.id, itemsFailed > 0 && itemsProcessed === 0 ? "FAILED" : "SUCCESS", {
      itemsProcessed,
      itemsFailed,
    });
    return { itemsProcessed, itemsFailed };
  } catch (err) {
    await finishSyncLog(log.id, "FAILED", {
      itemsProcessed,
      itemsFailed,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
