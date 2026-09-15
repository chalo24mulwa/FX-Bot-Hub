"use client";

import { useTransition } from "react";
import { markPayoutProcessingAction, markPayoutPaidAction, markPayoutFailedAction } from "@/features/payouts/actions";

export function PayoutActions({ payoutId, status }: { payoutId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      {status === "PENDING" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => markPayoutProcessingAction(payoutId))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Mark processing
        </button>
      )}
      {(status === "PENDING" || status === "PROCESSING") && (
        <>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => markPayoutPaidAction(payoutId))}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Mark paid
          </button>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => markPayoutFailedAction(payoutId))}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Mark failed
          </button>
        </>
      )}
    </div>
  );
}
