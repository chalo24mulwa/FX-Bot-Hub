"use client";

import { useState, useTransition } from "react";
import {
  claimForReviewAction,
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
  const [showReject, setShowReject] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {status === "PENDING_REVIEW" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => claimForReviewAction(productId))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Claim for review
        </button>
      )}

      {(status === "PENDING_REVIEW" || status === "UNDER_REVIEW") && (
        <>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => approveProductAction(productId))}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve
          </button>

          {showReject ? (
            <div className="flex flex-col gap-1">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for the seller (5+ characters)"
                className="h-7 rounded border border-slate-300 px-2 text-xs"
              />
              <div className="flex gap-1">
                <button
                  disabled={isPending || reason.trim().length < 5}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        setError(null);
                        await rejectProductAction(productId, reason);
                        setShowReject(false);
                        setReason("");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Couldn't reject this listing.");
                      }
                    })
                  }
                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm reject
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled={isPending}
              onClick={() => setShowReject(true)}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </>
      )}

      {status === "PUBLISHED" &&
        (showSuspend ? (
          <div className="flex flex-col gap-1">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for the seller (5+ characters)"
              className="h-7 rounded border border-slate-300 px-2 text-xs"
            />
            <div className="flex gap-1">
              <button
                disabled={isPending || reason.trim().length < 5}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      setError(null);
                      await suspendProductAction(productId, reason);
                      setShowSuspend(false);
                      setReason("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Couldn't suspend this listing.");
                    }
                  })
                }
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Confirm suspend
              </button>
              <button onClick={() => setShowSuspend(false)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            disabled={isPending}
            onClick={() => setShowSuspend(true)}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Suspend
          </button>
        ))}

      <button
        disabled={isPending}
        onClick={() => startTransition(() => toggleFeaturedAction(productId, !featured))}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {featured ? "Unfeature" : "Feature"}
      </button>
      <a href={`/admin/products/${productId}`} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
        Open
      </a>
      {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
