import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { CreateEventForm } from "@/components/admin/create-event-form";
import { DeleteEventButton } from "@/components/admin/delete-event-button";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const events = await db.economicEvent.findMany({
    orderBy: { eventTime: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Calendar events</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manual override — create/fix events directly. Synced providers also write here (source &ne; &quot;manual&quot;).
      </p>

      <div className="mt-6">
        <CreateEventForm />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Currency</th>
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Impact</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 text-slate-600">{event.eventTime.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="py-2 pr-3 font-medium">{event.currency}</td>
                <td className="py-2 pr-3">{event.title}</td>
                <td className="py-2 pr-3">
                  <Badge>{event.impact}</Badge>
                </td>
                <td className="py-2 pr-3 text-slate-500">{event.source}</td>
                <td className="py-2 pr-3">
                  <DeleteEventButton id={event.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="py-8 text-center text-slate-500">No events yet.</p>}
      </div>
    </div>
  );
}
