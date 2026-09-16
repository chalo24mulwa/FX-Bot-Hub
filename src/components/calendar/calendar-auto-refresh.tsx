"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Level 2 of the spec's two-level refresh (level 1 is the server-side
// calendarSync worker). Calls router.refresh() on an interval, which
// re-runs this route's server components against the DB and patches only
// the changed RSC payload — no full browser reload, and no client-side
// re-fetch/re-render plumbing to hand-maintain. Sufficient for a calendar
// (polling, not push — see src/services/calendar/realtime.ts for why).
// Pauses while the tab is hidden so a background tab doesn't keep hitting
// the server, and skips entirely for a reduced-motion preference isn't
// relevant here (no animation), but does respect page visibility.
export function CalendarAutoRefresh({ intervalSeconds }: { intervalSeconds: number }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalSeconds <= 0) return;

    function start() {
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, intervalSeconds * 1000);
    }
    function stop() {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    start();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        stop();
        start();
      }
    });

    return stop;
  }, [intervalSeconds, router]);

  return null;
}
