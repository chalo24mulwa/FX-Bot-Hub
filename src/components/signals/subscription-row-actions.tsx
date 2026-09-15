"use client";

import { useTransition } from "react";
import { cancelSubscriptionAction, pauseSubscriptionAction, resumeSubscriptionAction } from "@/features/signals/actions";

export function SubscriptionRowActions({ providerId, status }: { providerId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      {status === "ACTIVE" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => pauseSubscriptionAction(providerId))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Pause
        </button>
      )}
      {status === "PAUSED" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => resumeSubscriptionAction(providerId))}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Resume
        </button>
      )}
      {(status === "ACTIVE" || status === "PAUSED") && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => cancelSubscriptionAction(providerId))}
          className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
