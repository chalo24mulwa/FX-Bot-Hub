import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { EconomicEvent } from "@prisma/client";

const IMPACT_STYLES: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 border-red-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-slate-50 text-slate-600 border-slate-200",
  HOLIDAY: "bg-blue-50 text-blue-700 border-blue-200",
  OTHER: "bg-slate-50 text-slate-500 border-slate-200",
};

function deviation(actual: string | null, forecast: string | null): string | null {
  const a = actual ? parseFloat(actual) : NaN;
  const f = forecast ? parseFloat(forecast) : NaN;
  if (Number.isNaN(a) || Number.isNaN(f)) return null;
  const diff = a - f;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
}

// Times are shown in UTC (labelled) rather than the viewer's local zone —
// a deliberate simplification to avoid an SSR/client hydration mismatch
// from formatting a Date with the visitor's timezone on the server. The
// underlying range math (src/lib/calendar/date-ranges.ts) is already
// timezone-aware and unit-tested; per-viewer *display* localization is a
// known follow-up (see CLAUDE.md).
export function CalendarTable({ events }: { events: EconomicEvent[] }) {
  if (events.length === 0) {
    return <p className="mt-8 text-slate-500">No events in this range.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-3">Time (UTC)</th>
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
          {events.map((event) => (
            <tr key={event.id} className="border-b border-slate-100">
              <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                {event.eventTime.toISOString().slice(11, 16)}
              </td>
              <td className="py-2 pr-3 font-medium">
                <Link href={`/calendar/${event.currency.toLowerCase()}`} className="hover:underline">
                  {event.currency}
                </Link>
              </td>
              <td className="py-2 pr-3 text-slate-600">{event.country}</td>
              <td className="py-2 pr-3">
                <Badge className={IMPACT_STYLES[event.impact]}>{event.impact}</Badge>
              </td>
              <td className="py-2 pr-3">{event.title}</td>
              <td className="py-2 pr-3 text-slate-600">{event.actual ?? "–"}</td>
              <td className="py-2 pr-3 text-slate-600">{event.forecast ?? "–"}</td>
              <td className="py-2 pr-3 text-slate-600">{event.previous ?? "–"}</td>
              <td className="py-2 pr-3 text-slate-600">{deviation(event.actual, event.forecast) ?? "–"}</td>
              <td className="py-2 pr-3">
                <Link href={`/calendar/event/${event.id}`} className="text-blue-600 hover:underline">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
