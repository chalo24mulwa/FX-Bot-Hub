"use client";

import { useTransition } from "react";
import { deleteCategoryAction } from "@/features/admin/actions";

export function DeleteCategoryButton({ categoryId, disabled }: { categoryId: string; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending || disabled}
      title={disabled ? "Category has products assigned — move or delete them first." : undefined}
      onClick={() => {
        if (confirm("Delete this category?")) startTransition(() => deleteCategoryAction(categoryId));
      }}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
