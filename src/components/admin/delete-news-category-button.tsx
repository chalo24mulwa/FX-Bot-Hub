"use client";

import { useTransition } from "react";
import { deleteNewsCategoryAction } from "@/features/admin/news-actions";

export function DeleteNewsCategoryButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (confirm("Delete this category? Articles keep their other fields but lose this category.")) {
          startTransition(() => deleteNewsCategoryAction(id));
        }
      }}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
