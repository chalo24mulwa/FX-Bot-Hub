import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { CalendarEventInput, CalendarProvider } from "./types";
import {
  FINANCECALENDAR_ATTRIBUTION,
  FINANCECALENDAR_MAX_LIMIT,
  FINANCECALENDAR_PROVIDER_KEY,
  formatApiDate,
  mapFinanceCalendarEvent,
  parseFinanceCalendarResponse,
  splitDateRange,
} from "./financecalendar-mapping";

// Primary, free calendar feed: https://www.financecalendar.com/api/ — JSON,
// no API key, free for commercial use with a visible link back to
// financecalendar.com (rendered by CalendarAttribution). It is queried ONLY
// from the sync job (runCalendarSync) — never from a page or API-route
// request — so page loads are served from our own Postgres rows and the
// upstream is hit about once an hour. See financecalendar-mapping.ts for the
// ways this feed differs from a classic per-currency forex calendar (no
// currency field, free-text values, sparse consensus).
//
// Provider-independent by design: everything Finance-Calendar-specific lives
// in this file and its mapping sibling. To move to Trading Economics (or any
// licensed feed), enable that provider's DataSource row and disable this one
// at /admin/data-sources — no calendar, sync, or UI code changes.

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const USER_AGENT = "fxbothub-calendar-sync/1.0 (+https://fxbothub.com)";

async function fetchJsonWithRetry(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) return await res.json();
      // A 4xx (other than 429) is a request/config problem, not transient — don't retry it.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new NonRetryableError(`Finance Calendar request failed (${res.status})`);
      }
      lastError = new Error(`Finance Calendar request failed (${res.status})`);
    } catch (err) {
      if (err instanceof NonRetryableError) throw err;
      lastError = err;
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
      logger.warn("financecalendar provider retrying", { attempt });
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Finance Calendar request failed");
}

class NonRetryableError extends Error {}

export class FinanceCalendarProvider implements CalendarProvider {
  readonly key = FINANCECALENDAR_PROVIDER_KEY;
  readonly attribution = { ...FINANCECALENDAR_ATTRIBUTION };

  /**
   * One or two requests per sync (the API caps a range at 92 days and the
   * default window is 93). `limit` is always sent: without it the API
   * silently returns only the first 100 events, which would drop the back
   * half of a 3-month window with no error. If a response still fills the
   * limit it may be truncated, so that range is bisected and re-requested.
   */
  async getEvents({ from, to }: { from: Date; to: Date }): Promise<CalendarEventInput[]> {
    const byId = new Map<string, CalendarEventInput>();
    let rejected = 0;
    let unmapped = 0;

    for (const range of splitDateRange(from, to)) {
      for (const raw of await this.fetchRange(range.from, range.to)) {
        const mapped = mapFinanceCalendarEvent(raw);
        if (!mapped) {
          rejected += 1;
          continue;
        }
        if (mapped.unmapped) unmapped += 1;
        const { unmapped: _flag, ...event } = mapped;
        byId.set(event.externalId, event);
      }
    }

    if (rejected > 0 || unmapped > 0) {
      logger.warn("financecalendar provider: rows needing attention", { rejected, unmappedCurrency: unmapped });
    }
    return [...byId.values()];
  }

  private async fetchRange(from: Date, to: Date): Promise<ReturnType<typeof parseFinanceCalendarResponse>["valid"]> {
    const base = env.FINANCE_CALENDAR_API_URL.replace(/\/$/, "");
    const url = `${base}/calendar?from=${formatApiDate(from)}&to=${formatApiDate(to)}&limit=${FINANCECALENDAR_MAX_LIMIT}`;
    const { valid, rejected, total } = parseFinanceCalendarResponse(await fetchJsonWithRetry(url));
    if (rejected > 0) logger.warn("financecalendar provider rejected malformed rows", { rejected, kept: valid.length });

    const singleDay = formatApiDate(from) === formatApiDate(to);
    if (total >= FINANCECALENDAR_MAX_LIMIT && !singleDay) {
      const midpoint = new Date(from.getTime() + Math.floor((to.getTime() - from.getTime()) / 2 / 86_400_000) * 86_400_000);
      const next = new Date(midpoint.getTime() + 86_400_000);
      logger.warn("financecalendar provider: response hit the row limit, splitting range", { from: formatApiDate(from), to: formatApiDate(to) });
      return [...(await this.fetchRange(from, midpoint)), ...(await this.fetchRange(next, to))];
    }
    return valid;
  }

  /** The feed has no lookup-by-id endpoint; the app reads single events from
   * its own DB (calendar-service.getEvent), never from a provider. */
  async getEvent(): Promise<CalendarEventInput | null> {
    return null;
  }

  /** Same: history is served from our own stored rows (calendar-service.getHistoricalData). */
  async getHistoricalData(): Promise<CalendarEventInput[]> {
    return [];
  }
}
