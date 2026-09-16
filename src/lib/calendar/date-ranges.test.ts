import { describe, expect, it } from "vitest";
import { getPresetRange, getCustomRange, getRangeBetween } from "./date-ranges";

// Wednesday 2026-09-16 12:00 UTC as the fixed "now" for every case.
const NOW = new Date("2026-09-16T12:00:00.000Z");

describe("getPresetRange — UTC viewer", () => {
  it("today spans the viewer's local midnight to midnight", () => {
    const { from, to } = getPresetRange("today", NOW, 0);
    expect(from.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });

  it("tomorrow is exactly one day after today", () => {
    const { from, to } = getPresetRange("tomorrow", NOW, 0);
    expect(from.toISOString()).toBe("2026-09-17T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });

  it("week starts on Monday and spans 7 days", () => {
    const { from, to } = getPresetRange("week", NOW, 0);
    // 2026-09-16 is a Wednesday; the Monday of that week is 2026-09-14.
    expect(from.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });

  it("next_week is the following 7-day block", () => {
    const { from, to } = getPresetRange("next_week", NOW, 0);
    expect(from.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });
});

describe("getPresetRange — timezone offsets shift the day boundary", () => {
  it("a positive (east-of-UTC) offset moves 'today' to the next UTC calendar day", () => {
    // At 12:00 UTC, UTC+14 (e.g. Kiribati) is already 02:00 the next local
    // day (Sep 17), so "today" is Sep 17 local — whose midnight-to-midnight
    // boundaries, expressed back in UTC, are Sep 16 10:00 -> Sep 17 10:00
    // (local midnight minus the +14h offset).
    const { from, to } = getPresetRange("today", NOW, 14 * 60);
    expect(from.toISOString()).toBe("2026-09-16T10:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-17T10:00:00.000Z");
  });

  it("a negative (west-of-UTC) offset keeps 'today' on the same UTC calendar day here, shifted later", () => {
    // At 12:00 UTC, UTC-12 is 00:00 the same local day (Sep 16), so "today"
    // is Sep 16 local — local midnight expressed in UTC is Sep 16 12:00
    // (local midnight plus the 12h offset).
    const { from, to } = getPresetRange("today", NOW, -12 * 60);
    expect(from.toISOString()).toBe("2026-09-16T12:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-17T12:00:00.000Z");
  });
});

describe("getCustomRange", () => {
  it("spans the given number of days from the start date", () => {
    const { from, to } = getCustomRange("2026-01-01", 5, 0);
    expect(from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-06T00:00:00.000Z");
  });
});

describe("getRangeBetween", () => {
  it("includes the entire end date, not just up to its midnight", () => {
    const { from, to } = getRangeBetween("2026-09-13", "2026-11-14", 0);
    expect(from.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    // Exclusive upper bound is the day AFTER Nov 14, so Nov 14's own
    // events (any time from 00:00 to 23:59:59) are included.
    expect(to.toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });

  it("spans a single day when from and to are the same date", () => {
    const { from, to } = getRangeBetween("2026-09-13", "2026-09-13", 0);
    expect(from.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("shifts both ends by the viewer's timezone offset", () => {
    const { from, to } = getRangeBetween("2026-09-13", "2026-09-13", 180); // UTC+3
    expect(from.toISOString()).toBe("2026-09-12T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-13T21:00:00.000Z");
  });

  it("falls back to a single-day span instead of an inverted range when 'to' precedes 'from'", () => {
    const { from, to } = getRangeBetween("2026-09-20", "2026-09-01", 0);
    expect(from.toISOString()).toBe("2026-09-20T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });
});
