"use client";

import { useEffect } from "react";

/**
 * Mounted once in the root layout. When the page URL carries ?ref= (a Partner
 * referral link) or ?master= (a Master Partner recruitment link), it reports
 * the code to the server — which validates it and sets a signed cookie — and
 * then removes the parameter from the address bar so it isn't copied on.
 * Does nothing on every other page view.
 */
export function ReferralTracker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    const master = url.searchParams.get("master");
    if (!ref && !master) return;

    void fetch("/api/partnership/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, master, path: url.pathname }),
      keepalive: true,
    }).catch(() => undefined);

    url.searchParams.delete("ref");
    if (url.pathname !== "/partnership/join") url.searchParams.delete("master");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
