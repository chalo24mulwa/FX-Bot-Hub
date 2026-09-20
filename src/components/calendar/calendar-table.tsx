import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatInTimezone, SUPPORTED_TIMEZONES } from "@/lib/calendar/timezone";
import { cn } from "@/lib/utils";
import type { EconomicEvent } from "@prisma/client";

// Impact reads as signal-strength bars (3 = high, 2 = medium, 1 = low) rather
// than a full pill badge: compact enough for dozens of rows, and readable at a
// glance without needing more colours than red / amber / slate. Holiday and
// "other" have no strength to show, so they keep a single dot. (Forex Factory's
// calendar is cited only as a *layout* reference per CLAUDE.md's ground rule —
// never as a data source or a visual template.)
const IMPACT_META: Record<string, { label: string; bars: number; color: string; rowAccent: string; rowTint: string; title: string }> = {
  HIGH: { label: "High", bars: 3, color: "bg-red-500", rowAccent: "border-l-red-500", rowTint: "bg-red-50/60 hover:bg-red-50", title: "font-semibold text-slate-900" },
  MEDIUM: { label: "Medium", bars: 2, color: "bg-amber-400", rowAccent: "border-l-amber-400", rowTint: "hover:bg-slate-50", title: "font-medium text-slate-800" },
  LOW: { label: "Low", bars: 1, color: "bg-slate-400", rowAccent: "border-l-transparent", rowTint: "hover:bg-slate-50", title: "text-slate-600" },
  HOLIDAY: { label: "Holiday", bars: 0, color: "bg-sky-500", rowAccent: "border-l-sky-400", rowTint: "bg-sky-50/50 hover:bg-sky-50", title: "text-slate-600" },
  OTHER: { label: "Other", bars: 0, color: "bg-slate-300", rowAccent: "border-l-transparent", rowTint: "hover:bg-slate-50", title: "text-slate-600" },
};

function ImpactBars({ impact }: { impact: string }) {
  const meta = IMPACT_META[impact] ?? IMPACT_META.OTHER;
  return (
    <span className="inline-flex items-center gap-2">
      {meta.bars > 0 ? (
        <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
          {[1, 2, 3].map((level) => (
            <span
              key={level}
              className={cn("w-[3px] rounded-sm", level <= meta.bars ? meta.color : "bg-slate-200")}
              style={{ height: `${4 + level * 3}px` }}
            />
          ))}
        </span>
      ) : (
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.color)} aria-hidden="true" />
      )}
      <span className={cn("text-xs", impact === "HIGH" ? "font-semibold text-red-600" : "text-slate-500")}>{meta.label}</span>
    </span>
  );
}

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
  // All-day rows (holidays, decisions with no set time) carry a noon anchor
  // for grouping — list them first within their day, like a timed schedule's
  // "All day" band, instead of wherever noon happens to fall. Array sort is
  // stable, so timed rows keep their eventTime order.
  for (const group of groups.values()) group.rows.sort((a, b) => Number(b.allDay) - Number(a.allDay));
  return groups;
}

function Cell({ value, className }: { value: string | null; className?: string }) {
  return value ? <span className={className}>{value}</span> : <span className="text-slate-300">–</span>;
}

// Times are formatted directly in the viewer's chosen IANA zone via
// Intl.DateTimeFormat (src/lib/calendar/timezone.ts) — never a manual
// offset added to the Date object, so DST is always correct and there's no
// SSR/client hydration mismatch (the server renders the same zone the
// viewer picked, read from a cookie/searchParam before this component ever
// renders — see src/app/calendar/page.tsx).
export function CalendarTable({ events, timezone, todayDate }: { events: EconomicEvent[]; timezone: string; todayDate?: string }) {
  const surface = "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-12px_rgba(2,6,23,0.45)]";

  if (events.length === 0) {
    return (
      <div className={cn(surface, "px-6 py-16 text-center")}>
        <p className="text-base font-medium text-slate-700">No events in this range.</p>
        <p className="mt-1 text-sm text-slate-500">Try a wider date range or clear some filters.</p>
      </div>
    );
  }

  const tzLabel = SUPPORTED_TIMEZONES.find((tz) => tz.id === timezone)?.label ?? timezone;
  // "Nairobi (EAT)" -> "EAT": the short zone code keeps the column header on one line.
  const tzShort = /\(([^)]+)\)/.exec(tzLabel)?.[1] ?? tzLabel;
  const days = [...groupByDay(events, timezone).values()];
  const th = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className={surface}>
      <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-400 sm:hidden">Swipe sideways for Actual · Forecast · Previous →</p>
      {/* Own horizontal scroll: a narrow screen scrolls the table, not the page. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className={cn(th, "whitespace-nowrap pl-4")} title={`Times shown in ${tzLabel}`}>
                Time ({tzShort})
              </th>
              <th className={th}>Currency</th>
              <th className={th}>Impact</th>
              <th className={th}>Event</th>
              <th className={th}>Actual</th>
              <th className={th}>Forecast</th>
              <th className={th}>Previous</th>
            </tr>
          </thead>
          {days.map((day) => {
            const isToday = todayDate === day.date;
            return (
              <tbody key={day.date}>
                <tr>
                  <th
                    colSpan={7}
                    className="border-y border-slate-900/10 bg-gradient-to-r from-[#111a3a] via-[#191446] to-[#111a3a] px-4 py-1.5 text-left text-xs font-semibold tracking-wide text-slate-100"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-1 rounded-full bg-violet-400" aria-hidden="true" />
                      {day.weekday}, {day.date}
                      {isToday && (
                        <span className="rounded-full bg-amber-500 px-2 py-px text-[10px] font-bold uppercase tracking-wider text-slate-900">Today</span>
                      )}
                    </span>
                  </th>
                </tr>
                {day.rows.map((event) => {
                  const { time } = formatInTimezone(event.eventTime, timezone);
                  const meta = IMPACT_META[event.impact] ?? IMPACT_META.OTHER;
                  const isCancelledOrPostponed = event.status === "CANCELLED" || event.status === "POSTPONED";
                  return (
                    <tr key={event.id} className={cn("border-b border-slate-100 transition-colors motion-reduce:transition-none", meta.rowTint)}>
                      <td className={cn("whitespace-nowrap border-l-[3px] py-2 pl-[13px] pr-3 tabular-nums text-slate-600", meta.rowAccent)}>
                        {event.allDay ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">All day</span>
                        ) : (
                          <span className="font-medium">{time}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/calendar/${event.currency.toLowerCase()}`}
                          className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 transition-colors hover:bg-violet-100 hover:text-violet-700"
                        >
                          {event.currency}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2" title={event.impact}>
                          <ImpactBars impact={event.impact} />
                          {isCancelledOrPostponed && <Badge className={STATUS_STYLES[event.status]}>{event.status}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/calendar/event/${event.id}`} className={cn("transition-colors hover:text-violet-700 hover:underline", meta.title)}>
                          {event.title}
                        </Link>
                      </td>
                      <td className="max-w-[220px] px-3 py-2">
                        <Cell value={event.actual} className={cn("font-semibold", actualColor(event.actual, event.forecast))} />
                      </td>
                      <td className="max-w-[200px] px-3 py-2 text-slate-600">
                        <Cell value={event.forecast} />
                      </td>
                      <td className="max-w-[220px] px-3 py-2 text-slate-600">
                        <Cell value={event.previous} />
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
            );
          })}
        </table>
      </div>
    </div>
  );
}
