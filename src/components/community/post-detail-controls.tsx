"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deletePostAction, toggleFollowAction } from "@/features/community/actions";

// "Follow the discussion" — followers are notified of new comments.
export function FollowButton({ postId, following, signedIn, canFollow, blockedMessage }: { postId: string; following: boolean; signedIn: boolean; canFollow: boolean; blockedMessage: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [on, setOn] = useState(following);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) return router.push(`/auth/sign-in?callbackUrl=${encodeURIComponent(pathname)}`);
    if (!canFollow) return setNotice(blockedMessage ?? "You can't follow right now.");
    const before = on;
    setOn(!before);
    startTransition(async () => {
      const res = await toggleFollowAction(postId);
      if (res.ok) setOn(res.following);
      else {
        setOn(before);
        setNotice(res.error);
      }
    });
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          on ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-100"
        )}
      >
        {on ? <Bell className="h-4 w-4 fill-current" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
        {on ? "Following" : "Follow discussion"}
      </button>
      {notice && (
        <span role="status" className="mt-1 text-xs text-amber-700">
          {notice}
        </span>
      )}
    </span>
  );
}

// Edit / delete — only rendered for the post's author (the server re-checks ownership on every action).
export function PostOwnerMenu({ postId, canEdit = true }: { postId: string; canEdit?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Delete this post? This can't be undone by you.")) return;
    startTransition(async () => {
      const res = await deletePostAction(postId);
      if (res.ok) router.push("/community");
      else setError(res.error);
    });
  }

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1">
        {canEdit && (
          <Link href={`/community/post/${postId}/edit`} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
          </Link>
        )}
        <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </button>
      </span>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
