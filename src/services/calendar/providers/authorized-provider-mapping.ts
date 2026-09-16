import { z } from "zod";
import type { EventCategory, EventImpact, EconomicEventStatus } from "@prisma/client";
import type { CalendarEventInput } from "./types";

// Pure request/response mapping for AuthorizedCalendarProvider, split out
// from that file (which needs @/lib/env for real HTTP calls) specifically
// so this half stays unit-testable with no env/DB dependency at all — same
// reasoning as calendar-service's buildEventWhere and sync-service's
// shouldDispatchHighImpactAlert/detectFieldChanges.

const RawEventSchema = z.object({
  CalendarId: z.union([z.string(), z.number()]),
  Date: z.string(), // ISO 8601, provider's own local time for the release
  Country: z.string(),
  Currency: z.string().optional(),
  Category: z.string().optional(),
  Event: z.string(),
  Reference: z.string().optional(),
  Source: z.string().optional(),
  SourceURL: z.string().optional(),
  URL: z.string().optional(),
  Actual: z.union([z.string(), z.number()]).nullable().optional(),
  Previous: z.union([z.string(), z.number()]).nullable().optional(),
  Forecast: z.union([z.string(), z.number()]).nullable().optional(),
  Unit: z.string().optional(),
  Importance: z.union([z.string(), z.number()]).nullable().optional(),
});
export type RawCalendarEvent = z.infer<typeof RawEventSchema>;

/** Rejects malformed records instead of throwing on the whole batch — one
 * bad row from the provider must not fail every other row's sync (spec's
 * data-validation requirement). Returns the valid rows and a reject count. */
export function validateRawEvents(payload: unknown): { valid: RawCalendarEvent[]; rejected: number } {
  const arr = Array.isArray(payload) ? payload : [];
  const valid: RawCalendarEvent[] = [];
  let rejected = 0;
  for (const row of arr) {
    const parsed = RawEventSchema.safeParse(row);
    if (parsed.success) valid.push(parsed.data);
    else rejected += 1;
  }
  return { valid, rejected };
}

const IMPORTANCE_TO_IMPACT: Record<string, EventImpact> = {
  "0": "LOW",
  "1": "LOW",
  "2": "MEDIUM",
  "3": "HIGH",
};

export function mapImpact(importance: RawCalendarEvent["Importance"]): EventImpact {
  if (importance === null || importance === undefined) return "OTHER";
  return IMPORTANCE_TO_IMPACT[String(importance)] ?? "OTHER";
}

const CATEGORY_KEYWORDS: [RegExp, EventCategory][] = [
  [/central bank|interest rate|rate decision|monetary policy/i, "CENTRAL_BANK"],
  [/employ|payroll|jobless|unemployment|nfp/i, "EMPLOYMENT"],
  [/cpi|inflation|price index|ppi/i, "INFLATION"],
  [/gdp|gross domestic/i, "GDP"],
  [/manufactur|pmi|industrial production|factory/i, "MANUFACTURING"],
  [/retail sales/i, "RETAIL"],
  [/housing|building permit|home sales/i, "HOUSING"],
  [/consumer confidence|consumer sentiment/i, "CONSUMER"],
  [/election|parliament|referendum|government/i, "POLITICS"],
];

export function mapCategory(category: string | undefined, event: string): EventCategory {
  const haystack = `${category ?? ""} ${event}`;
  for (const [pattern, mapped] of CATEGORY_KEYWORDS) {
    if (pattern.test(haystack)) return mapped;
  }
  return "OTHER";
}

/** SCHEDULED once actual is populated -> RELEASED; the provider doesn't
 * report cancellation directly (most licensed feeds don't), so
 * CANCELLED/POSTPONED are only ever set by sync-service's own
 * disappeared-from-window detection, never inferred here. */
function inferStatus(actual: string | null): EconomicEventStatus {
  return actual ? "RELEASED" : "SCHEDULED";
}

function toStringOrUndefined(v: string | number | null | undefined): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v);
}

// Minimal fallback so a provider row is never dropped for lacking an
// explicit currency (some releases, e.g. EU-wide ones, report only a
// country/region). Deliberately small — only the handful of
// currencies/regions this spec calls out; anything else keeps its raw
// country string and gets filtered out of currency-based views, not
// crashed on.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  "united states": "USD",
  "euro area": "EUR",
  "european union": "EUR",
  germany: "EUR",
  france: "EUR",
  "united kingdom": "GBP",
  japan: "JPY",
  australia: "AUD",
  "new zealand": "NZD",
  canada: "CAD",
  switzerland: "CHF",
  china: "CNY",
};

function inferCurrencyFromCountry(country: string): string {
  return COUNTRY_TO_CURRENCY[country.trim().toLowerCase()] ?? country.slice(0, 3).toUpperCase();
}

export function toCalendarEventInput(raw: RawCalendarEvent): CalendarEventInput {
  const actual = toStringOrUndefined(raw.Actual) ?? null;
  return {
    externalId: `authorized:${raw.CalendarId}`,
    country: raw.Country,
    currency: (raw.Currency ?? "").toUpperCase() || inferCurrencyFromCountry(raw.Country),
    title: raw.Event,
    impact: mapImpact(raw.Importance),
    category: mapCategory(raw.Category, raw.Event),
    eventTime: new Date(raw.Date),
    actual: actual ?? undefined,
    forecast: toStringOrUndefined(raw.Forecast),
    previous: toStringOrUndefined(raw.Previous),
    description: raw.Reference ? `Reference period: ${raw.Reference}` : undefined,
    unit: raw.Unit,
    sourceUrl: raw.SourceURL ?? (raw.URL ? `https://tradingeconomics.com${raw.URL}` : undefined),
    status: inferStatus(actual),
  };
}
