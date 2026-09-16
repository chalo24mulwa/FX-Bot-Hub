import type { EconomicEvent } from "@prisma/client";

// Not wired to any transport today — the calendar refreshes via client-side
// polling (see useCalendarAutoRefresh) because polling is sufficient at
// current scale and a WebSocket/SSE layer would be unjustified complexity
// for one feature. This type exists so that IF a push transport is added
// later (a BullMQ event, a Postgres LISTEN/NOTIFY trigger, or a queue
// consumer publishing to an SSE endpoint), every consumer — an SSE route,
// a WebSocket handler, a future mobile client — can agree on one shape
// without redesigning the calendar's read side. Nothing in calendar-service
// or sync-service depends on this; it is intentionally inert.
export type CalendarUpdateKind = "created" | "updated" | "revised" | "cancelled" | "postponed";

export interface CalendarUpdateEvent {
  kind: CalendarUpdateKind;
  eventId: string;
  currency: string;
  /** Present for "updated"/"revised" — which fields changed, matching
   * EconomicEventRevision.fieldChanged. Omitted for "created"/"cancelled". */
  changedFields?: string[];
  event: Pick<EconomicEvent, "id" | "title" | "currency" | "eventTime" | "impact" | "status">;
  occurredAt: Date;
}
