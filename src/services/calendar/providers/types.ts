import type { EventImpact, EventCategory } from "@prisma/client";

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
}

export interface CalendarProvider {
  /** Matches a DataSource.providerKey row so admins can enable/configure it
   * without a deploy. */
  key: string;
  getEvents(range: { from: Date; to: Date }): Promise<CalendarEventInput[]>;
  getEvent(externalId: string): Promise<CalendarEventInput | null>;
  /** Past occurrences of the same recurring event (e.g. every prior "US
   * Non-Farm Payrolls" release), most recent first. */
  getHistoricalData(currency: string, title: string, limit?: number): Promise<CalendarEventInput[]>;
}
