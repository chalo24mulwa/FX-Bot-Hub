import Link from "next/link";
import { Inbox, X } from "lucide-react";
import { FEED_SECTIONS, FEED_SORTS, PAGE_SIZE } from "@/config/community";
import type { PostListItem } from "@/features/community/queries";
import type { ViewerContext } from "@/features/community/viewer";
import { feedHref, type FeedParams } from "@/lib/community/urls";
import { cn } from "@/lib/utils";
import { CommunityDisclaimer } from "./community-shell";
import { PostCard } from "./post-card";

export function activeSectionKey(params: FeedParams): string {
  if (params.type === "TRADING_IDEA") return "ideas";
  if (params.type === "SIGNAL") return "signals";
  if (params.type === "QUESTION") return "questions";
  const cats = [...(params.category ?? [])].sort().join(",");
  const match = FEED_SECTIONS.find((s) => {
    const u = new URL(s.href, "http://x");
    return u.searchParams.getAll("category").sort().join(",") === cats && !!cats;
  });
  return match?.key ?? (params.category?.length || params.type ? "" : "all");
}

/** Sort tabs + section chips + list + pagination — shared by /community, category pages and Saved. */
export function FeedView({
  base,
  params,
  items,
  total,
  ctx,
  lockedCategory = false,
  emptyMessage = "No posts here yet. Be the first to start a conversation.",
  showSections = true,
}: {
  base: string;
  params: FeedParams & { sort: string };
  items: PostListItem[];
  total: number;
  ctx: ViewerContext;
  lockedCategory?: boolean;
  emptyMessage?: string;
  showSections?: boolean;
}) {
  const page = params.page ?? 1;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const section = activeSectionKey(params);
  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none",
      active ? "border-violet-400 bg-violet-500 text-white shadow" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
    );

  const activeFilters: { label: string; href: string }[] = [
    ...(params.q ? [{ label: `“${params.q}”`, href: feedHref(base, params, { q: undefined }) }] : []),
    ...(params.tag ? [{ label: `#${params.tag}`, href: feedHref(base, params, { tag: undefined }) }] : []),
    ...(params.instrument ? [{ label: params.instrument, href: feedHref(base, params, { instrument: undefined }) }] : []),
  ];

  return (
    <>
      {showSections && (
        <nav aria-label="Community sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {FEED_SECTIONS.map((s) => (
            <Link key={s.key} href={s.href} className={chip(section === s.key)} aria-current={section === s.key ? "page" : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0e1530]/80 px-3 py-2">
        <div role="tablist" aria-label="Sort posts" className="flex flex-wrap gap-1">
          {FEED_SORTS.map((s) => (
            <Link
              key={s.value}
              role="tab"
              aria-selected={params.sort === s.value}
              href={feedHref(base, params, { sort: s.value })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none",
                params.sort === s.value ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          <span className="font-semibold text-white">{total}</span> post{total === 1 ? "" : "s"}
        </span>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">Filtered by</span>
          {activeFilters.map((f) => (
            <Link key={f.label} href={f.href} aria-label={`Remove filter ${f.label}`} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-red-500/30">
              {f.label} <X className="h-3 w-3" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
          <Inbox className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
          <p className="mt-3 text-base font-medium text-slate-200">Nothing to show</p>
          <p className="mt-1 text-sm text-slate-400">{emptyMessage}</p>
          {!lockedCategory && (params.q || params.tag || params.instrument || params.type || params.category) && (
            <Link href="/community" className="mt-4 inline-block text-sm font-medium text-violet-300 hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((post) => (
            <PostCard key={post.id} post={post} ctx={ctx} />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between pt-1 text-sm">
          {page > 1 ? (
            <Link href={feedHref(base, params, { page: page - 1 })} className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-medium text-slate-200 hover:bg-white/20">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-400">
            Page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={feedHref(base, params, { page: page + 1 })} className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-medium text-slate-200 hover:bg-white/20">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <CommunityDisclaimer className="pt-2 !text-slate-500" />
    </>
  );
}
