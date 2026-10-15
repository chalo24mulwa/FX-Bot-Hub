"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { endImpersonationAction } from "@/features/admin/impersonation-actions";

/**
 * Shown on every page while an administrator is viewing as a member. It reads the
 * session (which only carries a display name and the expiry — nothing about the
 * administrator's own credentials), and can't be dismissed except by exiting.
 */
export function ImpersonationBanner() {
  const { data: session } = useSession();
  const impersonation = session?.user?.impersonation;
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!impersonation) return;
    const update = () => setMinutesLeft(Math.max(0, Math.ceil((impersonation.expiresAt - Date.now()) / 60_000)));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [impersonation]);

  if (!impersonation) return null;

  return (
    <div role="alert" data-testid="impersonation-banner" className="sticky top-0 z-50 border-b border-amber-700 bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p>
          ADMIN ACCESS MODE — Viewing account: <span className="underline decoration-amber-900/40">{impersonation.targetName}</span>
          {minutesLeft !== null && <span className="ml-2 font-normal">· ends automatically in {minutesLeft} min</span>}
        </p>
        <form action={endImpersonationAction}>
          <button type="submit" className="rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-white hover:bg-black">
            Exit impersonation
          </button>
        </form>
      </div>
    </div>
  );
}
