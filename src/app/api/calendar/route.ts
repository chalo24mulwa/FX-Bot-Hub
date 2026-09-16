import { NextRequest } from "next/server";
import { parseCalendarQuery, respondWithEvents, respondWithError } from "./_shared";

// GET /api/calendar?from=...&to=...&currency=USD&impact=HIGH — the base
// calendar read endpoint (spec section 9). Same handler as
// /api/calendar/events; kept as two paths because the spec names both.
// Never calls a provider directly — always reads through calendar-service,
// which is Postgres-only and paginated (see CLAUDE.md's "the app's only
// read path for calendar data" note) — so this stays fast and available
// even if an upstream provider is down.
export async function GET(request: NextRequest) {
  try {
    const { query, timezone } = parseCalendarQuery(request);
    return await respondWithEvents(query, timezone);
  } catch (err) {
    return respondWithError(err);
  }
}
