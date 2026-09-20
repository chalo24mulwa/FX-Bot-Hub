import Link from "next/link";
import type { CommunityContentStatus } from "@prisma/client";
import { adminListPosts } from "@/features/community/queries";
import { PostModerationControls } from "@/components/admin/community-admin";
import { Badge } from "@/components/ui/badge";
import { POST_TYPE_LABEL } from "@/config/community";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = ["ALL", "PUBLISHED", "HIDDEN", "REMOVED"] as const;
const STATUS_STYLE: Record<CommunityContentStatus, string> = {
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  HIDDEN: "border-amber-200 bg-amber-50 text-amber-700",
  REMOVED: "border-red-200 bg-red-50 text-red-700",
};

export default async function AdminCommunityPosts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const status = (STATUSES as readonly string[]).includes(params.status ?? "") && params.status !== "ALL" ? (params.status as CommunityContentStatus) : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const q = params.q?.trim().slice(0, 80) || undefined;
  const { items, total, pageSize } = await adminListPosts({ q, status, page });
  const href = (over: { status?: string; page?: number }) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    const s = over.status ?? params.status;
    if (s && s !== "ALL") u.set("status", s);
    if (over.page && over.page > 1) u.set("page", String(over.page));
    return `/admin/community/posts${u.toString() ? `?${u}` : ""}`;
  };

  return (
    <div>
      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search title or author…" aria-label="Search posts" className="h-9 w-72 rounded-md border border-slate-300 px-3 text-sm" />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white">Search</button>
        <div className="ml-auto flex gap-1.5">
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s })} className={cn("rounded-full px-3 py-1 text-xs font-medium", (status ?? "ALL") === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
              {s}
            </Link>
          ))}
        </div>
      </form>
      <p className="mb-2 text-sm text-slate-500">
        {total} post{total === 1 ? "" : "s"}
      </p>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.length === 0 && <p className="p-8 text-center text-slate-500">Nothing here.</p>}
        {items.map((p) => (
          <div key={p.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_STYLE[p.status]}>{p.status}</Badge>
              <Badge>{POST_TYPE_LABEL[p.type]}</Badge>
              <Badge>{p.category.name}</Badge>
              {p.isPinned && <Badge className="border-slate-300 bg-slate-900 text-white">Pinned</Badge>}
              {p.isFeatured && <Badge className="border-amber-300 bg-amber-100 text-amber-800">Featured</Badge>}
              {p.isLocked && <Badge>Locked</Badge>}
              {p.openReports > 0 && (
                <Badge className="border-red-300 bg-red-100 text-red-700">
                  {p.openReports} open report{p.openReports === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
            <Link href={`/community/post/${p.id}`} className="block font-medium text-slate-900 hover:underline">
              {p.title}
            </Link>
            <p className="text-xs text-slate-500">
              by {p.author.displayName}
              {p.author.username && (
                <>
                  {" "}
                  (
                  <Link href={`/admin/community/members?q=${p.author.username}`} className="text-blue-600 hover:underline">
                    @{p.author.username}
                  </Link>
                  )
                </>
              )}{" "}
              · {p.createdAt.toLocaleString()} · {p.likeCount} likes · {p.commentCount} comments
              {p.moderationNote && (
                <>
                  {" "}
                  · <span className="text-red-600">Note: {p.moderationNote}</span>
                </>
              )}
            </p>
            <PostModerationControls postId={p.id} status={p.status} isPinned={p.isPinned} isFeatured={p.isFeatured} isLocked={p.isLocked} />
          </div>
        ))}
      </div>

      {total > pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="text-blue-600 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-400">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          {page * pageSize < total ? (
            <Link href={href({ page: page + 1 })} className="text-blue-600 hover:underline">
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
