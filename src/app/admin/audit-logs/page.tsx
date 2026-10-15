import Link from "next/link";
import { listAuditLogs } from "@/repositories/audit-log-repository";

export const dynamic = "force-dynamic";

type Params = { page?: string; actor?: string; action?: string; entityType?: string; entityId?: string; session?: string; from?: string; to?: string };

const PAGE_SIZE = 30;

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** One readable line from the stored metadata — reason first, never anything that looks like a secret. */
function summarize(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.reason === "string" && m.reason) parts.push(`Reason: ${m.reason}`);
  if (typeof m.from === "string" && typeof m.to === "string") parts.push(`${m.from} → ${m.to}`);
  if (typeof m.role === "string") parts.push(`Role: ${m.role}`);
  if (typeof m.path === "string") parts.push(`Page: ${m.path}`);
  if (Array.isArray(m.changed)) parts.push(`Changed: ${m.changed.join(", ")}`);
  return parts.join(" · ").slice(0, 300);
}

const field = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { items, total } = await listAuditLogs(page, PAGE_SIZE, {
    actor: params.actor,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    impersonationSessionId: params.session,
    from: parseDate(params.from),
    to: parseDate(params.to, true),
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, page: String(n) })) if (v) sp.set(k, v);
    return `/admin/audit-logs?${sp.toString()}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Audit logs</h1>
      <p className="mt-1 text-sm text-slate-500">{total} entries · append-only — nothing here can be edited or deleted from the site.</p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2" role="search" aria-label="Filter the audit log">
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Administrator (email)
          <input name="actor" defaultValue={params.actor ?? ""} className={`${field} w-48`} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Action
          <input name="action" defaultValue={params.action ?? ""} placeholder="e.g. impersonation." className={`${field} w-44`} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Record type
          <input name="entityType" defaultValue={params.entityType ?? ""} placeholder="User, Product…" className={`${field} w-32`} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Record ID
          <input name="entityId" defaultValue={params.entityId ?? ""} className={`${field} w-44`} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Access session
          <input name="session" defaultValue={params.session ?? ""} className={`${field} w-40`} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          From
          <input type="date" name="from" defaultValue={params.from ?? ""} className={field} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          To
          <input type="date" name="to" defaultValue={params.to ?? ""} className={field} />
        </label>
        <button type="submit" className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white">
          Filter
        </button>
        <Link href="/admin/audit-logs" className="h-9 content-center text-sm text-slate-500 hover:underline">
          Clear
        </Link>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Actor</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Entity</th>
              <th className="py-2 pr-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => (
              <tr key={log.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap py-2 pr-4 text-slate-500">{log.createdAt.toLocaleString()}</td>
                <td className="py-2 pr-4 text-slate-600">{log.actor?.email ?? "system"}</td>
                <td className="py-2 pr-4 font-medium text-slate-900">
                  {log.action}
                  {log.impersonationSessionId && (
                    <Link href={`/admin/audit-logs?session=${log.impersonationSessionId}`} className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title="Done inside a view-as-user session">
                      access session
                    </Link>
                  )}
                </td>
                <td className="py-2 pr-4 text-slate-600">
                  {log.entityType}
                  {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                </td>
                <td className="max-w-md py-2 pr-4 text-xs text-slate-600">{summarize(log.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No matching activity.</p>}
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={qs(page - 1)} className="text-blue-600 hover:underline">← Newer</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={qs(page + 1)} className="text-blue-600 hover:underline">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
