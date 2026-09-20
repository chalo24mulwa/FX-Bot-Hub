import { describe, expect, it } from "vitest";
import {
  resolveTimezone,
  isSupportedTimezone,
  getTimezoneOffsetMinutes,
  formatInTimezone,
  formatRangeLabel,
  formatAge,
  DEFAULT_CALENDAR_TIMEZONE,
} from "./timezone";

describe("resolveTimezone / isSupportedTimezone", () => {
  it("defaults to Africa/Nairobi for an unsupported, missing, or empty zone", () => {
    expect(resolveTimezone(undefined)).toBe(DEFAULT_CALENDAR_TIMEZONE);
    expect(resolveTimezone(null)).toBe(DEFAULT_CALENDAR_TIMEZONE);
    expect(resolveTimezone("")).toBe(DEFAULT_CALENDAR_TIMEZONE);
    expect(resolveTimezone("Mars/Olympus_Mons")).toBe(DEFAULT_CALENDAR_TIMEZONE);
  });

  it("passes through every one of the spec's required zones", () => {
    for (const id of ["UTC", "Africa/Nairobi", "Europe/London", "America/New_York", "Asia/Tokyo"]) {
      expect(isSupportedTimezone(id)).toBe(true);
      expect(resolveTimezone(id)).toBe(id);
    }
  });
});

describe("getTimezoneOffsetMinutes", () => {
  it("UTC is always +0", () => {
    expect(getTimezoneOffsetMinutes("UTC", new Date("2026-06-15T12:00:00Z"))).toBe(0);
    expect(getTimezoneOffsetMinutes("UTC", new Date("2026-01-15T12:00:00Z"))).toBe(0);
  });

  it("Africa/Nairobi is a fixed UTC+3 (no DST)", () => {
    expect(getTimezoneOffsetMinutes("Africa/Nairobi", new Date("2026-06-15T12:00:00Z"))).toBe(180);
    expect(getTimezoneOffsetMinutes("Africa/Nairobi", new Date("2026-01-15T12:00:00Z"))).toBe(180);
  });

  it("America/New_York's offset differs between DST and standard time (never manually computed)", () => {
    const julyOffset = getTimezoneOffsetMinutes("America/New_York", new Date("2026-07-15T12:00:00Z"));
    const januaryOffset = getTimezoneOffsetMinutes("America/New_York", new Date("2026-01-15T12:00:00Z"));
    expect(julyOffset).toBe(-240); // EDT, UTC-4
    expect(januaryOffset).toBe(-300); // EST, UTC-5
  });
});

describe("formatInTimezone", () => {
  it("renders the same UTC instant differently depending on the zone", () => {
    const instant = new Date("2026-09-20T23:30:00Z");
    const nairobi = formatInTimezone(instant, "Africa/Nairobi");
    const newYork = formatInTimezone(instant, "America/New_York");
    // Nairobi is UTC+3 -> 02:30 the next day; New York (EDT, UTC-4) -> 19:30 same day.
    expect(nairobi.time).toBe("02:30");
    expect(newYork.time).toBe("19:30");
    expect(nairobi.date).not.toBe(newYork.date);
  });
});

describe("formatRangeLabel", () => {
  // Nairobi is UTC+3: local Sun 20 Sept 00:00 = Sat 19 Sept 21:00Z; exclusive end = Sun 27 Sept 00:00 local.
  it("names the first and last included day, with the year once", () => {
    const from = new Date("2026-09-19T21:00:00Z");
    const to = new Date("2026-09-26T21:00:00Z");
    expect(formatRangeLabel(from, to, "Africa/Nairobi")).toBe("Sun 20 Sept – Sat 26 Sept 2026");
  });

  it("collapses a single day to one date", () => {
    expect(formatRangeLabel(new Date("2026-09-19T21:00:00Z"), new Date("2026-09-20T21:00:00Z"), "Africa/Nairobi")).toBe("Sun 20 Sept 2026");
  });

  it("keeps both years when the range crosses a year boundary", () => {
    expect(formatRangeLabel(new Date("2026-12-20T21:00:00Z"), new Date("2027-01-10T21:00:00Z"), "Africa/Nairobi")).toBe(
      "Mon 21 Dec 2026 – Sun 10 Jan 2027"
    );
  });

  it("uses the viewer's zone for the day boundaries", () => {
    // Same instants read in UTC start a day earlier than in Nairobi.
    expect(formatRangeLabel(new Date("2026-09-19T21:00:00Z"), new Date("2026-09-20T21:00:00Z"), "UTC")).toBe("Sat 19 Sept – Sun 20 Sept 2026");
  });
});

describe("formatAge", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  it("reads naturally at each scale", () => {
    expect(formatAge(new Date("2026-09-20T11:59:40Z"), now)).toBe("just now");
    expect(formatAge(new Date("2026-09-20T11:48:00Z"), now)).toBe("12 min ago");
    expect(formatAge(new Date("2026-09-20T09:00:00Z"), now)).toBe("3 h ago");
    expect(formatAge(new Date("2026-09-17T12:00:00Z"), now)).toBe("3 d ago");
  });
  it("never goes negative for a timestamp slightly in the future", () => {
    expect(formatAge(new Date("2026-09-20T12:00:30Z"), now)).toBe("just now");
  });
});
