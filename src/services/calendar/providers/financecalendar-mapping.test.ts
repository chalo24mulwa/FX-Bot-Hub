import { describe, expect, it } from "vitest";
import {
  buildExternalId,
  decodeHtmlEntities,
  inferCountryCurrency,
  mapFinanceCalendarEvent,
  parseFinanceCalendarResponse,
  splitDateRange,
  type RawFinanceCalendarEvent,
} from "./financecalendar-mapping";

// Rows below are real payloads captured from
// https://www.financecalendar.com/wp-json/fc/v1/calendar (Sept 2026).
const NFP: RawFinanceCalendarEvent = {
  date: "2026-08-07",
  time_utc: "2026-08-07T12:30:00+00:00",
  all_day: false,
  name: "US jobs report (NFP)",
  title: "US Employment Situation (Non-Farm Payrolls) August 2026",
  impact: "high",
  category: "economic-indicators",
  consensus: null,
  prior: null,
  actual: "-23,000 NFP vs +80,000 expec…",
  url: "https://www.financecalendar.com/event/us-employment-situation-non-farm-payrolls-august-2026/",
};

const HOLIDAY: RawFinanceCalendarEvent = {
  date: "2026-09-22",
  time_utc: null,
  all_day: true,
  name: "Is the Stock Market Open on Citizens&#8217; Holiday (Bridge Day) 2026? TSE/JPX Hours",
  title: "Is the Stock Market Open on Citizens&#8217; Holiday (Bridge Day) 2026? TSE/JPX Hours",
  impact: "low",
  category: "economic-indicators",
  consensus: null,
  prior: "Closed for Mountain Day, Aug…",
  actual: null,
  url: "https://www.financecalendar.com/event/tse-jpx-citizens-holiday-bridge-day-2026/",
};

const BOJ: RawFinanceCalendarEvent = {
  date: "2026-10-30",
  time_utc: null,
  all_day: true,
  name: "Bank of Japan decision",
  title: "Bank of Japan Rate Decision October 2026",
  impact: "high",
  category: "central-banks-monetary-policy",
  consensus: "A 25bp hike to 1.25%, accord…",
  prior: null,
  actual: null,
  url: "https://www.financecalendar.com/event/boj-rate-decision-october-2026/",
};

describe("mapFinanceCalendarEvent", () => {
  it("maps a released timed event (impact, currency, actual, status, stable id)", () => {
    const e = mapFinanceCalendarEvent(NFP)!;
    expect(e).toMatchObject({
      externalId: "financecalendar:us-employment-situation-non-farm-payrolls-august-2026",
      title: "US jobs report (NFP)",
      country: "United States",
      currency: "USD",
      impact: "HIGH",
      category: "EMPLOYMENT",
      allDay: false,
      actual: "-23,000 NFP vs +80,000 expec…",
      status: "RELEASED",
    });
    expect(e.eventTime.toISOString()).toBe("2026-08-07T12:30:00.000Z");
    expect(e.forecast).toBeUndefined();
    expect(e.sourceUrl).toContain("financecalendar.com/event/");
  });

  it("turns a market-holiday page into a HOLIDAY row with a clean title, decoded entities, and no bogus 'previous'", () => {
    const e = mapFinanceCalendarEvent(HOLIDAY)!;
    expect(e.impact).toBe("HOLIDAY");
    expect(e.title).toBe("Market holiday: Citizens’ Holiday (Bridge Day) (TSE/JPX)");
    expect(e.currency).toBe("JPY");
    expect(e.previous).toBeUndefined();
    expect(e.allDay).toBe(true);
  });

  it("anchors an all-day event at noon UTC so it lands on the right calendar day in every timezone", () => {
    const e = mapFinanceCalendarEvent(BOJ)!;
    expect(e.allDay).toBe(true);
    expect(e.eventTime.toISOString()).toBe("2026-10-30T12:00:00.000Z");
    expect(e.category).toBe("CENTRAL_BANK");
    expect(e.forecast).toBe("A 25bp hike to 1.25%, accord…");
    expect(e.status).toBe("SCHEDULED");
  });

  it("recognises the NYSE/NASDAQ-prefixed holiday form", () => {
    const e = mapFinanceCalendarEvent({
      ...HOLIDAY,
      name: "Thanksgiving 2026",
      title: "NYSE/NASDAQ: Thanksgiving 2026",
      url: "https://www.financecalendar.com/event/nyse-nasdaq-thanksgiving-2026/",
    })!;
    expect(e.title).toBe("Market holiday: Thanksgiving (NYSE/NASDAQ)");
    expect(e.currency).toBe("USD");
    expect(e.impact).toBe("HOLIDAY");
  });

  it("rejects a row whose timestamp doesn't parse", () => {
    expect(mapFinanceCalendarEvent({ ...NFP, time_utc: "not-a-date" })).toBeNull();
  });

  it("flags — rather than drops — an event it can't attribute to a currency", () => {
    const e = mapFinanceCalendarEvent({ ...NFP, name: "Mystery Summit", title: "Mystery Summit 2026", url: null })!;
    expect(e.currency).toBe("GLOBAL");
    expect(e.unmapped).toBe(true);
  });
});

describe("buildExternalId", () => {
  it("uses the event page slug, so a time/actual change never changes the id", () => {
    expect(buildExternalId(NFP)).toBe(buildExternalId({ ...NFP, actual: "x", time_utc: "2026-08-07T13:00:00+00:00" }));
  });

  it("falls back to date + name when a row has no url", () => {
    expect(buildExternalId({ ...NFP, url: null })).toBe("financecalendar:2026-08-07-us-jobs-report-nfp");
  });
});

describe("inferCountryCurrency", () => {
  const cases: [string, string, string][] = [
    ["UK Retail Sales October 2026", "UK Retail Sales", "GBP"],
    ["US Retail Sales October 2026", "Retail Sales", "USD"],
    ["Eurozone Flash CPI October 2026", "Eurozone Flash CPI", "EUR"],
    ["Germany Ifo Business Climate September 2026", "Germany Ifo Business Climate", "EUR"],
    ["ECB Rate Decision October 2026", "ECB decision", "EUR"],
    ["Bank of England MPC Rate Decision November 2026", "Bank of England decision", "GBP"],
    ["Canada Labour Force Survey October 2026", "Canada Labour Force Survey", "CAD"],
    ["RBNZ Rate Decision October 2026", "RBNZ Rate Decision", "NZD"],
    ["RBA Rate Decision September 2026", "RBA Rate Decision", "AUD"],
    ["SNB Rate Decision September 2026", "SNB Rate Decision", "CHF"],
    ["PBoC Loan Prime Rate September 2026", "PBoC Loan Prime Rate", "CNY"],
    ["FOMC Rate Decision October 2026", "FOMC decision", "USD"],
    ["Beige Book October 2026", "Beige Book", "USD"],
    ["Is the Stock Market Open on Thanksgiving Day 2026? TSX Hours", "Is the Stock Market Open on Thanksgiving Day 2026? TSX Hours", "CAD"],
    ["Is the Bond Market Open on Columbus Day 2026? SIFMA Hours", "Is the Bond Market Open on Columbus Day 2026? SIFMA Hours", "USD"],
  ];
  it.each(cases)("%s -> %s", (title, name, currency) => {
    expect(inferCountryCurrency(title, name)).toMatchObject({ currency, matched: true });
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes numeric, hex and named entities and leaves unknown ones alone", () => {
    expect(decodeHtmlEntities("Citizens&#8217; &amp; A&#x27;s &unknown; &lt;")).toBe("Citizens’ & A's &unknown; <");
  });
});

describe("parseFinanceCalendarResponse", () => {
  it("throws on a changed envelope so the sync fails loudly and cached data is kept", () => {
    expect(() => parseFinanceCalendarResponse({ error: "boom" })).toThrow(/unexpected response shape/);
    expect(() => parseFinanceCalendarResponse(null)).toThrow();
  });

  it("drops only the malformed rows, not the whole batch", () => {
    const { valid, rejected, total } = parseFinanceCalendarResponse({ events: [NFP, { name: "no date" }, BOJ] });
    expect(valid).toHaveLength(2);
    expect(rejected).toBe(1);
    expect(total).toBe(3);
  });
});

describe("splitDateRange", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const iso = (r: { from: Date; to: Date }) => `${r.from.toISOString().slice(0, 10)}..${r.to.toISOString().slice(0, 10)}`;

  it("keeps a range within the 92-day API limit as one request", () => {
    expect(splitDateRange(d("2026-09-20"), d("2026-12-20")).map(iso)).toEqual(["2026-09-20..2026-12-20"]); // exactly 92 days
  });

  it("splits the default 93-day sync window into two evenly sized requests", () => {
    const ranges = splitDateRange(d("2026-09-17"), d("2026-12-19"));
    expect(ranges).toHaveLength(2);
    expect(ranges[0].from.toISOString().slice(0, 10)).toBe("2026-09-17");
    expect(ranges[1].to.toISOString().slice(0, 10)).toBe("2026-12-19");
    // contiguous, no gap and no overlap
    expect(ranges[1].from.getTime() - ranges[0].to.getTime()).toBe(86_400_000);
  });

  it("splits a 120-day backfill window and never exceeds 92 days per request", () => {
    const ranges = splitDateRange(d("2026-08-21"), d("2026-12-18"));
    for (const r of ranges) expect((r.to.getTime() - r.from.getTime()) / 86_400_000 + 1).toBeLessThanOrEqual(92);
    expect(ranges.length).toBe(2);
  });

  it("returns nothing for an inverted range and one request for a single day", () => {
    expect(splitDateRange(d("2026-09-20"), d("2026-09-19"))).toEqual([]);
    expect(splitDateRange(d("2026-09-20"), d("2026-09-20")).map(iso)).toEqual(["2026-09-20..2026-09-20"]);
  });
});
