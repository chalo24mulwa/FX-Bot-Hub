import { describe, expect, it } from "vitest";
import { validateRawEvents, mapImpact, mapCategory, toCalendarEventInput, type RawCalendarEvent } from "./authorized-provider-mapping";

function rawEvent(overrides: Partial<RawCalendarEvent> = {}): RawCalendarEvent {
  return {
    CalendarId: 12345,
    Date: "2026-09-20T12:30:00",
    Country: "United States",
    Currency: "USD",
    Category: "Inflation",
    Event: "CPI y/y",
    Reference: "Aug 2026",
    Actual: null,
    Previous: "2.9%",
    Forecast: "3.1%",
    Unit: "%",
    Importance: 3,
    ...overrides,
  };
}

describe("validateRawEvents", () => {
  it("accepts a well-formed provider response", () => {
    const { valid, rejected } = validateRawEvents([rawEvent()]);
    expect(valid).toHaveLength(1);
    expect(rejected).toBe(0);
  });

  it("rejects a malformed record (missing required fields) without failing the whole batch", () => {
    const { valid, rejected } = validateRawEvents([rawEvent(), { CalendarId: 1 }, rawEvent({ CalendarId: 999 })]);
    expect(valid).toHaveLength(2);
    expect(rejected).toBe(1);
  });

  it("rejects a non-array payload instead of throwing", () => {
    expect(validateRawEvents({ error: "not an array" })).toEqual({ valid: [], rejected: 0 });
    expect(validateRawEvents(null)).toEqual({ valid: [], rejected: 0 });
  });

  it("rejects a record with an invalid date/country type", () => {
    const { valid, rejected } = validateRawEvents([{ ...rawEvent(), Country: 42 }]);
    expect(valid).toHaveLength(0);
    expect(rejected).toBe(1);
  });
});

describe("mapImpact", () => {
  it("maps the provider's 1/2/3 importance scale to LOW/MEDIUM/HIGH", () => {
    expect(mapImpact(1)).toBe("LOW");
    expect(mapImpact(2)).toBe("MEDIUM");
    expect(mapImpact(3)).toBe("HIGH");
  });

  it("falls back to OTHER for null, undefined, or an unrecognized value — never crashes or guesses HIGH", () => {
    expect(mapImpact(null)).toBe("OTHER");
    expect(mapImpact(undefined)).toBe("OTHER");
    expect(mapImpact(99)).toBe("OTHER");
  });
});

describe("mapCategory", () => {
  it("matches common release types by keyword", () => {
    expect(mapCategory("Inflation", "CPI y/y")).toBe("INFLATION");
    expect(mapCategory(undefined, "Non Farm Payrolls")).toBe("EMPLOYMENT");
    expect(mapCategory("Central Bank", "Interest Rate Decision")).toBe("CENTRAL_BANK");
    expect(mapCategory(undefined, "Retail Sales MoM")).toBe("RETAIL");
  });

  it("falls back to OTHER for an unrecognized category/event", () => {
    expect(mapCategory("Some Unmapped Thing", "Mystery Release")).toBe("OTHER");
  });
});

describe("toCalendarEventInput", () => {
  it("maps a raw provider event into the app's CalendarEventInput shape", () => {
    const input = toCalendarEventInput(rawEvent());
    expect(input.externalId).toBe("authorized:12345");
    expect(input.currency).toBe("USD");
    expect(input.impact).toBe("HIGH");
    expect(input.category).toBe("INFLATION");
    expect(input.status).toBe("SCHEDULED"); // no Actual yet
  });

  it("infers RELEASED once Actual is present", () => {
    const input = toCalendarEventInput(rawEvent({ Actual: "3.3%" }));
    expect(input.status).toBe("RELEASED");
    expect(input.actual).toBe("3.3%");
  });

  it("falls back to a country-derived currency when the provider omits one", () => {
    const input = toCalendarEventInput(rawEvent({ Currency: undefined, Country: "Japan" }));
    expect(input.currency).toBe("JPY");
  });
});
