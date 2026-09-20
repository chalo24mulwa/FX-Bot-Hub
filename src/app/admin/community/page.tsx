import Link from "next/link";
import { adminListReports, adminOverviewCounts } from "@/features/community/queries";
import { Badge } from "@/components/ui/badge";
import { formatAge } from "@/lib/calendar/timezone";

export const dynamic = "force-dynamic";

export default async function AdminCommunityOverview() {
  const [counts, reports] = await Promise.all([adminOverviewCounts(), adminListReports({ status: "OPEN", page: 1, pageSize: 5 })]);
  const now = new Date();
  const cards = [
    { label: "Published posts", value: counts.posts, href: "/admin/community/posts", alert: false },
    { label: "Comments", value: counts.comments, href: "/admin/community/posts", alert: false },
    { label: "Open reports", value: counts.openReports, href: "/admin/community/reports", alert: counts.openReports > 0 },
    { label: "Hidden posts", value: counts.hidden, href: "/admin/community/posts?status=HIDDEN", alert: false },
    { label: "Removed posts", value: counts.removed, href: "/admin/community/posts?status=REMOVED", alert: false },
    { label: "Active restrictions", value: counts.activeRestrictions, href: "/admin/community/members", alert: false },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`rounded-lg border p-4 transition-colors hover:bg-slate-50 ${c.alert ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">{c.value}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Oldest open reports</h2>
          <Link href="/admin/community/reports" className="text-sm text-blue-600 hover:underline">
            Open the queue →
          </Link>
        </div>
        {reports.items.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing waiting for review.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {reports.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <Badge className="mr-2">{r.reason.replace("_", " ")}</Badge>
                  {r.target?.title ?? r.target?.preview ?? "(deleted content)"}
                </span>
                <span className="text-xs text-slate-400">{formatAge(r.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
