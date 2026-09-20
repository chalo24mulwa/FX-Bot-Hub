import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { runCalendarSyncIfDue } from "@/services/calendar/auto-sync";

export const dynamic = "force-dynamic";

// Optional trigger for the calendar sync — for an hPanel cron job or an
// external pinger, so hourly freshness holds even when nobody is viewing the
// calendar (the page-view trigger in src/app/calendar/page.tsx already
// covers the normal case). Same function and same "only if due" rule as that
// trigger: a cron hitting this every minute still causes at most one
// upstream sync per ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES. `?force=1`
// skips the "is it due" check (still refuses to overlap a run that started
// in the last minute) — for manual verification.
//
// Guarded by a bearer secret, and doesn't exist at all (404) until
// CRON_SECRET is set. Not an `assertSameOrigin` route: the caller is a cron
// client, not a browser (same reasoning as the license APIs).

const MIN_SECRET_LENGTH = 16;

function secretMatches(provided: string, expected: string): boolean {
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  const expected = env.CRON_SECRET;
  // Unset or too weak to be a real secret: behave as if the route doesn't exist.
  if (!expected || expected.length < MIN_SECRET_LENGTH) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await checkRateLimit(clientIp(request), { bucket: "cron:calendar-sync", limit: 30, windowSeconds: 60 });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } });
    }
    throw err;
  }

  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const outcome = await runCalendarSyncIfDue({ trigger: "cron", force: request.nextUrl.searchParams.get("force") === "1" });
  return NextResponse.json(outcome, { status: outcome.status === "failed" ? 502 : 200 });
}

export { handle as GET, handle as POST };
