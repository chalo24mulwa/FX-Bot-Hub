import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

// Event list changes independently of any build; never prerender it statically.
export const dynamic = "force-dynamic";

const impactStyles: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 border-red-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-slate-50 text-slate-600 border-slate-200",
};

export default async function CalendarPage() {
  const events = await db.economicEvent.findMany({
    where: { eventTime: { gte: new Date() } },
    orderBy: { eventTime: "asc" },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Economic calendar</h1>
      <p className="mt-1 text-sm text-slate-500">Upcoming market-moving events</p>

      {events.length === 0 ? (
        <p className="mt-8 text-slate-500">
          No events yet. Seed some with <code className="rounded bg-slate-100 px-1 py-0.5">npx prisma db seed</code>{" "}
          — Phase 2 wires this to a live provider via the calendarSyncQueue.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Time</th>
              <th className="py-2">Currency</th>
              <th className="py-2">Event</th>
              <th className="py-2">Impact</th>
              <th className="py-2">Actual / Forecast / Previous</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-600">{event.eventTime.toLocaleString()}</td>
                <td className="py-2 font-medium">{event.currency}</td>
                <td className="py-2">{event.title}</td>
                <td className="py-2">
                  <Badge className={impactStyles[event.impact]}>{event.impact}</Badge>
                </td>
                <td className="py-2 text-slate-600">
                  {event.actual ?? "–"} / {event.forecast ?? "–"} / {event.previous ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
