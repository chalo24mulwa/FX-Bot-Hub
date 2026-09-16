import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/services/calendar/calendar-service";
import { serializeEvent } from "../../_shared";
import { isSupportedTimezone } from "@/lib/calendar/timezone";

// GET /api/calendar/event/[id] — a single event, by our own id (not the
// upstream provider's externalId — that's an implementation detail this
// API never exposes as the lookup key).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  const tz = request.nextUrl.searchParams.get("timezone");
  return NextResponse.json({ event: serializeEvent(event, isSupportedTimezone(tz) ? tz : undefined) });
}
