import { listSecurityEvents } from "@/repositories/security-event-repository";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-red-50 text-red-700 border-red-200",
};

export default async function AdminSecurityPage() {
  const { items: events } = await listSecurityEvents(1, 100);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Security events</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Signals for review — repeated payment failures, unusual download volume, invalid webhook signatures,
        license-activation abuse. Nothing here bans or suspends a user automatically; that decision is yours.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">User</th>
              <th className="py-2 pr-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 text-slate-500">{event.createdAt.toLocaleString()}</td>
                <td className="py-2 pr-3 text-slate-700">{event.type.replace(/_/g, " ")}</td>
                <td className="py-2 pr-3">
                  <Badge className={SEVERITY_STYLES[event.severity]}>{event.severity}</Badge>
                </td>
                <td className="py-2 pr-3 text-slate-500">{event.user ? (event.user.name ?? event.user.email) : "—"}</td>
                <td className="py-2 pr-3 max-w-xs truncate text-xs text-slate-400" title={JSON.stringify(event.metadata)}>
                  {event.metadata ? JSON.stringify(event.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="py-8 text-center text-slate-500">No security events recorded.</p>}
      </div>
    </div>
  );
}
