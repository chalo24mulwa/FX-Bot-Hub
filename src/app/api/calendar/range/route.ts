import { NextRequest } from "next/server";
import { parseCalendarQuery, respondWithEvents, respondWithError } from "../_shared";

// GET /api/calendar/range?from=...&to=...&currency=USD — identical
// contract to GET /api/calendar (see that route's comment); named
// separately because the spec lists it as its own endpoint for a range
// query distinct from the currency-filtered/date-scoped ones.
export async function GET(request: NextRequest) {
  try {
    const { query, timezone } = parseCalendarQuery(request);
    return await respondWithEvents(query, timezone);
  } catch (err) {
    return respondWithError(err);
  }
}
