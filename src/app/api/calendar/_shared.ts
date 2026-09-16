import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEvents, type CalendarQuery } from "@/services/calendar/calendar-service";
import { formatInTimezone, isSupportedTimezone } from "@/lib/calendar/timezone";
import type { EconomicEvent } from "@prisma/client";

// Shared by every /api/calendar/* GET route (spec section 9) so they all
// validate query params and shape their JSON response identically instead
// of each route hand-rolling its own parsing. None of these ever call an
// external provider directly — they only ever read from Postgres via
// calendar-service, which is the app's one read path for calendar data
// (see CLAUDE.md) — so a slow/down upstream provider can never make one of
// these requests slow.

const QuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  currency: z.union([z.string(), z.array(z.string())]).optional(),
  country: z.union([z.string(), z.array(z.string())]).optional(),
  impact: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  timezone: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(250).optional(),
});

function toArray(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}

export interface ParsedCalendarQuery {
  query: CalendarQuery;
  timezone?: string;
}

export class CalendarApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** Parses and validates a request's query params into a CalendarQuery.
 * `defaults` lets a specific route (e.g. /upcoming) supply its own from/to
 * when the caller doesn't. Throws CalendarApiError on invalid input —
 * callers should catch it and return the mapped status, never let a bad
 * `from`/`to` reach the database as an invalid Date. */
export function parseCalendarQuery(request: NextRequest, defaults?: { from: Date; to: Date }): ParsedCalendarQuery {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  // getAll for the multi-value params zod's union can't distinguish from a
  // single string in a plain Object.fromEntries.
  const multi = {
    currency: request.nextUrl.searchParams.getAll("currency"),
    country: request.nextUrl.searchParams.getAll("country"),
    impact: request.nextUrl.searchParams.getAll("impact"),
    category: request.nextUrl.searchParams.getAll("category"),
  };
  const parsed = QuerySchema.safeParse({ ...raw, ...multi });
  if (!parsed.success) {
    throw new CalendarApiError(`Invalid query parameters: ${parsed.error.issues.map((i) => i.message).join("; ")}`, 400);
  }
  const data = parsed.data;
  const from = data.from ?? defaults?.from;
  const to = data.to ?? defaults?.to;
  if (!from || !to) {
    throw new CalendarApiError("Both 'from' and 'to' query parameters are required (ISO date/time).", 400);
  }
  if (from > to) {
    throw new CalendarApiError("'from' must not be after 'to'.", 400);
  }

  return {
    query: {
      from,
      to,
      currencies: toArray(multi.currency),
      countries: toArray(multi.country),
      impacts: toArray(multi.impact) as CalendarQuery["impacts"],
      categories: toArray(multi.category) as CalendarQuery["categories"],
      page: data.page,
      pageSize: data.pageSize,
    },
    timezone: isSupportedTimezone(data.timezone) ? data.timezone : undefined,
  };
}

export function serializeEvent(event: EconomicEvent, timezone?: string) {
  return {
    id: event.id,
    externalId: event.externalId,
    country: event.country,
    currency: event.currency,
    title: event.title,
    impact: event.impact,
    category: event.category,
    status: event.status,
    eventTime: event.eventTime.toISOString(),
    ...(timezone ? { local: formatInTimezone(event.eventTime, timezone) } : {}),
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    revisedPrevious: event.revisedPrevious,
    unit: event.unit,
    frequency: event.frequency,
    source: event.source,
    sourceUrl: event.sourceUrl,
    description: event.description,
    lastSyncedAt: event.lastSyncedAt ? event.lastSyncedAt.toISOString() : null,
  };
}

export async function respondWithEvents(query: CalendarQuery, timezone?: string) {
  const { items, total, page, pageSize } = await getEvents(query);
  return NextResponse.json({
    events: items.map((e) => serializeEvent(e, timezone)),
    pagination: { total, page, pageSize, hasMore: page * pageSize < total },
  });
}

export function respondWithError(err: unknown) {
  if (err instanceof CalendarApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Internal error." }, { status: 500 });
}
