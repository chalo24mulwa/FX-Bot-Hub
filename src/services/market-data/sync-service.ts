import { listEnabledDataSources, markSyncResult } from "@/repositories/data-source-repository";
import { startSyncLog, finishSyncLog } from "@/repositories/sync-log-repository";
import type { SyncResult } from "@/services/calendar/sync-service";

/**
 * STUB job, wired into the same queue/retry/logging/dedup infrastructure as
 * calendarSync and newsSync (see src/lib/queue/workers/market-data-sync-worker.ts)
 * so the architecture is ready the moment a real market-data source exists.
 * There is deliberately no price/instrument model yet — Phase 3's brief
 * doesn't specify one with enough detail to build correctly (candle
 * intervals, tick vs. OHLC, which instruments), and inventing one here
 * would be guessing. Add a MarketPrice model + a provider adapter (mirror
 * src/services/calendar/providers) before this does real work; until then
 * it runs, logs a SyncLog row every time, and does nothing — visible in
 * /admin/data-sources rather than silently absent.
 */
export async function runMarketDataSync(): Promise<SyncResult> {
  const log = await startSyncLog("marketDataSync");
  const sources = await listEnabledDataSources("MARKET_DATA");

  for (const source of sources) {
    await markSyncResult(source.id, "SUCCESS");
  }

  await finishSyncLog(log.id, "SUCCESS", { itemsProcessed: 0, itemsFailed: 0 });
  return { itemsProcessed: 0, itemsFailed: 0 };
}
