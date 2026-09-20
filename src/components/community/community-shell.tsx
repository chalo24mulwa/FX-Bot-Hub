import Link from "next/link";
import { Bookmark, Flame, Hash, Plus, Search, ShieldAlert, Star, ThumbsUp, Users } from "lucide-react";
import { COMMUNITY_DISCLAIMER, FEED_SECTIONS } from "@/config/community";
import type { SidebarData } from "@/features/community/queries";
import type { ViewerContext } from "@/features/community/viewer";
import { cn } from "@/lib/utils";
import { MobileCollapsible } from "./mobile-collapsible";
import { TradeSetup, hasTradeSetup } from "./trade-setup";
import { UserAvatar } from "./user-avatar";

// The Community page frame: navy "trading terminal" band (same family as the
// calendar page, its own grid texture), header with search + Create Post,
// then [categories | feed | trending rail]. Below `lg` the two sidebars
// collapse into toggles (MobileCollapsible) so the feed comes first.

export function CommunityDisclaimer({ className }: { className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-slate-500", className)}>{COMMUNITY_DISCLAIMER}</p>;
}

export function RestrictionBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function CreatePostButton({ ctx }: { ctx: ViewerContext }) {
  const base =
    "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-orange-400 motion-reduce:transition-none";
  if (!ctx.viewer) {
    return (
      <Link href="/auth/sign-in?callbackUrl=/community/new" className={base}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Create Post
      </Link>
    );
  }
  if (!ctx.caps.canPost) {
    return (
      <span title={ctx.restrictionNotice ?? undefined} aria-disabled="true" className={cn(base, "cursor-not-allowed opacity-50")}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Create Post
      </span>
    );
  }
  return (
    <Link href="/community/new" className={base}>
      <Plus className="h-4 w-4" aria-hidden="true" /> Create Post
    </Link>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0e1530]/85 p-4 shadow-[0_10px_40px_-12px_rgba(2,6,23,0.7)] backdrop-blur">
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LeftNav({
  categories,
  activeSlugs = [],
  activeSection,
  signedIn,
}: {
  categories: { id: string; slug: string; name: string; postCount: number }[];
  activeSlugs?: string[];
  activeSection?: string;
  signedIn: boolean;
}) {
  const link = (active: boolean) =>
    cn(
      "flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors motion-reduce:transition-none",
      active ? "bg-violet-500/20 font-medium text-white shadow-[inset_2px_0_0_0_#a78bfa]" : "text-slate-300 hover:bg-white/5 hover:text-white"
    );
  return (
    <div className="space-y-4">
      <Panel title="Browse">
        <ul className="space-y-0.5">
          {FEED_SECTIONS.map((s) => (
            <li key={s.key}>
              <Link href={s.href} className={link(activeSection === s.key)}>
                {s.label}
              </Link>
            </li>
          ))}
          {signedIn && (
            <li>
              <Link href="/community/saved" className={link(activeSection === "saved")}>
                <span className="inline-flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> Saved posts
                </span>
              </Link>
            </li>
          )}
        </ul>
      </Panel>
      <Panel title="Communities">
        <ul className="space-y-0.5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/community/c/${c.slug}`} className={link(activeSlugs.includes(c.slug))}>
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{c.postCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function RightRail({ data }: { data: SidebarData }) {
  const mini = (p: SidebarData["trending"][number]) => (
    <li key={p.id}>
      <Link href={`/community/post/${p.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-white/5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-100">{p.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {p.likeCount} likes · {p.commentCount} comments
        </p>
      </Link>
    </li>
  );
  return (
    <div className="space-y-4">
      {data.featured.length > 0 && (
        <Panel title="Featured ideas" icon={<Star className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />}>
          <ul className="space-y-3">
            {data.featured.map((p) => (
              <li key={p.id}>
                <Link href={`/community/post/${p.id}`} className="block space-y-1.5 rounded-lg p-1 hover:bg-white/5">
                  <p className="line-clamp-2 text-sm font-medium text-slate-100">{p.title}</p>
                </Link>
                {hasTradeSetup(p) && <TradeSetup trade={p} compact />}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Trending discussions" icon={<Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />}>
        {data.trending.length === 0 ? <p className="text-sm text-slate-500">Nothing trending yet — start a conversation.</p> : <ul className="space-y-0.5">{data.trending.map(mini)}</ul>}
      </Panel>
      {data.popular.length > 0 && (
        <Panel title="Popular this month" icon={<ThumbsUp className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />}>
          <ul className="space-y-0.5">{data.popular.map(mini)}</ul>
        </Panel>
      )}
      {data.hotTopics.length > 0 && (
        <Panel title="Hot topics" icon={<Hash className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />}>
          <div className="flex flex-wrap gap-1.5">
            {data.hotTopics.map((t) => (
              <Link key={t.label} href={t.href} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 hover:border-violet-400/60 hover:bg-white/10">
                {t.label} <span className="text-slate-500">{t.count}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}
      {data.activeMembers.length > 0 && (
        <Panel title="Active members" icon={<Users className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />}>
          <ul className="space-y-1">
            {data.activeMembers.map(({ author }) => (
              <li key={author.id}>
                <Link href={author.username ? `/community/u/${author.username}` : "/community"} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <UserAvatar user={author} size="xs" className="ring-white/20" />
                  <span className="truncate text-sm text-slate-100">{author.displayName}</span>
                  {author.username && <span className="truncate text-xs text-slate-500">@{author.username}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export function CommunityShell({
  ctx,
  categories,
  sidebar,
  activeSlugs,
  activeSection,
  title = "Community",
  subtitle = "Trading ideas, questions and market talk from FX Bot Hub members.",
  query,
  children,
}: {
  ctx: ViewerContext;
  categories: { id: string; slug: string; name: string; postCount: number }[];
  sidebar: SidebarData;
  activeSlugs?: string[];
  activeSection?: string;
  title?: string;
  subtitle?: string;
  query?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className="w-full min-w-0 flex-1 bg-[#070c1d]"
      style={{
        backgroundImage:
          "radial-gradient(55% 40% at 8% 0%, rgba(139,92,246,0.20), transparent 70%), radial-gradient(45% 35% at 96% 0%, rgba(245,158,11,0.12), transparent 70%), linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(180deg, #080e24 0%, #0a1030 60%, #0c1236 100%)",
        backgroundSize: "auto, auto, 36px 36px, 36px 36px, auto",
      }}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <form action="/community/search" role="search" className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <label htmlFor="community-search" className="sr-only">
                Search the Community
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                id="community-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search posts, people, pairs, tags…"
                maxLength={80}
                className="w-full rounded-full border border-white/15 bg-white/10 py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </form>
            <CreatePostButton ctx={ctx} />
          </div>
        </header>

        {ctx.restrictionNotice && <div className="mt-4"><RestrictionBanner message={ctx.restrictionNotice} /></div>}

        <div className="mt-5 grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_300px] lg:gap-6">
          <MobileCollapsible title="Browse communities" summary={`${categories.length} categories`} className="lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto">
            <LeftNav categories={categories} activeSlugs={activeSlugs} activeSection={activeSection} signedIn={!!ctx.viewer} />
          </MobileCollapsible>

          <div className="min-w-0 space-y-4">{children}</div>

          <MobileCollapsible title="Trending & featured" summary="topics, members" className="lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto">
            <RightRail data={sidebar} />
          </MobileCollapsible>
        </div>
      </div>
    </main>
  );
}
