"use client";

import { useTransition } from "react";
import { hideReviewAction, deleteReviewAction } from "@/features/admin/actions";

export function ReviewModerationActions({ reviewId, hidden }: { reviewId: string; hidden: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => startTransition(() => hideReviewAction(reviewId, !hidden))}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {hidden ? "Unhide" : "Hide"}
      </button>
      <button
        disabled={isPending}
        onClick={() => {
          if (confirm("Permanently delete this review?")) startTransition(() => deleteReviewAction(reviewId));
        }}
        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
