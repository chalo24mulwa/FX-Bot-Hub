import Link from "next/link";
import Image from "next/image";
import { Pin, Star, Lock } from "lucide-react";
import type { CommunityPostType } from "@prisma/client";
import type { PostListItem } from "@/features/community/queries";
import type { ViewerContext } from "@/features/community/viewer";
import { POST_TYPE_LABEL } from "@/config/community";
import { formatAge } from "@/lib/calendar/timezone";
import { getPublicUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { TradeSetup, hasTradeSetup } from "./trade-setup";
import { PostActions } from "./post-actions";

export const TYPE_STYLE: Record<CommunityPostType, string> = {
  DISCUSSION: "bg-slate-100 text-slate-700",
  TRADING_IDEA: "bg-violet-100 text-violet-700",
  SIGNAL: "bg-amber-100 text-amber-800",
  QUESTION: "bg-sky-100 text-sky-700",
  CHART: "bg-emerald-100 text-emerald-700",
};

export function AuthorLine({ author, when, editedAt }: { author: PostListItem["author"]; when: Date; editedAt?: Date | null }) {
  const now = new Date();
  const name = (
    <span className="font-semibold text-slate-900">{author.displayName}</span>
  );
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {author.username ? (
        <Link href={`/community/u/${author.username}`} aria-label={`${author.displayName}'s profile`}>
          <UserAvatar user={author} size="sm" className="ring-slate-200" />
        </Link>
      ) : (
        <UserAvatar user={author} size="sm" className="ring-slate-200" />
      )}
      <div className="min-w-0 text-sm leading-tight">
        <div className="flex flex-wrap items-center gap-x-1.5">
          {author.username ? (
            <Link href={`/community/u/${author.username}`} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
          {author.username && <span className="text-slate-400">@{author.username}</span>}
          {author.isStaff && <span className="rounded bg-violet-600 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">Staff</span>}
        </div>
        <time dateTime={when.toISOString()} title={when.toUTCString()} className="text-xs text-slate-500">
          {formatAge(when, now)}
          {editedAt && " · edited"}
        </time>
      </div>
    </div>
  );
}

export function PostCard({ post, ctx }: { post: PostListItem; ctx: ViewerContext }) {
  const href = `/community/post/${post.id}`;
  const trade = hasTradeSetup(post) || (post.type !== "DISCUSSION" && post.type !== "QUESTION" && !!post.instrument);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-[0_8px_30px_-14px_rgba(2,6,23,0.55)] transition-shadow hover:shadow-[0_12px_36px_-12px_rgba(2,6,23,0.65)] motion-reduce:transition-none",
        post.isFeatured ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
      )}
    >
      <div className="space-y-3 p-4 sm:p-5">
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
            <Link href={`/community/c/${post.category.slug}`} className="rounded-full border border-slate-200 px-2 py-0.5 font-medium text-slate-600 hover:border-violet-300 hover:text-violet-700">
              {post.category.name}
            </Link>
          </div>
        </div>

        <h3 className="text-lg font-semibold leading-snug tracking-tight text-slate-900">
          <Link href={href} className="hover:text-violet-700">
            {post.title}
          </Link>
        </h3>

        {trade && <TradeSetup trade={post} compact />}

        <p className="line-clamp-3 break-words text-[15px] leading-relaxed text-slate-600">{post.preview}</p>

        {post.images.length > 0 && (
          <Link href={href} className="relative block aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <Image src={getPublicUrl(post.images[0])} alt={`Chart attached to “${post.title}”`} fill sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
            {post.images.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">+{post.images.length - 1}</span>
            )}
          </Link>
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
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 sm:px-4">
        <PostActions
          postId={post.id}
          likeCount={post.likeCount}
          liked={post.liked}
          bookmarked={post.bookmarked}
          commentCount={post.commentCount}
          viewCount={post.viewCount}
          commentsHref={`${href}#comments`}
          signedIn={!!ctx.viewer}
          canVote={ctx.caps.canVote}
          canBookmark={ctx.caps.canBookmark}
          isOwn={ctx.viewer?.id === post.author.id}
          blockedMessage={ctx.restrictionNotice}
          shareUrl={href}
          title={post.title}
        />
      </div>
    </article>
  );
}
