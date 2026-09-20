import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { ArrowLeft, EyeOff, Lock, Pin, ShieldCheck, Star } from "lucide-react";
import { getViewerContext } from "@/features/community/viewer";
import { getCommentTree, getPostDetail, getSidebarData, listCategories, type CommentNode } from "@/features/community/queries";
import { recordPostView } from "@/features/community/service";
import { POST_TYPE_LABEL } from "@/config/community";
import { formatAge } from "@/lib/calendar/timezone";
import { toPreview } from "@/lib/community/content";
import { getPublicUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";
import { CommunityDisclaimer, CommunityShell } from "@/components/community/community-shell";
import { AuthorLine, TYPE_STYLE } from "@/components/community/post-card";
import { CommentThread, type ThreadComment } from "@/components/community/comment-thread";
import { FollowButton, PostOwnerMenu } from "@/components/community/post-detail-controls";
import { PostActions } from "@/components/community/post-actions";
import { ReportButton } from "@/components/community/report-button";
import { RichText } from "@/components/community/rich-text";
import { TradeSetup, hasTradeSetup } from "@/components/community/trade-setup";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getViewerContext();
  const post = await getPostDetail(id, ctx.viewer);
  if (!post) return {};
  return {
    title: `${post.title} — Community`,
    description: toPreview(post.content, 160),
    alternates: { canonical: `/community/post/${id}` },
    robots: post.status === "PUBLISHED" ? undefined : { index: false },
  };
}

function serialize(nodes: CommentNode[], now: Date): ThreadComment[] {
  return nodes.map((n) => ({
    id: n.id,
    author: { id: n.author.id, username: n.author.username, displayName: n.author.displayName, avatarUrl: n.author.avatarUrl, isStaff: n.author.isStaff },
    content: n.content,
    status: n.status,
    depth: n.depth,
    likeCount: n.likeCount,
    liked: n.liked,
    ageLabel: formatAge(n.createdAt, now),
    isoDate: n.createdAt.toISOString(),
    edited: !!n.editedAt,
    isOwn: n.isOwn,
    replies: serialize(n.replies, now),
  }));
}

export default async function CommunityPostPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getViewerContext();
  const post = await getPostDetail(id, ctx.viewer);
  if (!post) notFound();

  // One view per viewer per 30 minutes; the author's own visits and non-public states don't count.
  if (post.status === "PUBLISHED" && !post.isAuthor) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
    recordPostView(post.id, ctx.viewer?.id ?? createHash("sha256").update(ip).digest("hex").slice(0, 16));
  }

  const [comments, categories, sidebar] = await Promise.all([getCommentTree(post.id, ctx.viewer), listCategories(), getSidebarData(ctx.viewer)]);
  const now = new Date();
  const threadCtx = {
    postId: post.id,
    signedIn: !!ctx.viewer,
    isStaff: ctx.isStaff,
    canComment: ctx.caps.canComment && post.status === "PUBLISHED",
    canVote: ctx.caps.canVote,
    canReport: ctx.caps.canReport,
    blockedMessage: ctx.restrictionNotice,
    isLocked: post.isLocked,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    datePublished: post.createdAt.toISOString(),
    author: { "@type": "Person", name: post.author.displayName },
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.commentCount },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: post.likeCount },
    ],
  };

  return (
    <CommunityShell ctx={ctx} categories={categories} sidebar={sidebar} activeSlugs={[post.category.slug]}>
      {post.status === "PUBLISHED" && (
        // Member text can never appear here (only counts/ids/name), and `<` is escaped regardless.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}

      <Link href={`/community/c/${post.category.slug}`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {post.category.name}
      </Link>

      {post.status !== "PUBLISHED" && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>This post is {post.status === "HIDDEN" ? "hidden" : "removed"}</strong> and only you{ctx.isStaff && !post.isAuthor ? " (as staff)" : ""} and moderators can see it.
            {post.moderationNote ? ` Reason: ${post.moderationNote}.` : ""}
          </p>
        </div>
      )}

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-12px_rgba(2,6,23,0.6)]">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <AuthorLine author={post.author} when={post.createdAt} editedAt={post.editedAt} />
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {post.isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 font-medium text-white">
                  <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
                </span>
              )}
              {post.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 font-medium text-slate-900">
                  <Star className="h-3 w-3" aria-hidden="true" /> Featured
                </span>
              )}
              {post.isLocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600">
                  <Lock className="h-3 w-3" aria-hidden="true" /> Locked
                </span>
              )}
              <span className={cn("rounded-full px-2 py-0.5 font-medium", TYPE_STYLE[post.type])}>{POST_TYPE_LABEL[post.type]}</span>
            </div>
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">{post.title}</h1>

          {(hasTradeSetup(post) || (post.type !== "DISCUSSION" && post.type !== "QUESTION" && !!post.instrument)) && <TradeSetup trade={post} />}
          {post.instrument && !hasTradeSetup(post) && (post.type === "DISCUSSION" || post.type === "QUESTION") && (
            <Link href={`/community?instrument=${encodeURIComponent(post.instrument)}`} className="inline-block rounded-md bg-slate-100 px-2 py-1 font-mono text-sm font-semibold text-slate-700 hover:bg-violet-100">
              {post.instrument}
            </Link>
          )}

          <RichText text={post.content} />

          {post.images.length > 0 && (
            <div className={cn("grid gap-3", post.images.length > 1 && "sm:grid-cols-2")}>
              {post.images.map((key, i) => (
                <a
                  key={key}
                  href={getPublicUrl(key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("relative block overflow-hidden rounded-xl border border-slate-200 bg-slate-100", post.images.length === 1 ? "aspect-[16/10]" : "aspect-[16/10]")}
                  aria-label={`Open chart ${i + 1} full size`}
                >
                  <Image src={getPublicUrl(key)} alt={`Chart ${i + 1} attached to “${post.title}”`} fill sizes="(min-width: 1024px) 640px, 100vw" className="object-contain" />
                </a>
              ))}
            </div>
          )}

          {post.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <li key={t}>
                  <Link href={`/community?tag=${encodeURIComponent(t)}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-violet-100 hover:text-violet-700">
                    #{t}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {(post.type === "TRADING_IDEA" || post.type === "SIGNAL" || post.type === "CHART") && (
            <p className="text-xs text-slate-400">User-generated content — not an official FX Bot Hub recommendation.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2 sm:px-5">
          {post.status === "PUBLISHED" ? (
            <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
              <PostActions
                postId={post.id}
                likeCount={post.likeCount}
                liked={post.liked}
                bookmarked={post.bookmarked}
                commentCount={post.commentCount}
                viewCount={post.viewCount}
                commentsHref="#comments"
                signedIn={!!ctx.viewer}
                canVote={ctx.caps.canVote}
                canBookmark={ctx.caps.canBookmark}
                isOwn={post.isAuthor}
                blockedMessage={ctx.restrictionNotice}
                shareUrl={`/community/post/${post.id}`}
                title={post.title}
              />
            </div>
          ) : (
            <span className="flex-1" />
          )}
          {post.status === "PUBLISHED" && (
            <FollowButton postId={post.id} following={post.following} signedIn={!!ctx.viewer} canFollow={ctx.caps.canBookmark} blockedMessage={ctx.restrictionNotice} />
          )}
          {post.isAuthor && post.status === "PUBLISHED" && <PostOwnerMenu postId={post.id} canEdit={ctx.caps.canPost} />}
          {!post.isAuthor && post.status === "PUBLISHED" && (
            <ReportButton target={{ postId: post.id }} signedIn={!!ctx.viewer} canReport={ctx.caps.canReport} blockedMessage={ctx.restrictionNotice} />
          )}
          {ctx.isStaff && (
            <Link href={`/admin/community/posts?q=${encodeURIComponent(post.title.slice(0, 40))}`} className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Moderate
            </Link>
          )}
        </div>
      </article>

      {post.status === "PUBLISHED" || ctx.isStaff ? <CommentThread comments={serialize(comments, now)} ctx={threadCtx} /> : null}

      <CommunityDisclaimer className="pt-1" />
    </CommunityShell>
  );
}
