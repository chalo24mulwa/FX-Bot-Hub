"use client";

import { useTransition } from "react";
import { cancelProductSubscriptionAction, resumeProductSubscriptionAction } from "@/features/subscriptions/actions";

export function ProductSubscriptionRowActions({
  subscriptionId,
  status,
  cancelAtPeriodEnd,
}: {
  subscriptionId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (status !== "ACTIVE" && status !== "TRIAL") return null;

  return (
    <div className="flex gap-2">
      {cancelAtPeriodEnd ? (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => resumeProductSubscriptionAction(subscriptionId))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Resume
        </button>
      ) : (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => cancelProductSubscriptionAction(subscriptionId))}
          className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
