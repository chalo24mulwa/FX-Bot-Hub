import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatInTimezone, SUPPORTED_TIMEZONES } from "@/lib/calendar/timezone";
import type { EconomicEvent } from "@prisma/client";

// Impact reads as a small colored dot + label rather than a full badge —
// closer to the compact, scannable convention economic calendars in this
// space (Forex Factory's calendar included, cited only as a *layout*
// reference per CLAUDE.md's ground rule — never as a data source) use, and
// one of the "declutter this page" changes: a dot takes a fraction of the
// horizontal space a pill badge does across dozens of rows.
const IMPACT_DOT: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-slate-400",
  HOLIDAY: "bg-blue-500",
  OTHER: "bg-slate-300",
};

const STATUS_STYLES: Record<string, string> = {
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-300 line-through",
  POSTPONED: "bg-amber-50 text-amber-700 border-amber-200",
};

/** Forex Factory's own convention: color the actual reading by whether it
 * beat or missed forecast, full stop — not by whether that's economically
 * "good" (e.g. a rising unemployment rate is a worse outcome despite being
 * a higher number). Replaces a separate numeric "Deviation" column with
 * the same information carried by color, one less column on a page this
 * dense. */
function actualColor(actual: string | null, forecast: string | null): string {
  const a = actual ? parseFloat(actual) : NaN;
  const f = forecast ? parseFloat(forecast) : NaN;
  if (Number.isNaN(a) || Number.isNaN(f)) return "text-slate-900";
  if (a > f) return "text-emerald-600";
  if (a < f) return "text-red-600";
  return "text-slate-900";
}

/** Events grouped by the viewer's local calendar day, in a fixed map so
 * insertion order (already eventTime-ascending from calendar-service)
 * determines both group order and row order within a group. `date` from
 * formatInTimezone is already a stable per-day string, so it doubles as
 * the grouping key — no separate day-boundary math needed here. */
function groupByDay(events: EconomicEvent[], timezone: string): Map<string, { weekday: string; date: string; rows: EconomicEvent[] }> {
  const groups = new Map<string, { weekday: string; date: string; rows: EconomicEvent[] }>();
  for (const event of events) {
    const { date, weekday } = formatInTimezone(event.eventTime, timezone);
    const existing = groups.get(date);
    if (existing) existing.rows.push(event);
    else groups.set(date, { weekday, date, rows: [event] });
  }
  return groups;
}

// Times are formatted directly in the viewer's chosen IANA zone via
// Intl.DateTimeFormat (src/lib/calendar/timezone.ts) — never a manual
// offset added to the Date object, so DST is always correct and there's no
// SSR/client hydration mismatch (the server renders the same zone the
// viewer picked, read from a cookie/searchParam before this component ever
// renders — see src/app/calendar/page.tsx).
export function CalendarTable({ events, timezone }: { events: EconomicEvent[]; timezone: string }) {
  if (events.length === 0) {
    return <p className="mt-8 text-slate-500">No events in this range.</p>;
  }

  const tzLabel = SUPPORTED_TIMEZONES.find((tz) => tz.id === timezone)?.label ?? timezone;
  const days = [...groupByDay(events, timezone).values()];

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3">Time ({tzLabel})</th>
            <th className="py-2 pr-3">Currency</th>
            <th className="py-2 pr-3">Impact</th>
            <th className="py-2 pr-3">Event</th>
            <th className="py-2 pr-3">Actual</th>
            <th className="py-2 pr-3">Forecast</th>
            <th className="py-2 pr-3">Previous</th>
          </tr>
        </thead>
        {days.map((day) => (
          <tbody key={day.date}>
            <tr>
              <th colSpan={7} className="border-b border-slate-200 bg-slate-50 py-2 pl-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {day.weekday}, {day.date}
              </th>
            </tr>
            {day.rows.map((event) => {
              const { time } = formatInTimezone(event.eventTime, timezone);
              const isCancelledOrPostponed = event.status === "CANCELLED" || event.status === "POSTPONED";
              return (
                <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="py-2 pr-3 pl-1 whitespace-nowrap text-slate-500">{time}</td>
                  <td className="py-2 pr-3 font-medium">
                    <Link href={`/calendar/${event.currency.toLowerCase()}`} className="hover:underline">
                      {event.currency}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${IMPACT_DOT[event.impact]}`} title={event.impact} aria-hidden="true" />
                      <span className="text-xs text-slate-500">{event.impact}</span>
                      {isCancelledOrPostponed && (
                        <Badge className={STATUS_STYLES[event.status]}>{event.status}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Link href={`/calendar/event/${event.id}`} className="hover:underline">
                      {event.title}
                    </Link>
                  </td>
                  <td className={`py-2 pr-3 font-medium ${actualColor(event.actual, event.forecast)}`}>{event.actual ?? "–"}</td>
                  <td className="py-2 pr-3 text-slate-600">{event.forecast ?? "–"}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {event.previous ?? "–"}
                    {event.revisedPrevious && (
                      <span className="ml-1 text-xs text-amber-600" title={`Revised from ${event.revisedPrevious}`}>
                        (revised)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
