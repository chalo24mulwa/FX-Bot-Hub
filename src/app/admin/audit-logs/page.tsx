import { listAuditLogs } from "@/repositories/audit-log-repository";

export const dynamic = "force-dynamic";

interface AuditLogsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const { items, total } = await listAuditLogs(page, 30);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Audit logs</h1>
      <p className="mt-1 text-sm text-slate-500">{total} entries</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Actor</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Entity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => (
              <tr key={log.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-500">{log.createdAt.toLocaleString()}</td>
                <td className="py-2 pr-4 text-slate-600">{log.actor?.email ?? "system"}</td>
                <td className="py-2 pr-4 font-medium text-slate-900">{log.action}</td>
                <td className="py-2 pr-4 text-slate-600">
                  {log.entityType}
                  {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No activity yet.</p>}
      </div>
    </div>
  );
}
