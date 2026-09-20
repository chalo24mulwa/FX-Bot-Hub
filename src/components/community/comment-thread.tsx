"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Heart, MessageSquare, Pencil, Trash2, ShieldX, Undo2 } from "lucide-react";
import { LIMITS } from "@/config/community";
import { cn } from "@/lib/utils";
import { createCommentAction, deleteCommentAction, toggleCommentVoteAction, updateCommentAction } from "@/features/community/actions";
import { moderateCommentAction } from "@/features/community/moderation-actions";
import { RichText } from "./rich-text";
import { ReportButton } from "./report-button";
import { UserAvatar } from "./user-avatar";

// Threaded discussion. The server sends the whole tree (already visibility-
// filtered) with pre-formatted ages, so nothing here depends on the clock.
// Mobile: indentation stops growing after depth 3 (a thin rail keeps the
// structure readable) and any branch can be collapsed.

export interface ThreadComment {
  id: string;
  author: { id: string; username: string | null; displayName: string; avatarUrl: string | null; isStaff: boolean };
  content: string;
  status: "PUBLISHED" | "HIDDEN" | "REMOVED";
  depth: number;
  likeCount: number;
  liked: boolean;
  ageLabel: string;
  isoDate: string;
  edited: boolean;
  isOwn: boolean;
  replies: ThreadComment[];
}

export interface ThreadContext {
  postId: string;
  signedIn: boolean;
  isStaff: boolean;
  canComment: boolean;
  canVote: boolean;
  canReport: boolean;
  /** Restriction message (or lock notice) shown in place of the form. */
  blockedMessage: string | null;
  isLocked: boolean;
}

function countAll(nodes: ThreadComment[]): number {
  return nodes.reduce((n, c) => n + 1 + countAll(c.replies), 0);
}

function CommentForm({
  ctx,
  parentId,
  initial = "",
  commentId,
  autoFocus,
  onDone,
  submitLabel = "Post comment",
  placeholder = "Add to the discussion…",
}: {
  ctx: ThreadContext;
  parentId?: string;
  initial?: string;
  commentId?: string;
  autoFocus?: boolean;
  onDone?: () => void;
  submitLabel?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = commentId
        ? await updateCommentAction(commentId, text)
        : await createCommentAction({ postId: ctx.postId, parentId: parentId ?? null, content: text });
      if (res.ok) {
        setText("");
        onDone?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={`cf-${commentId ?? parentId ?? "top"}`}>
        {commentId ? "Edit comment" : parentId ? "Write a reply" : "Write a comment"}
      </label>
      <textarea
        id={`cf-${commentId ?? parentId ?? "top"}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus={autoFocus}
        rows={parentId || commentId ? 3 : 4}
        maxLength={LIMITS.COMMENT_MAX}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {text.length}/{LIMITS.COMMENT_MAX} · **bold**, *italic*, `code`, @mentions
        </span>
        <div className="flex gap-2">
          {onDone && (
            <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || text.trim().length === 0}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {pending ? "Posting…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment, ctx }: { comment: ThreadComment; ctx: ThreadContext }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<"view" | "reply" | "edit">("view");
  const [collapsed, setCollapsed] = useState(false);
  const [likes, setLikes] = useState({ liked: comment.liked, count: comment.likeCount });
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const removed = comment.status !== "PUBLISHED";
  const replyCount = countAll(comment.replies);
  const signIn = () => router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);

  function like() {
    if (!ctx.signedIn) return signIn();
    if (comment.isOwn) return setNotice("You can't like your own comment.");
    if (!ctx.canVote) return setNotice(ctx.blockedMessage ?? "You can't like comments right now.");
    const before = likes;
    setLikes({ liked: !before.liked, count: Math.max(0, before.count + (before.liked ? -1 : 1)) });
    startTransition(async () => {
      const res = await toggleCommentVoteAction(comment.id);
      if (res.ok) setLikes({ liked: res.liked, count: res.likeCount });
      else {
        setLikes(before);
        setNotice(res.error);
      }
    });
  }

  function remove() {
    if (!window.confirm("Delete this comment?")) return;
    startTransition(async () => {
      const res = await deleteCommentAction(comment.id);
      if (res.ok) router.refresh();
      else setNotice(res.error);
    });
  }

  function moderate(status: "REMOVED" | "PUBLISHED") {
    const note = status === "REMOVED" ? window.prompt("Reason for removing this comment (shown to the author):") : "";
    if (status === "REMOVED" && !note) return;
    startTransition(async () => {
      const res = await moderateCommentAction(comment.id, status, note ?? undefined);
      if (res.ok) router.refresh();
      else setNotice(res.error);
    });
  }

  const linkBtn = "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800";

  return (
    <li id={`c-${comment.id}`} className="scroll-mt-24">
      <div className="flex gap-2.5">
        <div className="flex flex-col items-center">
          {comment.author.username ? (
            <Link href={`/community/u/${comment.author.username}`}>
              <UserAvatar user={comment.author} size="xs" className="ring-slate-200" />
            </Link>
          ) : (
            <UserAvatar user={comment.author} size="xs" className="ring-slate-200" />
          )}
          {replyCount > 0 && !collapsed && (
            <button type="button" aria-label="Collapse thread" onClick={() => setCollapsed(true)} className="group mt-1 flex-1 px-2">
              <span className="block h-full w-px bg-slate-200 transition-colors group-hover:bg-violet-400" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 pb-3">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            {comment.author.username ? (
              <Link href={`/community/u/${comment.author.username}`} className="font-semibold text-slate-900 hover:underline">
                {comment.author.displayName}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900">{comment.author.displayName}</span>
            )}
            {comment.author.isStaff && <span className="rounded bg-violet-600 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">Staff</span>}
            <time dateTime={comment.isoDate} className="text-xs text-slate-500">
              {comment.ageLabel}
              {comment.edited && " · edited"}
            </time>
            {removed && ctx.isStaff && <span className="rounded bg-red-100 px-1.5 py-px text-[10px] font-bold uppercase text-red-700">{comment.status}</span>}
          </div>

          {collapsed ? (
            <button type="button" onClick={() => setCollapsed(false)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> Show {replyCount + 1} comment{replyCount === 0 ? "" : "s"}
            </button>
          ) : (
            <>
              {mode === "edit" ? (
                <div className="mt-2">
                  <CommentForm ctx={ctx} commentId={comment.id} initial={comment.content} autoFocus submitLabel="Save" onDone={() => setMode("view")} />
                </div>
              ) : removed && !ctx.isStaff ? (
                <p className="mt-1 text-sm italic text-slate-400">[comment removed]</p>
              ) : (
                <RichText text={comment.content} className={cn("mt-1 space-y-2 text-[15px] leading-relaxed text-slate-800", removed && "opacity-60")} />
              )}

              {!removed && mode !== "edit" && (
                <div className="-ml-2 mt-1 flex flex-wrap items-center">
                  <button type="button" onClick={like} aria-pressed={likes.liked} aria-label={likes.liked ? "Remove like" : "Like comment"} className={cn(linkBtn, likes.liked && "text-rose-600")}>
                    <Heart className={cn("h-3.5 w-3.5", likes.liked && "fill-current")} aria-hidden="true" />
                    <span className="tabular-nums">{likes.count}</span>
                  </button>
                  {ctx.canComment && !ctx.isLocked && (
                    <button type="button" onClick={() => setMode(mode === "reply" ? "view" : "reply")} className={linkBtn}>
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Reply
                    </button>
                  )}
                  {comment.isOwn && ctx.canComment && (
                    <button type="button" onClick={() => setMode("edit")} className={linkBtn}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                    </button>
                  )}
                  {comment.isOwn && (
                    <button type="button" onClick={remove} className={cn(linkBtn, "hover:text-red-600")}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                    </button>
                  )}
                  {!comment.isOwn && <ReportButton target={{ commentId: comment.id }} signedIn={ctx.signedIn} canReport={ctx.canReport} blockedMessage={ctx.blockedMessage} />}
                  {ctx.isStaff && !comment.isOwn && (
                    <button type="button" onClick={() => moderate("REMOVED")} className={cn(linkBtn, "text-violet-600 hover:text-red-600")}>
                      <ShieldX className="h-3.5 w-3.5" aria-hidden="true" /> Mod remove
                    </button>
                  )}
                </div>
              )}
              {removed && ctx.isStaff && (
                <button type="button" onClick={() => moderate("PUBLISHED")} className={cn(linkBtn, "mt-1 -ml-2 text-violet-600")}>
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Restore
                </button>
              )}
              {notice && (
                <p role="status" className="text-xs text-amber-700">
                  {notice}
                </p>
              )}

              {mode === "reply" && (
                <div className="mt-2">
                  <CommentForm ctx={ctx} parentId={comment.id} autoFocus submitLabel="Reply" placeholder={`Reply to ${comment.author.displayName}…`} onDone={() => setMode("view")} />
                </div>
              )}

              {comment.replies.length > 0 && (
                <ul className={cn("mt-3 space-y-0", comment.depth < 3 ? "" : "-ml-6 sm:ml-0")}>
                  {comment.replies.map((r) => (
                    <CommentItem key={r.id} comment={r} ctx={ctx} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function CommentThread({ comments, ctx }: { comments: ThreadComment[]; ctx: ThreadContext }) {
  const router = useRouter();
  const pathname = usePathname();
  const total = countAll(comments);

  return (
    <section id="comments" aria-label="Comments" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_-14px_rgba(2,6,23,0.55)] sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <MessageSquare className="h-5 w-5 text-violet-600" aria-hidden="true" />
        {total} comment{total === 1 ? "" : "s"}
      </h2>

      <div className="mb-5">
        {ctx.isLocked && !ctx.isStaff ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">This discussion is locked — no new comments.</p>
        ) : !ctx.signedIn ? (
          <button
            type="button"
            onClick={() => router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(pathname)}`)}
            className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-left text-sm text-slate-600 hover:border-violet-400 hover:bg-violet-50"
          >
            <span className="font-semibold text-violet-700">Sign in</span> to join the discussion.
          </button>
        ) : !ctx.canComment ? (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {ctx.blockedMessage ?? "You can't comment right now."}
          </p>
        ) : (
          <CommentForm ctx={ctx} />
        )}
      </div>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No comments yet — be the first to reply.</p>
      ) : (
        <ul className="space-y-0">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} ctx={ctx} />
          ))}
        </ul>
      )}
    </section>
  );
}
