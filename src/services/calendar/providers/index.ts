import type { CalendarProvider } from "./types";
import { ManualCalendarProvider } from "./manual-provider";
import { AuthorizedCalendarProvider } from "./authorized-provider";

export type { CalendarProvider, CalendarEventInput } from "./types";

// Registry keyed by DataSource.providerKey — the sync job and admin UI look
// providers up by key rather than importing a class directly, so adding a
// new one is "write the adapter + add a line here," never a change to the
// sync/admin code itself.
const CALENDAR_PROVIDERS: Record<string, CalendarProvider> = {
  manual: new ManualCalendarProvider(),
  authorized: new AuthorizedCalendarProvider(),
};

export function getCalendarProvider(key: string): CalendarProvider | undefined {
  return CALENDAR_PROVIDERS[key];
}

export function listCalendarProviderKeys(): string[] {
  return Object.keys(CALENDAR_PROVIDERS);
}
