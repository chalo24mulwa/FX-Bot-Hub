import { z } from "zod";
import type { EventCategory, EventImpact } from "@prisma/client";
import type { CalendarEventInput } from "./types";
import { mapCategory } from "./authorized-provider-mapping";

// Pure request/response mapping for FinanceCalendarProvider — no env, DB or
// network, so it's unit-testable against real captured payloads (see
// financecalendar-mapping.test.ts). Same split as authorized-provider-mapping.ts.
//
// Finance Calendar (https://www.financecalendar.com/api/) is a free,
// key-less JSON feed. Its shape differs from a classic per-currency forex
// calendar in ways this file has to bridge, all verified against the live API:
//   * no id, country or currency field  -> id comes from the event page URL
//     slug; country/currency are inferred from the event's name/title
//   * `actual` / `consensus` / `prior` are free text, e.g. "-23,000 NFP vs
//     +80,000 expec…" (the feed truncates them itself), not clean numbers
//   * `consensus` is only filled ~2 days before a release, so Forecast is
//     legitimately empty for most upcoming rows
//   * some rows are market-holiday pages ("Is the Stock Market Open on …")
//   * `all_day: true` rows have no time_utc

export const FINANCECALENDAR_PROVIDER_KEY = "financecalendar";
export const FINANCECALENDAR_ATTRIBUTION = { name: "Finance Calendar", url: "https://www.financecalendar.com" } as const;

/** Documented API limits: `limit` max 500 (default 100 — silently truncates!), range max 92 days. */
export const FINANCECALENDAR_MAX_LIMIT = 500;
export const FINANCECALENDAR_MAX_RANGE_DAYS = 92;

const nullableText = z.union([z.string(), z.number()]).nullable().optional();

const RawEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_utc: z.string().nullable().optional(),
  all_day: z.boolean().nullable().optional(),
  name: z.string().min(1),
  title: z.string().nullable().optional(),
  impact: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  consensus: nullableText,
  prior: nullableText,
  actual: nullableText,
  url: z.string().nullable().optional(),
});
export type RawFinanceCalendarEvent = z.infer<typeof RawEventSchema>;

const ResponseSchema = z.object({ events: z.array(z.unknown()) });

/** Validates the response envelope (throws if the API changed shape — the
 * sync then fails loudly and keeps serving cached data) and each row
 * separately (one malformed row never drops the rest). */
export function parseFinanceCalendarResponse(payload: unknown): {
  valid: RawFinanceCalendarEvent[];
  rejected: number;
  total: number;
} {
  const envelope = ResponseSchema.safeParse(payload);
  if (!envelope.success) {
    throw new Error("Finance Calendar returned an unexpected response shape (no 'events' array).");
  }
  const valid: RawFinanceCalendarEvent[] = [];
  let rejected = 0;
  for (const row of envelope.data.events) {
    const parsed = RawEventSchema.safeParse(row);
    if (parsed.success) valid.push(parsed.data);
    else rejected += 1;
  }
  return { valid, rejected, total: envelope.data.events.length };
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** The feed HTML-encodes text (`Citizens&#8217; Holiday`) even though it's JSON. */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function cleanText(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = decodeHtmlEntities(String(value)).replace(/\s+/g, " ").trim();
  return text === "" ? undefined : text;
}

export function mapFinanceCalendarImpact(impact: string | null | undefined): EventImpact {
  switch ((impact ?? "").toLowerCase()) {
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    case "low":
      return "LOW";
    default:
      return "OTHER";
  }
}

// --- country / currency inference -------------------------------------------
// Ordered: first match wins, most specific first (UK before generic
// "Retail Sales", a Canadian exchange before "Thanksgiving"). Matched
// against `${title} ${name}`. The feed's US releases usually carry a "US"
// prefix in `title` ("US Retail Sales October 2026") — the trailing US
// keyword rule covers the ones that don't.
const COUNTRY_RULES: { pattern: RegExp; country: string; currency: string }[] = [
  { pattern: /\bECB\b|euro\s?zone|euro area/i, country: "Euro Area", currency: "EUR" },
  { pattern: /germany|\bifo\b/i, country: "Germany", currency: "EUR" },
  { pattern: /\bUK\b|bank of england|\bBoE\b|\bMPC\b/i, country: "United Kingdom", currency: "GBP" },
  { pattern: /japan|\bBoJ\b|TSE\/JPX/i, country: "Japan", currency: "JPY" },
  { pattern: /new zealand|\bRBNZ\b/i, country: "New Zealand", currency: "NZD" },
  { pattern: /australia|\bRBA\b|\bASX\b/i, country: "Australia", currency: "AUD" },
  { pattern: /canada|\bTSX\b/i, country: "Canada", currency: "CAD" },
  { pattern: /switzerland|swiss|\bSNB\b|\bSIX\b/i, country: "Switzerland", currency: "CHF" },
  { pattern: /norges|norway/i, country: "Norway", currency: "NOK" },
  { pattern: /riksbank|sweden/i, country: "Sweden", currency: "SEK" },
  { pattern: /china|\bPBoC\b|caixin/i, country: "China", currency: "CNY" },
  { pattern: /\bHKEX\b|hong kong/i, country: "Hong Kong", currency: "HKD" },
  { pattern: /NSE India|india/i, country: "India", currency: "INR" },
  {
    pattern:
      /\bUS\b|\bU\.S\.|FOMC|federal reserve|\bFed\b|beige book|jackson hole|NYSE|nasdaq|SIFMA|\bCME\b|bond market hours|thanksgiving|\bISM\b|JOLTS|\bADP\b|jobless claims|michigan|\bPCE\b|\bPPI\b|housing starts|home sales|industrial production|trade balance|consumer confidence|retail sales|non-farm/i,
    country: "United States",
    currency: "USD",
  },
];

/** The feed carries no country/currency, so an event none of the rules
 * recognise is kept (never dropped) under a neutral "Global" bucket — and
 * counted by the caller so it shows up in logs instead of vanishing. */
export const UNMAPPED_COUNTRY = { country: "Global", currency: "GLOBAL" } as const;

export function inferCountryCurrency(title: string, name: string): { country: string; currency: string; matched: boolean } {
  const haystack = `${title} ${name}`;
  for (const rule of COUNTRY_RULES) {
    if (rule.pattern.test(haystack)) return { country: rule.country, currency: rule.currency, matched: true };
  }
  return { ...UNMAPPED_COUNTRY, matched: false };
}

// --- market-holiday rows ------------------------------------------------------
// "Is the Stock Market Open on Respect for the Aged Day 2026? TSE/JPX Hours"
// and "Thanksgiving 2026" (title "NYSE/NASDAQ: Thanksgiving 2026") are
// closures/holidays, not data releases.
const HOLIDAY_QUESTION = /^is the (?:stock|bond) market open on (.+?) \d{4}\?\s*(.+?)\s+hours$/i;
const HOLIDAY_EXCHANGE_PREFIX = /^(NYSE\/NASDAQ):\s*(.+?)(?:\s+\d{4})?$/i;

export function parseHoliday(name: string, title: string): { label: string; venue: string } | null {
  const question = name.match(HOLIDAY_QUESTION);
  if (question) return { label: question[1], venue: question[2] };
  const prefixed = title.match(HOLIDAY_EXCHANGE_PREFIX);
  if (prefixed) return { label: prefixed[2], venue: prefixed[1] };
  return null;
}

function mapFinanceCalendarCategory(raw: RawFinanceCalendarEvent, name: string): EventCategory {
  if (raw.category === "central-banks-monetary-policy") return "CENTRAL_BANK";
  const mapped = mapCategory(raw.category ?? undefined, name);
  if (mapped !== "OTHER") return mapped;
  // The shared keyword table has no "labour"/"jobs" (UK/Canada/Australia
  // spell it that way) — cover them here so those employment releases
  // aren't filed under "Other".
  return /labou?r|\bjobs\b/i.test(name) ? "EMPLOYMENT" : "OTHER";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable per-event id — the feed has none. The event page URL slug
 * ("us-cpi-report-october-2026") is unique per release and stable across
 * time/actual/consensus changes; fall back to date+name only if a row
 * arrives without a URL. */
export function buildExternalId(raw: RawFinanceCalendarEvent): string {
  const path = (raw.url ?? "").match(/\/event\/([^/?#]+)/);
  const slug = path ? path[1] : `${raw.date}-${slugify(raw.name)}`;
  return `${FINANCECALENDAR_PROVIDER_KEY}:${slug}`;
}

export type MappedFinanceCalendarEvent = CalendarEventInput & { unmapped?: true };

/** Returns null for a row whose timestamp doesn't parse (rejected + counted by the caller). */
export function mapFinanceCalendarEvent(raw: RawFinanceCalendarEvent): MappedFinanceCalendarEvent | null {
  const allDay = raw.all_day === true || !raw.time_utc;
  // All-day rows get a noon-UTC anchor: noon UTC is the same calendar day
  // in every timezone from UTC-11 to UTC+11, so the row groups under the
  // right date wherever the viewer is (midnight UTC would slide to the
  // previous day for anyone west of Greenwich).
  const eventTime = new Date(allDay ? `${raw.date}T12:00:00Z` : (raw.time_utc as string));
  if (Number.isNaN(eventTime.getTime())) return null;

  const name = cleanText(raw.name) ?? raw.name;
  const fullTitle = cleanText(raw.title) ?? name;
  const holiday = parseHoliday(name, fullTitle);
  const { country, currency, matched } = inferCountryCurrency(fullTitle, name);

  const actual = cleanText(raw.actual);

  const event: MappedFinanceCalendarEvent = {
    externalId: buildExternalId(raw),
    country,
    currency,
    title: holiday ? `Market holiday: ${holiday.label} (${holiday.venue})` : name,
    impact: holiday ? "HOLIDAY" : mapFinanceCalendarImpact(raw.impact),
    category: holiday ? "OTHER" : mapFinanceCalendarCategory(raw, name),
    eventTime,
    allDay,
    actual,
    forecast: cleanText(raw.consensus),
    // A holiday's "prior" is prose about the exchange calendar, not a
    // previous reading — leaving it in the Previous column would be noise.
    previous: holiday ? undefined : cleanText(raw.prior),
    description: fullTitle,
    sourceUrl: cleanText(raw.url),
    status: actual ? "RELEASED" : "SCHEDULED",
  };
  if (!matched) event.unmapped = true;
  return event;
}

// --- request-range helpers -------------------------------------------------------

/** UTC calendar date as the API expects it (YYYY-MM-DD). */
export function formatApiDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Splits [from, to] into the fewest, evenly-sized inclusive date ranges of
 * at most `maxDays` days each — the API limits ranges to 92 days, and the
 * default sync window (3 days back + 90 ahead) is 93 days. Pure.
 */
export function splitDateRange(from: Date, to: Date, maxDays = FINANCECALENDAR_MAX_RANGE_DAYS): { from: Date; to: Date }[] {
  const DAY = 86_400_000;
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  if (end < start) return [];
  const totalDays = Math.round((end - start) / DAY) + 1;
  const parts = Math.ceil(totalDays / maxDays);
  const size = Math.ceil(totalDays / parts);
  const ranges: { from: Date; to: Date }[] = [];
  for (let offset = 0; offset < totalDays; offset += size) {
    const last = Math.min(offset + size - 1, totalDays - 1);
    ranges.push({ from: new Date(start + offset * DAY), to: new Date(start + last * DAY) });
  }
  return ranges;
}
