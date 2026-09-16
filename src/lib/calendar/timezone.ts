// Timezone display for the calendar, built on the platform's own Intl/ICU
// timezone database rather than adding a date-fns-tz/luxon dependency this
// late — Intl.DateTimeFormat already carries the full IANA tz database
// (including DST rules) in both Node and every evergreen browser, so a
// zone's UTC offset is never computed by hand (the spec explicitly forbids
// "unreliable manual timezone calculations" — this delegates all of that
// math to the platform). Kept deliberately small: format for display,
// resolve a zone's current offset for the existing offset-based range math
// in src/lib/calendar/date-ranges.ts. Nothing here mutates a Date — it only
// ever formats one or computes an offset.

export interface CalendarTimezone {
  id: string; // IANA zone id
  label: string; // shown in the picker
}

// The spec's five required zones plus the site default (Africa/Nairobi,
// already first). Deliberately a short, curated list — not every IANA
// zone — since this is a picker for a Forex audience, not a full tz
// database browser.
export const SUPPORTED_TIMEZONES: CalendarTimezone[] = [
  { id: "Africa/Nairobi", label: "Nairobi (EAT)" },
  { id: "UTC", label: "UTC" },
  { id: "Europe/London", label: "London" },
  { id: "America/New_York", label: "New York" },
  { id: "Asia/Tokyo", label: "Tokyo" },
];

export const DEFAULT_CALENDAR_TIMEZONE = "Africa/Nairobi";

/** Cookie name the timezone picker writes to, read server-side by the
 * calendar page so the choice persists across visits without requiring a
 * signed-in session (CalendarPreference.timezone is the signed-in-only,
 * cross-device version — see saveCalendarPreferencesAction). */
export const CALENDAR_TIMEZONE_COOKIE = "calendar_tz";

export function isSupportedTimezone(id: string | null | undefined): id is string {
  return !!id && SUPPORTED_TIMEZONES.some((tz) => tz.id === id);
}

export function resolveTimezone(id: string | null | undefined): string {
  return isSupportedTimezone(id) ? id : DEFAULT_CALENDAR_TIMEZONE;
}

/** A zone's current UTC offset in minutes-east-of-UTC — matches the sign
 * convention src/lib/calendar/date-ranges.ts already uses (offsetMinutes,
 * positive east). Computed via Intl's own resolved offset (correct across
 * DST transitions) rather than a fixed lookup table. */
export function getTimezoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(offsetPart);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  return hours >= 0 ? hours * 60 + minutes : hours * 60 - minutes;
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  dateFormatterCache.set(timeZone, formatter);
  return formatter;
}

/** Formats a UTC instant directly in the target zone — never a manual
 * offset add on the Date object, so DST is always correct. `date` doubles
 * as a stable per-day grouping key (see CalendarTable) since two instants
 * on the same viewer-local day always format to the same string. */
export function formatInTimezone(date: Date, timeZone: string): { date: string; time: string; weekday: string } {
  const parts = getFormatter(timeZone).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("day")} ${get("month")} ${get("year")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: get("weekday"),
  };
}
