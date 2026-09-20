import { describe, expect, it } from "vitest";
import { needsRowUpdate, shouldDispatchHighImpactAlert } from "./sync-service";

describe("shouldDispatchHighImpactAlert", () => {
  it("alerts for a brand-new HIGH-impact event", () => {
    expect(shouldDispatchHighImpactAlert(false, "HIGH")).toBe(true);
  });

  it("does not alert for a HIGH-impact event that already existed (dedup on re-sync)", () => {
    expect(shouldDispatchHighImpactAlert(true, "HIGH")).toBe(false);
  });

  it("does not alert for a new event below HIGH impact", () => {
    expect(shouldDispatchHighImpactAlert(false, "MEDIUM")).toBe(false);
    expect(shouldDispatchHighImpactAlert(false, "LOW")).toBe(false);
    expect(shouldDispatchHighImpactAlert(false, "HOLIDAY")).toBe(false);
    expect(shouldDispatchHighImpactAlert(false, "OTHER")).toBe(false);
  });

  it("does not alert for an existing, non-HIGH event", () => {
    expect(shouldDispatchHighImpactAlert(true, "MEDIUM")).toBe(false);
  });
});

describe("needsRowUpdate", () => {
  const base = {
    eventTime: new Date("2026-10-14T12:30:00Z"),
    impact: "HIGH" as const,
    category: "INFLATION" as const,
    actual: null,
    forecast: null,
    previous: "3.4%",
    unit: null,
    frequency: null,
    sourceUrl: "https://example.com/a",
    status: "SCHEDULED" as const,
    allDay: false,
  };
  const incoming = {
    externalId: "x",
    country: "United States",
    currency: "USD",
    title: "US CPI",
    impact: "HIGH" as const,
    category: "INFLATION" as const,
    eventTime: new Date("2026-10-14T12:30:00Z"),
    previous: "3.4%",
    sourceUrl: "https://example.com/a",
    status: "SCHEDULED" as const,
    allDay: false,
  };

  it("is false when nothing the provider reported differs — the row skips its write", () => {
    expect(needsRowUpdate(base, incoming)).toBe(false);
  });

  it("is true when actual, forecast, previous, time, impact, status or allDay changes", () => {
    expect(needsRowUpdate(base, { ...incoming, actual: "3.5%" })).toBe(true);
    expect(needsRowUpdate(base, { ...incoming, forecast: "3.6%" })).toBe(true);
    expect(needsRowUpdate(base, { ...incoming, previous: "3.3%" })).toBe(true);
    expect(needsRowUpdate(base, { ...incoming, eventTime: new Date("2026-10-14T13:30:00Z") })).toBe(true);
    expect(needsRowUpdate(base, { ...incoming, impact: "MEDIUM" })).toBe(true);
    expect(needsRowUpdate(base, { ...incoming, status: "RELEASED" })).toBe(true);
    expect(needsRowUpdate(base, { ...incoming, allDay: true })).toBe(true);
  });

  it("ignores fields the provider didn't report (undefined never overwrites)", () => {
    const { previous: _p, sourceUrl: _s, ...sparse } = incoming;
    expect(needsRowUpdate(base, sparse)).toBe(false);
  });
});
