"use client";

import { useTransition } from "react";
import { deleteCategoryAction } from "@/features/admin/actions";

export function DeleteCategoryButton({ categoryId, disabled }: { categoryId: string; disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={disabled || isPending}
      title={disabled ? "Move or remove its products first" : undefined}
      onClick={() => startTransition(() => deleteCategoryAction(categoryId))}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Delete
    </button>
  );
}
