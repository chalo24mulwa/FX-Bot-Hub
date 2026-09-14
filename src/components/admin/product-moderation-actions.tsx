"use client";

import { useTransition } from "react";
import {
  approveProductAction,
  rejectProductAction,
  suspendProductAction,
  toggleFeaturedAction,
} from "@/features/admin/actions";

export function ProductModerationActions({
  productId,
  status,
  featured,
}: {
  productId: string;
  status: string;
  featured: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING_REVIEW" && (
        <>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => approveProductAction(productId))}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => rejectProductAction(productId))}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </>
      )}
      {status === "PUBLISHED" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => suspendProductAction(productId))}
          className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Suspend
        </button>
      )}
      <button
        disabled={isPending}
        onClick={() => startTransition(() => toggleFeaturedAction(productId, !featured))}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {featured ? "Unfeature" : "Feature"}
      </button>
    </div>
  );
}
