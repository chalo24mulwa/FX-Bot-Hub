import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { RemoveSignalButton } from "@/components/admin/remove-signal-button";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-50 text-blue-700 border-blue-200",
  CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function AdminSignalsPage() {
  const signals = await db.signal.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: { provider: { select: { displayName: true, slug: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Signals</h1>
      <p className="mt-1 text-sm text-slate-500">
        Removing a signal marks it CANCELLED — it disappears from the public feed but stays in the record.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Instrument</th>
              <th className="py-2 pr-3">Direction</th>
              <th className="py-2 pr-3">Provider</th>
              <th className="py-2 pr-3">Published</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{signal.instrument}</td>
                <td className="py-2 pr-3 text-slate-600">{signal.direction}</td>
                <td className="py-2 pr-3 text-slate-500">{signal.provider.displayName}</td>
                <td className="py-2 pr-3 text-slate-500">{signal.publishedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="py-2 pr-3">
                  <Badge className={STATUS_STYLES[signal.status]}>{signal.status}</Badge>
                </td>
                <td className="py-2 pr-3">
                  <RemoveSignalButton id={signal.id} disabled={signal.status === "CANCELLED"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {signals.length === 0 && <p className="py-8 text-center text-slate-500">No signals yet.</p>}
      </div>
    </div>
  );
}
