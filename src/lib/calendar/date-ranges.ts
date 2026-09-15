// Pure date-range math for the calendar's Today/Tomorrow/This Week/Next
// Week presets, kept separate from calendar-service.ts (which touches the
// DB) so it's unit-testable in isolation. All ranges are computed against a
// caller-supplied UTC offset in minutes (positive east of UTC, matching
// `Date.getTimezoneOffset()`'s sign flipped — see toUtcRange) rather than
// the server's own timezone, since "today" must mean the viewer's today.

export type CalendarPreset = "today" | "tomorrow" | "week" | "next_week";

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Shifts a UTC instant by `offsetMinutes` (the viewer's minutes-east-of-UTC)
 * so day/week boundaries land on the viewer's local midnight, not the
 * server's. */
function toViewerLocal(date: Date, offsetMinutes: number): Date {
  return new Date(date.getTime() + offsetMinutes * 60_000);
}

function toUtcInstant(localDate: Date, offsetMinutes: number): Date {
  return new Date(localDate.getTime() - offsetMinutes * 60_000);
}

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * @param offsetMinutes viewer's minutes-east-of-UTC (e.g. UTC+3 -> 180,
 *   UTC-5 -> -300). Pass 0 for UTC.
 */
export function getPresetRange(preset: CalendarPreset, now: Date, offsetMinutes: number): DateRange {
  const local = toViewerLocal(now, offsetMinutes);
  const localDayStart = startOfUtcDay(local);

  switch (preset) {
    case "today":
      return {
        from: toUtcInstant(localDayStart, offsetMinutes),
        to: toUtcInstant(addDays(localDayStart, 1), offsetMinutes),
      };
    case "tomorrow":
      return {
        from: toUtcInstant(addDays(localDayStart, 1), offsetMinutes),
        to: toUtcInstant(addDays(localDayStart, 2), offsetMinutes),
      };
    case "week": {
      const weekStart = addDays(localDayStart, -dayOfWeekMondayFirst(localDayStart));
      return {
        from: toUtcInstant(weekStart, offsetMinutes),
        to: toUtcInstant(addDays(weekStart, 7), offsetMinutes),
      };
    }
    case "next_week": {
      const weekStart = addDays(localDayStart, -dayOfWeekMondayFirst(localDayStart));
      const nextWeekStart = addDays(weekStart, 7);
      return {
        from: toUtcInstant(nextWeekStart, offsetMinutes),
        to: toUtcInstant(addDays(nextWeekStart, 7), offsetMinutes),
      };
    }
  }
}

/** Custom range: a viewer-local calendar day (YYYY-MM-DD) through N days later. */
export function getCustomRange(startDateIso: string, days: number, offsetMinutes: number): DateRange {
  const [y, m, d] = startDateIso.split("-").map(Number);
  const localStart = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return {
    from: toUtcInstant(localStart, offsetMinutes),
    to: toUtcInstant(addDays(localStart, days), offsetMinutes),
  };
}

/** Last 7 days through next 14 days from now — used by SEO currency/detail
 * pages that don't need a viewer-local offset. Defaults `now` internally
 * (rather than requiring the caller to pass `new Date()`) so the impure
 * clock read happens here, not inline in a component render body. */
export function getRecentAndUpcomingRange(now: Date = new Date()): DateRange {
  return {
    from: new Date(now.getTime() - 7 * 86_400_000),
    to: new Date(now.getTime() + 14 * 86_400_000),
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** 0 = Monday .. 6 = Sunday (calendar weeks conventionally start Monday). */
function dayOfWeekMondayFirst(date: Date): number {
  const jsDay = date.getUTCDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}
