"use client";

import { useTransition } from "react";
import { togglePublishArticleAction } from "@/features/admin/news-actions";

export function ArticlePublishToggle({ id, published }: { id: string; published: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => togglePublishArticleAction(id, !published))}
      className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
        published ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-emerald-600 text-white hover:bg-emerald-700"
      }`}
    >
      {published ? "Unpublish" : "Publish"}
    </button>
  );
}
