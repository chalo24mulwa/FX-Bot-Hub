import type { EconomicEvent } from "@prisma/client";
import type { CalendarEventInput } from "./providers/types";

export interface FieldRevision {
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface EventDiffResult {
  revisions: FieldRevision[];
  /** Set only when `previous` genuinely changed on an already-reported
   * value (not the first time this row got a previous value) — the value
   * to preserve in EconomicEvent.revisedPrevious. `undefined` means "don't
   * touch revisedPrevious"; it is never reset back to null by a diff. */
  revisedPreviousUpdate?: string;
}

function diffOptionalString(fieldChanged: string, existing: string | null, incoming: string | undefined): FieldRevision | null {
  // `undefined` means the provider didn't report this field in this pass —
  // never diffed, never overwritten (see sync-service's update payload).
  if (incoming === undefined || incoming === existing) return null;
  return { fieldChanged, oldValue: existing, newValue: incoming };
}

/**
 * Pure diff between the DB's current row and one incoming provider record —
 * no DB access, so it's unit-testable without Postgres (same pattern as
 * calendar-service's buildEventWhere / sync-service's
 * shouldDispatchHighImpactAlert). `existing: null` means "this is a brand
 * new event" — nothing to diff, no revisions recorded (a revision is a
 * change to something that already existed, not the initial creation).
 */
export function detectFieldChanges(
  existing: Pick<EconomicEvent, "forecast" | "previous" | "actual" | "eventTime" | "impact" | "status"> | null,
  incoming: CalendarEventInput
): EventDiffResult {
  if (!existing) return { revisions: [] };

  const revisions: FieldRevision[] = [];
  let revisedPreviousUpdate: string | undefined;

  const forecastDiff = diffOptionalString("forecast", existing.forecast, incoming.forecast);
  if (forecastDiff) revisions.push(forecastDiff);

  const previousDiff = diffOptionalString("previous", existing.previous, incoming.previous);
  if (previousDiff) {
    revisions.push(previousDiff);
    // Only a genuine revision (the field held a value before) — the first
    // time `previous` is ever populated isn't a "revision" of anything.
    if (existing.previous !== null) revisedPreviousUpdate = existing.previous;
  }

  const actualDiff = diffOptionalString("actual", existing.actual, incoming.actual);
  if (actualDiff) revisions.push(actualDiff);

  if (incoming.eventTime.getTime() !== existing.eventTime.getTime()) {
    revisions.push({
      fieldChanged: "eventTime",
      oldValue: existing.eventTime.toISOString(),
      newValue: incoming.eventTime.toISOString(),
    });
  }

  if (incoming.impact !== existing.impact) {
    revisions.push({ fieldChanged: "impact", oldValue: existing.impact, newValue: incoming.impact });
  }

  if (incoming.status !== undefined && incoming.status !== existing.status) {
    revisions.push({ fieldChanged: "status", oldValue: existing.status, newValue: incoming.status });
  }

  return { revisions, revisedPreviousUpdate };
}

/**
 * Which previously-SCHEDULED external ids (in the future-facing part of the
 * sync window) were NOT returned by the provider this pass — the signal
 * used to mark an event CANCELLED without ever deleting its row (see
 * sync-service's provider-failure/cancellation handling and CLAUDE.md's
 * "never delete existing events" rule). Pure set difference, unit-testable
 * without a DB.
 */
export function detectDisappearedEvents(previouslyScheduledExternalIds: string[], returnedExternalIds: Set<string>): string[] {
  return previouslyScheduledExternalIds.filter((id) => !returnedExternalIds.has(id));
}
