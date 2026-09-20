"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Eye, Heart, MessageSquare, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleBookmarkAction, togglePostVoteAction } from "@/features/community/actions";

// Like / comments / views / save / share for one post. Optimistic: the UI
// flips immediately and rolls back (with the server's message) if the action
// is refused — e.g. a restricted member, or liking their own post.

export function PostActions({
  postId,
  likeCount,
  liked,
  bookmarked,
  commentCount,
  viewCount,
  commentsHref,
  signedIn,
  canVote,
  canBookmark,
  isOwn,
  blockedMessage,
  shareUrl,
  title,
}: {
  postId: string;
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
  commentCount: number;
  viewCount: number;
  commentsHref: string;
  signedIn: boolean;
  canVote: boolean;
  canBookmark: boolean;
  isOwn: boolean;
  blockedMessage: string | null;
  shareUrl: string;
  title: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [likes, setLikes] = useState({ liked, count: likeCount });
  const [saved, setSaved] = useState(bookmarked);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function needSignIn() {
    router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((m) => (m === message ? null : m)), 4000);
  }

  function like() {
    if (!signedIn) return needSignIn();
    if (isOwn) return flash("You can't like your own post.");
    if (!canVote) return flash(blockedMessage ?? "You can't like posts right now.");
    const previous = likes;
    setLikes({ liked: !previous.liked, count: Math.max(0, previous.count + (previous.liked ? -1 : 1)) });
    startTransition(async () => {
      const res = await togglePostVoteAction(postId);
      if (res.ok) setLikes({ liked: res.liked, count: res.likeCount });
      else {
        setLikes(previous);
        flash(res.error);
      }
    });
  }

  function save() {
    if (!signedIn) return needSignIn();
    if (!canBookmark) return flash(blockedMessage ?? "You can't save posts right now.");
    const previous = saved;
    setSaved(!previous);
    startTransition(async () => {
      const res = await toggleBookmarkAction(postId);
      if (res.ok) setSaved(res.bookmarked);
      else {
        setSaved(previous);
        flash(res.error);
      }
    });
  }

  async function share() {
    const url = shareUrl.startsWith("http") ? shareUrl : `${window.location.origin}${shareUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      // User dismissed the share sheet, or the clipboard is unavailable — nothing to report.
    }
  }

  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none";

  return (
    <div className="flex flex-wrap items-center gap-1 text-slate-500">
      <button
        type="button"
        onClick={like}
        aria-pressed={likes.liked}
        aria-label={likes.liked ? "Remove like" : "Like this post"}
        className={cn(base, likes.liked ? "bg-rose-50 text-rose-600" : "hover:bg-slate-100 hover:text-slate-800")}
      >
        <Heart className={cn("h-4 w-4", likes.liked && "fill-current")} aria-hidden="true" />
        <span className="tabular-nums">{likes.count}</span>
      </button>
      <Link href={commentsHref} className={cn(base, "hover:bg-slate-100 hover:text-slate-800")} aria-label={`${commentCount} comments`}>
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        <span className="tabular-nums">{commentCount}</span>
        <span className="hidden sm:inline">{commentCount === 1 ? "comment" : "comments"}</span>
      </Link>
      <span className={cn(base, "cursor-default")} title="Views">
        <Eye className="h-4 w-4" aria-hidden="true" />
        <span className="tabular-nums">{viewCount}</span>
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={save}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save this post"}
          className={cn(base, saved ? "bg-amber-50 text-amber-600" : "hover:bg-slate-100 hover:text-slate-800")}
        >
          {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
        </button>
        <button type="button" onClick={share} aria-label="Share this post" className={cn(base, "hover:bg-slate-100 hover:text-slate-800")}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
      {notice && (
        <p role="status" className="w-full text-xs text-amber-700">
          {notice}
        </p>
      )}
    </div>
  );
}
