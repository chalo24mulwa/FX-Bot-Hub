"use client";

import { useTransition } from "react";
import { approveRefundAction, rejectRefundAction } from "@/features/refunds/actions";

export function RefundActions({ refundId }: { refundId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => {
          if (confirm("Approve and process this refund? This charges the refund through the payment provider immediately.")) {
            startTransition(() => approveRefundAction(refundId));
          }
        }}
        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => rejectRefundAction(refundId))}
        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
