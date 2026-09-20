import type { EventImpact, EventCategory, EconomicEventStatus } from "@prisma/client";

/** Shape a provider returns — not the DB row. The sync service maps this
 * into EconomicEvent (upserting by externalId for dedup). */
export interface CalendarEventInput {
  externalId: string;
  country: string;
  currency: string;
  title: string;
  impact: EventImpact;
  category: EventCategory;
  eventTime: Date;
  actual?: string;
  forecast?: string;
  previous?: string;
  description?: string;
  /** Provider-reported unit ("%", "K", "B USD") and release frequency
   * ("Monthly", "Quarterly") — display-only, never required. */
  unit?: string;
  frequency?: string;
  /** Deep link to the provider's own page for this release — required by
   * most licensed-feed terms for attribution. */
  sourceUrl?: string;
  /** Date known, time not (a provider's "All day" / "tentative" entry).
   * `eventTime` is then only a same-calendar-day anchor, and the UI shows
   * "All day" instead of a clock time. Defaults to false. */
  allDay?: boolean;
  /** Defaults to SCHEDULED (or RELEASED, inferred from `actual` being
   * present) by the sync service if the provider doesn't report one
   * directly — see sync-service.ts's `inferStatus`. */
  status?: EconomicEventStatus;
}

/** Credit a provider's terms require next to its data — rendered by
 * CalendarAttribution for whichever provider(s) are currently enabled, so
 * swapping providers swaps the credit automatically. */
export interface CalendarAttribution {
  name: string;
  url: string;
}

export interface CalendarProvider {
  attribution?: CalendarAttribution;
  /** Matches a DataSource.providerKey row so admins can enable/configure it
   * without a deploy. */
  key: string;
  getEvents(range: { from: Date; to: Date }): Promise<CalendarEventInput[]>;
  getEvent(externalId: string): Promise<CalendarEventInput | null>;
  /** Past occurrences of the same recurring event (e.g. every prior "US
   * Non-Farm Payrolls" release), most recent first. */
  getHistoricalData(currency: string, title: string, limit?: number): Promise<CalendarEventInput[]>;
}
