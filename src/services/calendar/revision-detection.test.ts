import { describe, expect, it } from "vitest";
import { detectFieldChanges, detectDisappearedEvents } from "./revision-detection";
import type { EconomicEvent } from "@prisma/client";
import type { CalendarEventInput } from "./providers/types";

function existingRow(overrides: Partial<EconomicEvent> = {}): Pick<
  EconomicEvent,
  "forecast" | "previous" | "actual" | "eventTime" | "impact" | "status"
> {
  return {
    forecast: "3.1%",
    previous: "2.9%",
    actual: null,
    eventTime: new Date("2026-09-20T12:30:00Z"),
    impact: "HIGH",
    status: "SCHEDULED",
    ...overrides,
  };
}

function incomingEvent(overrides: Partial<CalendarEventInput> = {}): CalendarEventInput {
  return {
    externalId: "authorized:1",
    country: "United States",
    currency: "USD",
    title: "CPI y/y",
    impact: "HIGH",
    category: "INFLATION",
    eventTime: new Date("2026-09-20T12:30:00Z"),
    forecast: "3.1%",
    previous: "2.9%",
    ...overrides,
  };
}

describe("detectFieldChanges", () => {
  it("a brand-new event (existing: null) produces no revisions", () => {
    expect(detectFieldChanges(null, incomingEvent()).revisions).toEqual([]);
  });

  it("no revisions when nothing changed", () => {
    expect(detectFieldChanges(existingRow(), incomingEvent()).revisions).toEqual([]);
  });

  it("detects a forecast change", () => {
    const { revisions } = detectFieldChanges(existingRow(), incomingEvent({ forecast: "3.2%" }));
    expect(revisions).toContainEqual({ fieldChanged: "forecast", oldValue: "3.1%", newValue: "3.2%" });
  });

  it("detects an actual release and does not touch revisedPrevious", () => {
    const { revisions, revisedPreviousUpdate } = detectFieldChanges(existingRow(), incomingEvent({ actual: "3.3%" }));
    expect(revisions).toContainEqual({ fieldChanged: "actual", oldValue: null, newValue: "3.3%" });
    expect(revisedPreviousUpdate).toBeUndefined();
  });

  it("a previous-value revision is logged AND preserved in revisedPreviousUpdate", () => {
    const { revisions, revisedPreviousUpdate } = detectFieldChanges(existingRow(), incomingEvent({ previous: "3.0%" }));
    expect(revisions).toContainEqual({ fieldChanged: "previous", oldValue: "2.9%", newValue: "3.0%" });
    expect(revisedPreviousUpdate).toBe("2.9%");
  });

  it("the FIRST time previous is populated is not treated as a revision", () => {
    const { revisions, revisedPreviousUpdate } = detectFieldChanges(
      existingRow({ previous: null }),
      incomingEvent({ previous: "2.9%" })
    );
    expect(revisions).toContainEqual({ fieldChanged: "previous", oldValue: null, newValue: "2.9%" });
    expect(revisedPreviousUpdate).toBeUndefined();
  });

  it("detects a rescheduled eventTime", () => {
    const { revisions } = detectFieldChanges(existingRow(), incomingEvent({ eventTime: new Date("2026-09-21T12:30:00Z") }));
    expect(revisions.some((r) => r.fieldChanged === "eventTime")).toBe(true);
  });

  it("detects an impact reclassification", () => {
    const { revisions } = detectFieldChanges(existingRow(), incomingEvent({ impact: "MEDIUM" }));
    expect(revisions).toContainEqual({ fieldChanged: "impact", oldValue: "HIGH", newValue: "MEDIUM" });
  });

  it("a field the provider omits this pass (undefined) is never diffed or overwritten", () => {
    const { revisions } = detectFieldChanges(existingRow(), incomingEvent({ forecast: undefined }));
    expect(revisions.some((r) => r.fieldChanged === "forecast")).toBe(false);
  });
});

describe("detectDisappearedEvents", () => {
  it("flags a previously-scheduled event the provider stopped returning", () => {
    const disappeared = detectDisappearedEvents(["a", "b", "c"], new Set(["a", "c"]));
    expect(disappeared).toEqual(["b"]);
  });

  it("flags nothing when every previously-scheduled event was returned again", () => {
    expect(detectDisappearedEvents(["a", "b"], new Set(["a", "b", "c"]))).toEqual([]);
  });

  it("is a no-op with no previously-scheduled events", () => {
    expect(detectDisappearedEvents([], new Set(["a"]))).toEqual([]);
  });
});
