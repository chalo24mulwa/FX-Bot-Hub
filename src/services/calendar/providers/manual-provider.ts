import { db } from "@/lib/db";
import type { CalendarEventInput, CalendarProvider } from "./types";

// The only working provider today: it reads back rows already in our own
// EconomicEvent table (source: "manual") — i.e. admin-entered data at
// /admin/calendar. "Syncing" from this provider is therefore a no-op in
// practice (there's nothing external to pull), but it satisfies the same
// CalendarProvider interface as a real feed would, so the sync job, admin
// DataSource UI, and calendar-service don't need to special-case "there is
// no real provider yet." Swap in a licensed feed by adding a new adapter
// here and registering it in ./index.ts — never by scraping a site like
// Forex Factory or TradingView (see CLAUDE.md's data-sourcing rule).
export class ManualCalendarProvider implements CalendarProvider {
  readonly key = "manual";

  async getEvents({ from, to }: { from: Date; to: Date }): Promise<CalendarEventInput[]> {
    const rows = await db.economicEvent.findMany({
      where: { source: "manual", eventTime: { gte: from, lte: to } },
      orderBy: { eventTime: "asc" },
    });
    return rows.map(toInput);
  }

  async getEvent(externalId: string): Promise<CalendarEventInput | null> {
    const row = await db.economicEvent.findUnique({ where: { externalId } });
    return row ? toInput(row) : null;
  }

  async getHistoricalData(currency: string, title: string, limit = 12): Promise<CalendarEventInput[]> {
    const rows = await db.economicEvent.findMany({
      where: { source: "manual", currency, title, eventTime: { lt: new Date() } },
      orderBy: { eventTime: "desc" },
      take: limit,
    });
    return rows.map(toInput);
  }
}

function toInput(row: {
  externalId: string | null;
  country: string;
  currency: string;
  title: string;
  impact: CalendarEventInput["impact"];
  category: CalendarEventInput["category"];
  eventTime: Date;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  description: string | null;
}): CalendarEventInput {
  return {
    externalId: row.externalId ?? "",
    country: row.country,
    currency: row.currency,
    title: row.title,
    impact: row.impact,
    category: row.category,
    eventTime: row.eventTime,
    actual: row.actual ?? undefined,
    forecast: row.forecast ?? undefined,
    previous: row.previous ?? undefined,
    description: row.description ?? undefined,
  };
}
