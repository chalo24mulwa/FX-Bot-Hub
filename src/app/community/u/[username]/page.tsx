import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MessageSquare, Settings, Sparkles, ThumbsUp } from "lucide-react";
import { getViewerContext } from "@/features/community/viewer";
import { getCommunityProfile, getSidebarData, listCategories, listPosts, listRecentComments } from "@/features/community/queries";
import { formatAge } from "@/lib/calendar/timezone";
import { cn } from "@/lib/utils";
import { CommunityDisclaimer, CommunityShell } from "@/components/community/community-shell";
import { PostCard } from "@/components/community/post-card";
import { UserAvatar } from "@/components/community/user-avatar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getCommunityProfile(username);
  if (!profile) return {};
  return { title: `${profile.author.displayName} (@${profile.author.username}) — Community`, alternates: { canonical: `/community/u/${profile.author.username}` } };
}

const TABS = [
  { key: "posts", label: "Posts" },
  { key: "ideas", label: "Trading ideas" },
  { key: "comments", label: "Comments" },
] as const;

export default async function CommunityProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as (typeof TABS)[number]["key"]) : "posts";

  const ctx = await getViewerContext();
  const profile = await getCommunityProfile(username);
  if (!profile) notFound();

  const [categories, sidebar, posts, comments] = await Promise.all([
    listCategories(),
    getSidebarData(ctx.viewer),
    tab === "comments"
      ? Promise.resolve(null)
      : listPosts({ authorId: profile.userId, types: tab === "ideas" ? ["TRADING_IDEA", "SIGNAL", "CHART"] : undefined, sort: "latest", pageSize: 20 }, ctx.viewer),
    tab === "comments" ? listRecentComments(profile.userId, 20) : Promise.resolve(null),
  ]);
  const isOwn = ctx.viewer?.id === profile.userId;
  const now = new Date();

  const stat = (icon: React.ReactNode, value: number, label: string) => (
    <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-center ring-1 ring-slate-200/70">
      <div className="flex items-center justify-center gap-1.5 text-xl font-semibold tabular-nums text-slate-900">
        {icon}
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} title="Member profile" subtitle="Public Community activity only.">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-12px_rgba(2,6,23,0.6)]">
        <div className="h-20 bg-gradient-to-r from-violet-700 via-indigo-700 to-amber-500/80" aria-hidden="true" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <UserAvatar user={profile.author} size="lg" className="ring-4 ring-white" />
            {isOwn && (
              <Link href="/community/settings" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Settings className="h-4 w-4" aria-hidden="true" /> Edit profile
              </Link>
            )}
          </div>
          <h2 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-semibold text-slate-900">
            {profile.author.displayName}
            {profile.author.isStaff && <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Staff</span>}
          </h2>
          <p className="text-sm text-slate-500">
            @{profile.author.username} · <CalendarDays className="mb-0.5 inline h-3.5 w-3.5" aria-hidden="true" /> Joined {profile.joinedAt.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          {profile.bio && <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-[15px] text-slate-700">{profile.bio}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stat(null, profile.stats.posts, "Posts")}
            {stat(<Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />, profile.stats.ideas, "Trading ideas")}
            {stat(<MessageSquare className="h-4 w-4 text-sky-500" aria-hidden="true" />, profile.stats.comments, "Comments")}
            {stat(<ThumbsUp className="h-4 w-4 text-amber-500" aria-hidden="true" />, profile.stats.reputation, "Reputation")}
          </div>
          <p className="mt-2 text-xs text-slate-400">Reputation is the total number of likes this member&apos;s posts and comments have received.</p>
        </div>
      </section>

      <nav aria-label="Profile sections" className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/community/u/${profile.author.username}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors", tab === t.key ? "border-violet-400 bg-violet-500 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {posts && (posts.items.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-slate-400">Nothing here yet.</p> : <div className="space-y-4">{posts.items.map((p) => <PostCard key={p.id} post={p} ctx={ctx} />)}</div>)}

      {comments && (
        comments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-slate-400">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">
                  On <Link href={`/community/post/${c.post.id}#c-${c.id}`} className="font-medium text-violet-700 hover:underline">{c.post.title}</Link> · {formatAge(c.createdAt, now)} · {c.likeCount} like{c.likeCount === 1 ? "" : "s"}
                </p>
                <p className="mt-1 line-clamp-3 break-words text-[15px] text-slate-700">{c.preview}</p>
              </li>
            ))}
          </ul>
        )
      )}
      <CommunityDisclaimer />
    </CommunityShell>
  );
}
