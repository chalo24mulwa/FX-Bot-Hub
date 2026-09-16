import { NextRequest } from "next/server";
import { parseCalendarQuery, respondWithEvents, respondWithError } from "../_shared";

// GET /api/calendar/events — identical contract to GET /api/calendar (see
// that route's comment); the spec lists both paths explicitly.
export async function GET(request: NextRequest) {
  try {
    const { query, timezone } = parseCalendarQuery(request);
    return await respondWithEvents(query, timezone);
  } catch (err) {
    return respondWithError(err);
  }
}
