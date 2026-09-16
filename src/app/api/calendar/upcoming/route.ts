import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUpcomingEvents } from "@/services/calendar/calendar-service";
import { serializeEvent } from "../_shared";
import { isSupportedTimezone } from "@/lib/calendar/timezone";
import type { EventImpact, EventCategory } from "@prisma/client";

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
  timezone: z.string().optional(),
});

// GET /api/calendar/upcoming?days=7 — what the client-side polling refresh
// (level 2 of the two-level auto-refresh, see calendar-auto-refresh.tsx)
// and any future "what's coming up" widget both read. `days` deliberately
// capped at 30 — this is meant to stay a short, cheap lookahead, not a
// general-purpose range query (use /api/calendar/range for that).
export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
  }
  const { days, timezone } = parsed.data;
  const currencies = request.nextUrl.searchParams.getAll("currency");
  const impacts = request.nextUrl.searchParams.getAll("impact") as EventImpact[];
  const categories = request.nextUrl.searchParams.getAll("category") as EventCategory[];

  const { items, total } = await getUpcomingEvents(days, {
    currencies: currencies.length ? currencies : undefined,
    impacts: impacts.length ? impacts : undefined,
    categories: categories.length ? categories : undefined,
  });

  const resolvedTz = isSupportedTimezone(timezone) ? timezone : undefined;
  return NextResponse.json({ events: items.map((e) => serializeEvent(e, resolvedTz)), total });
}
