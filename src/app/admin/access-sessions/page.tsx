import Link from "next/link";
import { listImpersonationSessions, sessionState } from "@/features/admin/impersonation-service";
import { requireAdminPage } from "@/features/admin/viewer";
import { RevokeSessionButton } from "@/components/admin/revoke-session-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AccessSessionsPage({ searchParams }: { searchParams: Promise<{ page?: string; active?: string }> }) {
  const viewer = await requireAdminPage("user:impersonate");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const activeOnly = params.active === "1";
  const { items, total } = await listImpersonationSessions({ page, pageSize: PAGE_SIZE, activeOnly });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Access sessions</h1>
      <p className="mt-1 text-sm text-slate-500">Every &ldquo;view as user&rdquo; session — who, whom, why, and how it ended. Each one also has entries in the audit log.</p>

      <div className="mt-4 flex gap-2 text-xs">
        <Link href="/admin/access-sessions" className={`rounded-full px-3 py-1 font-medium ${!activeOnly ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
          All
        </Link>
        <Link href="/admin/access-sessions?active=1" className={`rounded-full px-3 py-1 font-medium ${activeOnly ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
          Active now
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Started</th>
              <th className="py-2 pr-4">Administrator</th>
              <th className="py-2 pr-4">Member</th>
              <th className="py-2 pr-4">Reason</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const state = sessionState(row, now);
              const mayEnd = state.active && (row.adminId === viewer.id || viewer.role === "SUPER_ADMIN");
              return (
                <tr key={row.id} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-500">{row.startedAt.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.admin.name ?? row.admin.email}</td>
                  <td className="py-2 pr-4">
                    <Link href={`/admin/users/${row.target.id}`} className="text-blue-600 hover:underline">
                      {row.target.name ?? row.target.email}
                    </Link>
                  </td>
                  <td className="max-w-xs py-2 pr-4 text-slate-600">{row.reason ?? <span className="text-slate-400">—</span>}</td>
                  <td className="py-2 pr-4">
                    <span className={state.active ? "font-medium text-amber-700" : "text-slate-500"}>{state.label}</span>
                    {row.endedAt && <div className="text-xs text-slate-400">{row.endedAt.toLocaleString()}</div>}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {mayEnd ? <RevokeSessionButton sessionId={row.id} /> : null}
                    <div className="mt-1">
                      <Link href={`/admin/audit-logs?session=${row.id}`} className="text-xs text-blue-600 hover:underline">
                        Actions
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-slate-500">No sessions yet.</p>}
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={`/admin/access-sessions?page=${page - 1}${activeOnly ? "&active=1" : ""}`} className="text-blue-600 hover:underline">← Newer</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/admin/access-sessions?page=${page + 1}${activeOnly ? "&active=1" : ""}`} className="text-blue-600 hover:underline">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
