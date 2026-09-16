import { db } from "@/lib/db";

export interface RevisionEntry {
  eventId: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  provider: string;
}

export async function recordEventRevisions(entries: RevisionEntry[]) {
  if (entries.length === 0) return;
  await db.economicEventRevision.createMany({ data: entries });
}

/** Most recent changes first — powers the event detail page's "Updated"/
 * "Revised" history (see CalendarEventRevisionList). */
export async function listEventRevisions(eventId: string, limit = 20) {
  return db.economicEventRevision.findMany({
    where: { eventId },
    orderBy: { changedAt: "desc" },
    take: limit,
  });
}
