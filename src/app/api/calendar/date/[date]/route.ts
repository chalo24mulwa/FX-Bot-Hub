import { NextRequest, NextResponse } from "next/server";
import { getEventsByDateRange } from "@/services/calendar/calendar-service";
import { serializeEvent } from "../../_shared";
import { isSupportedTimezone } from "@/lib/calendar/timezone";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/calendar/date/[date] — every event on one UTC calendar day
// (date is YYYY-MM-DD). For a viewer-local calendar day instead, use
// /api/calendar/range with an explicit from/to and timezone — this route
// is the simple, unambiguous "one specific date" lookup the spec names.
export async function GET(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Path must be a date in YYYY-MM-DD form." }, { status: 400 });
  }
  const from = new Date(`${date}T00:00:00.000Z`);
  const to = new Date(`${date}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const { items, total } = await getEventsByDateRange(from, to);
  const tz = request.nextUrl.searchParams.get("timezone");
  const resolvedTz = isSupportedTimezone(tz) ? tz : undefined;
  return NextResponse.json({ events: items.map((e) => serializeEvent(e, resolvedTz)), total });
}
