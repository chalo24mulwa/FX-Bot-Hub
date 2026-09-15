import type { CalendarEventInput, CalendarProvider } from "./types";

// STUB — a template for wiring up a real licensed economic-calendar feed
// (e.g. Trading Economics, FXStreet's API, DailyFX API — anything with an
// actual API key and terms permitting redistribution). Never scrape a
// site's HTML; only integrate through an API/feed you're licensed to use.
// Registered in ./index.ts as "licensed-feed" and toggleable via
// DataSource so an admin can flip to it once credentials exist, without
// code changes elsewhere.
export class LicensedFeedCalendarProvider implements CalendarProvider {
  readonly key = "licensed-feed";

  async getEvents(_range: { from: Date; to: Date }): Promise<CalendarEventInput[]> {
    throw new Error(
      "licensed-feed calendar provider is not configured. Set its API key/endpoint and " +
        "implement this method before enabling it in /admin/data-sources."
    );
  }

  async getEvent(_externalId: string): Promise<CalendarEventInput | null> {
    throw new Error("licensed-feed calendar provider is not configured.");
  }

  async getHistoricalData(_currency: string, _title: string): Promise<CalendarEventInput[]> {
    throw new Error("licensed-feed calendar provider is not configured.");
  }
}
