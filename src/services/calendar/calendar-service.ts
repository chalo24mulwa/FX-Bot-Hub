import type { EconomicEvent, Prisma, EventImpact, EventCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { cacheWrap } from "@/lib/cache";

export interface CalendarQuery {
  from: Date;
  to: Date;
  currencies?: string[];
  countries?: string[];
  impacts?: EventImpact[];
  categories?: EventCategory[];
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 250;

/** Pure where-clause builder, split out from getEvents so filter combinations
 * (empty arrays vs. undefined vs. populated) are unit-testable without a DB. */
export function buildEventWhere(query: CalendarQuery): Prisma.EconomicEventWhereInput {
  return {
    eventTime: { gte: query.from, lte: query.to },
    currency: query.currencies?.length ? { in: query.currencies } : undefined,
    country: query.countries?.length ? { in: query.countries } : undefined,
    impact: query.impacts?.length ? { in: query.impacts } : undefined,
    category: query.categories?.length ? { in: query.categories } : undefined,
  };
}

// Phase 5: caching the app's own JSON round-trip through Redis turns Date
// fields (eventTime/createdAt/updatedAt) into strings on a cache hit —
// unlike ProductCard, CalendarTable calls `.toISOString()` directly on
// `eventTime` with no Date|string tolerance, so this reviver is required,
// not optional, or a cache hit would crash the calendar page. Safe for
// both hit and miss: `new Date(x)` works whether `x` is already a Date or
// a string.
function reviveEventDates(event: EconomicEvent): EconomicEvent {
  return {
    ...event,
    eventTime: new Date(event.eventTime),
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  };
}

const CALENDAR_EVENTS_TTL_SECONDS = 180;

/**
 * The app's only read path for calendar data — always Postgres, paginated,
 * date-bounded. Never queries the whole table (a calendar can hold years of
 * history): every call requires a `from`/`to` range and a capped page size.
 * Providers (src/services/calendar/providers) are for *writing* data in via
 * the sync job, not for serving requests directly — that keeps page loads
 * fast and independent of any upstream API's latency or uptime. Cached
 * (docs/PHASE5_AUDIT.md) since the underlying data only changes via the
 * sync worker or a manual admin edit — a few minutes of staleness is
 * indistinguishable from the sync job's own natural lag.
 */
export async function getEvents(query: CalendarQuery) {
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = query.page ?? 1;
  const where = buildEventWhere(query);

  const cacheKey = `calendar-events:${JSON.stringify({
    ...query,
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    page,
    pageSize,
  })}`;

  const { items, total } = await cacheWrap(cacheKey, CALENDAR_EVENTS_TTL_SECONDS, async () => {
    const [items, total] = await Promise.all([
      db.economicEvent.findMany({
        where,
        orderBy: { eventTime: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.economicEvent.count({ where }),
    ]);
    return { items, total };
  });

  return { items: items.map(reviveEventDates), total, page, pageSize };
}

export async function getEvent(id: string) {
  return db.economicEvent.findUnique({ where: { id } });
}

export async function getHistoricalData(currency: string, title: string, limit = 12) {
  return db.economicEvent.findMany({
    where: { currency, title, eventTime: { lt: new Date() } },
    orderBy: { eventTime: "desc" },
    take: Math.min(limit, 50),
  });
}

export async function listUpcomingHighImpact(limit = 6) {
  return db.economicEvent.findMany({
    where: { impact: "HIGH", eventTime: { gte: new Date() } },
    orderBy: { eventTime: "asc" },
    take: limit,
  });
}

export async function listDistinctCurrencies(): Promise<string[]> {
  return cacheWrap("calendar-currencies", CALENDAR_EVENTS_TTL_SECONDS, async () => {
    const rows = await db.economicEvent.findMany({
      distinct: ["currency"],
      select: { currency: true },
      orderBy: { currency: "asc" },
    });
    return rows.map((r) => r.currency);
  });
}
