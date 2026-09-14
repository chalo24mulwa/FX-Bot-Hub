import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Phase 1: reads events seeded/synced into economic_events. Phase 2 can add
// a BullMQ job (see src/lib/queue/queues.ts -> calendarSyncQueue) that pulls
// from a real provider and upserts by externalId.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const currency = params.get("currency") ?? undefined;
  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : undefined;

  const events = await db.economicEvent.findMany({
    where: {
      currency,
      eventTime: { gte: from, lte: to },
    },
    orderBy: { eventTime: "asc" },
    take: 200,
  });

  return NextResponse.json({ events });
}
