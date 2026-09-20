import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEvent, getHistoricalData, getEventRevisionHistory } from "@/services/calendar/calendar-service";
import { resolveTimezone, formatInTimezone, CALENDAR_TIMEZONE_COOKIE, SUPPORTED_TIMEZONES } from "@/lib/calendar/timezone";
import { Badge } from "@/components/ui/badge";
import { CalendarAttribution } from "@/components/calendar/calendar-attribution";
import { AlertSubscribeButton } from "@/components/alerts/alert-subscribe-button";

const STATUS_STYLES: Record<string, string> = {
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-300 line-through",
  POSTPONED: "bg-amber-50 text-amber-700 border-amber-200",
  RELEASED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const dynamic = "force-dynamic";

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return {};
  return {
    title: `${event.title} (${event.currency})`,
    description: `${event.title} — scheduled ${event.eventTime.toISOString()}, impact: ${event.impact}.`,
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const [event, session, cookieStore] = await Promise.all([getEvent(id), auth(), cookies()]);
  if (!event) notFound();

  const timezone = resolveTimezone(cookieStore.get(CALENDAR_TIMEZONE_COOKIE)?.value);
  const tzLabel = SUPPORTED_TIMEZONES.find((tz) => tz.id === timezone)?.label ?? timezone;
  const { date, time } = formatInTimezone(event.eventTime, timezone);

  const [history, revisions, isSubscribedToEvent, isSubscribedToCurrency] = await Promise.all([
    getHistoricalData(event.currency, event.title),
    getEventRevisionHistory(event.id),
    session?.user ? db.alert.findUnique({ where: { userId_type_targetId: { userId: session.user.id, type: "ECONOMIC_EVENT", targetId: event.id } } }).then(Boolean) : Promise.resolve(false),
    session?.user ? db.alert.findUnique({ where: { userId_type_targetId: { userId: session.user.id, type: "CURRENCY", targetId: event.currency } } }).then(Boolean) : Promise.resolve(false),
  ]);

  // Related instruments: any currency pair involving this event's currency,
  // drawn from our own instrument-name conventions (e.g. "EURUSD" for EUR) —
  // a simple, honest heuristic rather than a fabricated "related markets" feed.
  const relatedInstruments = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"]
    .filter((c) => c !== event.currency)
    .map((c) => `${event.currency}${c}`);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{event.title}</h1>
        <Badge>{event.currency}</Badge>
        <Badge>{event.impact}</Badge>
        <Badge>{event.category.replace("_", " ")}</Badge>
        {event.status !== "SCHEDULED" && <Badge className={STATUS_STYLES[event.status]}>{event.status}</Badge>}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {event.country} · {date} {event.allDay ? "All day" : `${time} (${tzLabel})`}
        {event.unit && ` · Unit: ${event.unit}`}
        {event.frequency && ` · ${event.frequency}`}
      </p>

      {event.description && <p className="mt-4 text-slate-700">{event.description}</p>}

      <div className="mt-6 grid grid-cols-3 gap-4 rounded-md border border-slate-200 p-4 text-center">
        <div>
          <p className="text-xs text-slate-400">Actual</p>
          <p className="text-lg font-semibold text-slate-900">{event.actual ?? "–"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Forecast</p>
          <p className="text-lg font-semibold text-slate-900">{event.forecast ?? "–"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Previous</p>
          <p className="text-lg font-semibold text-slate-900">{event.previous ?? "–"}</p>
          {event.revisedPrevious && (
            <p className="mt-0.5 text-xs text-amber-600">Revised from {event.revisedPrevious}</p>
          )}
        </div>
      </div>

      {event.sourceUrl && (
        <p className="mt-3 text-xs text-slate-400">
          <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 hover:underline">
            View this release at the source
          </a>
        </p>
      )}

      {session?.user && (
        <div className="mt-6 flex flex-wrap gap-2">
          <AlertSubscribeButton
            type="ECONOMIC_EVENT"
            targetId={event.id}
            initialSubscribed={isSubscribedToEvent}
            label="Remind me before this event"
          />
          <AlertSubscribeButton
            type="CURRENCY"
            targetId={event.currency}
            initialSubscribed={isSubscribedToCurrency}
            label={`Alert me on new ${event.currency} events`}
          />
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Historical observations</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No prior occurrences on record.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3">Actual</th>
                <th className="py-1.5 pr-3">Forecast</th>
                <th className="py-1.5 pr-3">Previous</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-600">{h.eventTime.toISOString().slice(0, 10)}</td>
                  <td className="py-1.5 pr-3">{h.actual ?? "–"}</td>
                  <td className="py-1.5 pr-3">{h.forecast ?? "–"}</td>
                  <td className="py-1.5 pr-3">{h.previous ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {revisions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Update history</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            {revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-xs text-slate-400">{r.changedAt.toLocaleString()}</span>
                <span>
                  <span className="font-medium text-slate-700">{r.fieldChanged}</span>
                  {" changed "}
                  {r.oldValue !== null && <>from <span className="font-medium">{r.oldValue}</span> </>}
                  to <span className="font-medium">{r.newValue ?? "–"}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Related instruments</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {relatedInstruments.map((instrument) => (
            <Badge key={instrument}>{instrument}</Badge>
          ))}
        </div>
      </section>

      <section className="mt-8 text-xs text-slate-400">
        <p>Source: {event.source === "manual" ? "fx Bot Hub editorial team" : event.source}</p>
        <CalendarAttribution className="mt-1" />
        <p className="mt-2 max-w-xl">
          Economic events can affect markets but do not guarantee a particular market movement. This
          information is provided for reference only and is not trading advice.
        </p>
      </section>
    </main>
  );
}
