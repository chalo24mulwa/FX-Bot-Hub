import Link from "next/link";
import { adminListReports } from "@/features/community/queries";
import { ReportActions } from "@/components/admin/community-admin";
import { Badge } from "@/components/ui/badge";
import { REPORT_REASONS } from "@/config/community";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = ["OPEN", "RESOLVED", "DISMISSED"] as const;
const REASON_LABEL: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

export default async function AdminCommunityReports({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const params = await searchParams;
  const status = (TABS as readonly string[]).includes(params.status ?? "") ? (params.status as (typeof TABS)[number]) : "OPEN";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { items, total, pageSize } = await adminListReports({ status, page });

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/community/reports?status=${t}`} className={cn("rounded-full px-3 py-1 text-xs font-medium", status === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            {t}
          </Link>
        ))}
      </div>
      <p className="mb-2 text-sm text-slate-500">
        {total} {status.toLowerCase()} report{total === 1 ? "" : "s"}
        {status === "OPEN" && " (oldest first)"}
      </p>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.length === 0 && <p className="p-8 text-center text-slate-500">{status === "OPEN" ? "The queue is clear." : "Nothing here."}</p>}
        {items.map((r) => (
          <article key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-red-200 bg-red-50 text-red-700">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
              <Badge>{r.target?.kind ?? "content"}</Badge>
              {r.target && r.target.status !== "PUBLISHED" && <Badge className="border-amber-200 bg-amber-50 text-amber-700">{r.target.status}</Badge>}
              <span className="text-xs text-slate-400">
                Reported {r.createdAt.toLocaleString()} by {r.reporter.displayName}
                {r.reporter.username && ` (@${r.reporter.username})`}
              </span>
            </div>
            {r.target ? (
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                {r.target.title && (
                  <Link href={`/community/post/${r.target.postId}`} className="block font-medium text-slate-900 hover:underline">
                    {r.target.title}
                  </Link>
                )}
                <p className="line-clamp-3 break-words text-slate-600">{r.target.preview}</p>
                <p className="mt-1 text-xs text-slate-500">
                  by {r.target.author.displayName}
                  {r.target.kind === "comment" && (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`/community/post/${r.target.postId}#c-${r.target.id}`} className="text-blue-600 hover:underline">
                        view in thread
                      </Link>
                    </>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">The reported content no longer exists.</p>
            )}
            {r.details && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">Reporter says:</span> {r.details}
              </p>
            )}
            {r.status !== "OPEN" ? (
              <p className="text-xs text-slate-500">
                {r.status}
                {r.resolutionNote && ` — ${r.resolutionNote}`}
              </p>
            ) : (
              <ReportActions reportId={r.id} target={r.target ? { kind: r.target.kind, id: r.target.id, status: r.target.status } : null} authorUsername={r.target?.author.username ?? null} />
            )}
          </article>
        ))}
      </div>

      {total > pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/admin/community/reports?status=${status}&page=${page - 1}`} className="text-blue-600 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {page * pageSize < total ? (
            <Link href={`/admin/community/reports?status=${status}&page=${page + 1}`} className="text-blue-600 hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
