"use client";

import { useState, useTransition } from "react";
import { triggerCalendarSyncAction, triggerCalendarSyncTodayAction } from "@/features/admin/data-source-actions";

export function TriggerCalendarSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [isPendingToday, startTransitionToday] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await triggerCalendarSyncAction();
              setMessage("Full-window sync enqueued — requires a running calendar-sync worker to process it.");
            } catch {
              setMessage("Could not enqueue a sync job.");
            }
          })
        }
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isPending ? "Enqueuing…" : "Run calendar sync now"}
      </button>
      <button
        disabled={isPendingToday}
        onClick={() =>
          startTransitionToday(async () => {
            try {
              await triggerCalendarSyncTodayAction();
              setMessage("Today-only sync enqueued (logged as “calendarSyncToday” below).");
            } catch {
              setMessage("Could not enqueue a sync job.");
            }
          })
        }
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPendingToday ? "Enqueuing…" : "Sync today's events only"}
      </button>
      {message && <span className="text-xs text-slate-500">{message}</span>}
    </div>
  );
}
