"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Level 2 of the spec's two-level refresh (level 1 is the server-side
// calendarSync). Calls router.refresh() on an interval, which re-runs this
// route's server components against the DB and patches only the changed RSC
// payload — no full browser reload, and no client-side re-fetch/re-render
// plumbing to hand-maintain. Sufficient for a calendar (polling, not push —
// see src/services/calendar/realtime.ts for why). Pauses while the tab is
// hidden so a background tab doesn't keep hitting the server.
//
// It also renders the visible "refresh now" control: a manual router.refresh()
// re-reads OUR database only — it never calls the external feed (that is
// governed by the once-an-hour due-check in src/services/calendar/auto-sync.ts),
// so clicking it as often as you like can't create upstream traffic.
export function CalendarAutoRefresh({ intervalSeconds }: { intervalSeconds: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (intervalSeconds <= 0) return;

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalSeconds * 1000);

    // Catch up right away when a hidden tab becomes visible again instead of
    // showing data up to a full interval old.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalSeconds, router]);

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-label="Refresh calendar"
      title="Refresh calendar"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-70"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
      <span className="hidden sm:inline">{isPending ? "Refreshing…" : "Refresh"}</span>
    </button>
  );
}
