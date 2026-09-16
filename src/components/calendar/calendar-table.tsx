import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatInTimezone, SUPPORTED_TIMEZONES } from "@/lib/calendar/timezone";
import type { EconomicEvent } from "@prisma/client";

const IMPACT_STYLES: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 border-red-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-slate-50 text-slate-600 border-slate-200",
  HOLIDAY: "bg-blue-50 text-blue-700 border-blue-200",
  OTHER: "bg-slate-50 text-slate-500 border-slate-200",
};

const STATUS_STYLES: Record<string, string> = {
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-300 line-through",
  POSTPONED: "bg-amber-50 text-amber-700 border-amber-200",
};

function deviation(actual: string | null, forecast: string | null): string | null {
  const a = actual ? parseFloat(actual) : NaN;
  const f = forecast ? parseFloat(forecast) : NaN;
  if (Number.isNaN(a) || Number.isNaN(f)) return null;
  const diff = a - f;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
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

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Time ({tzLabel})</th>
            <th className="py-2 pr-3">Currency</th>
            <th className="py-2 pr-3">Country</th>
            <th className="py-2 pr-3">Impact</th>
            <th className="py-2 pr-3">Event</th>
            <th className="py-2 pr-3">Actual</th>
            <th className="py-2 pr-3">Forecast</th>
            <th className="py-2 pr-3">Previous</th>
            <th className="py-2 pr-3">Deviation</th>
            <th className="py-2 pr-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const { date, time } = formatInTimezone(event.eventTime, timezone);
            const isCancelledOrPostponed = event.status === "CANCELLED" || event.status === "POSTPONED";
            return (
              <tr key={event.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{date}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{time}</td>
                <td className="py-2 pr-3 font-medium">
                  <Link href={`/calendar/${event.currency.toLowerCase()}`} className="hover:underline">
                    {event.currency}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-slate-600">{event.country}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge className={IMPACT_STYLES[event.impact]}>{event.impact}</Badge>
                    {isCancelledOrPostponed && (
                      <Badge className={STATUS_STYLES[event.status]}>{event.status}</Badge>
                    )}
                  </div>
                </td>
                <td className="py-2 pr-3">{event.title}</td>
                <td className="py-2 pr-3 text-slate-600">{event.actual ?? "–"}</td>
                <td className="py-2 pr-3 text-slate-600">{event.forecast ?? "–"}</td>
                <td className="py-2 pr-3 text-slate-600">
                  {event.previous ?? "–"}
                  {event.revisedPrevious && (
                    <span className="ml-1 text-xs text-amber-600" title={`Revised from ${event.revisedPrevious}`}>
                      (revised)
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-600">{deviation(event.actual, event.forecast) ?? "–"}</td>
                <td className="py-2 pr-3">
                  <Link href={`/calendar/event/${event.id}`} className="text-blue-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
