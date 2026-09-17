import { z } from "zod";
import type { AssetClass, Bar, InstrumentSummary, Quote } from "../types";

// Pure request/response mapping for Twelve Data's REST + WebSocket APIs —
// no @/lib/env import (see authorized-provider-mapping.ts's identical
// reasoning in the calendar provider: importing env.ts eagerly parses
// process.env, which would force every test of this pure logic to also
// stub DATABASE_URL/AUTH_SECRET). twelvedata-provider.ts is the sibling
// I/O half.
//
// Shapes below are built from Twelve Data's public API documentation
// (https://twelvedata.com/docs), not yet exercised against a live,
// authenticated account — this environment has no MARKET_DATA_API_KEY
// (see CLAUDE.md's "Known follow-ups"). Re-verify field names/values
// against a real response before enabling MARKET_DATA_PROVIDER=twelvedata
// in production, the same caution as AuthorizedCalendarProvider's own
// doc comment.

// ---------- Interval mapping ----------

import type { BarInterval } from "../types";

export const TWELVE_DATA_INTERVAL: Record<BarInterval, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
  "1M": "1month",
};

/** Every interval this mapping supports — Twelve Data's own plan/endpoint
 * restrictions (e.g. intraday intervals needing a paid plan) aren't
 * encoded here since they can't be confirmed without a live account; see
 * this file's doc comment. */
export const SUPPORTED_INTERVALS: BarInterval[] = Object.keys(TWELVE_DATA_INTERVAL) as BarInterval[];

// ---------- Asset class mapping ----------

/** Twelve Data's `instrument_type` field on /symbol_search and /quote
 * responses. Best-effort mapping — see this file's doc comment. */
export function mapInstrumentType(instrumentType: string | null | undefined): AssetClass {
  const t = (instrumentType ?? "").toLowerCase();
  if (t.includes("currency") && !t.includes("digital")) return "FOREX";
  if (t.includes("digital currency") || t.includes("crypto")) return "OTHER";
  if (t.includes("index")) return "INDEX";
  if (t.includes("etf") || t.includes("stock") || t.includes("equity")) return "STOCK";
  return "OTHER";
}

/** Metals/commodities don't have a distinct Twelve Data instrument_type in
 * the documented symbol_search shape — they surface as "Physical Currency"
 * (e.g. XAU/USD, XAG/USD) alongside real forex pairs. Recognized by a
 * known-symbol prefix list rather than guessed from instrument_type, kept
 * short and explicit rather than a heuristic that might misclassify a
 * real currency pair. */
const METAL_COMMODITY_BASES = new Set(["XAU", "XAG", "XPT", "XPD"]);

export function mapAssetClass(symbol: string, instrumentType: string | null | undefined): AssetClass {
  const base = symbol.split("/")[0]?.toUpperCase();
  if (base && METAL_COMMODITY_BASES.has(base)) return "METAL";
  return mapInstrumentType(instrumentType);
}

// ---------- /symbol_search ----------

const SymbolSearchRowSchema = z.object({
  symbol: z.string(),
  instrument_name: z.string().optional().default(""),
  exchange: z.string().nullable().optional(),
  instrument_type: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
});

const SymbolSearchResponseSchema = z.object({
  data: z.array(SymbolSearchRowSchema).optional().default([]),
});

export function parseSymbolSearchResponse(payload: unknown): InstrumentSummary[] {
  const parsed = SymbolSearchResponseSchema.safeParse(payload);
  if (!parsed.success) return [];
  return parsed.data.data.map((row) => ({
    symbol: row.symbol,
    name: row.instrument_name || row.symbol,
    assetClass: mapAssetClass(row.symbol, row.instrument_type),
    exchange: row.exchange ?? undefined,
    currency: row.currency ?? undefined,
  }));
}

/** Twelve Data's symbol_search for a bare 3-letter code (e.g. "EUR",
 * "XAU") returns up to ~30 results with no relevance ranking — matches
 * across every asset type (stock tickers, warrants, ETFs...) alongside
 * every currency pair with that base, and a common pair like "EUR/USD"
 * can easily not make the cut at all (verified live: searching "EUR"
 * does not return EUR/USD in the first 30 results, while searching
 * "EUR/USD" directly returns it as the very first result). Detected
 * here so the provider can additionally search "<code>/USD" and merge
 * that exact match to the front — the single most useful default quote
 * currency for a bare base-currency query, matching how most retail
 * platforms handle this. Only fires for a plain 3-letter alphabetic
 * query with no "/" already in it (a real pair or a stock ticker like
 * "AAPL" is left alone). */
export function isBareCurrencyCode(query: string): boolean {
  return /^[A-Za-z]{3}$/.test(query.trim());
}

export function buildUsdPairQuery(query: string): string {
  return `${query.trim().toUpperCase()}/USD`;
}

/** Merges a base search's results with an augmented "<code>/USD" search's
 * results (see isBareCurrencyCode), promoting an exact "<code>/USD" match
 * to the front and deduping by symbol — pure so the merge order is
 * unit-testable without a network call. */
export function mergeWithUsdPairFirst(baseResults: InstrumentSummary[], usdPairResults: InstrumentSummary[], usdPairSymbol: string): InstrumentSummary[] {
  const exactMatch = usdPairResults.find((r) => r.symbol.toUpperCase() === usdPairSymbol.toUpperCase());
  if (!exactMatch) return baseResults;
  const rest = baseResults.filter((r) => r.symbol.toUpperCase() !== usdPairSymbol.toUpperCase());
  return [exactMatch, ...rest];
}

// ---------- /time_series ----------

const TimeSeriesRowSchema = z.object({
  datetime: z.string(),
  open: z.coerce.number(),
  high: z.coerce.number(),
  low: z.coerce.number(),
  close: z.coerce.number(),
  volume: z.coerce.number().optional(),
});

const TimeSeriesResponseSchema = z.object({
  values: z.array(TimeSeriesRowSchema).optional().default([]),
  status: z.string().optional(),
});

/** Twelve Data's `datetime` is a naive "YYYY-MM-DD HH:mm:ss" (intraday) or
 * "YYYY-MM-DD" (daily/weekly/monthly) string in UTC, with no timezone
 * suffix — normalized to ISO-8601 UTC before parsing so it doesn't get
 * silently misinterpreted as the server's local time. */
function parseTwelveDataDatetime(datetime: string): number {
  const iso = datetime.includes("T")
    ? datetime
    : datetime.includes(" ")
      ? datetime.replace(" ", "T")
      : `${datetime}T00:00:00`;
  return Math.floor(Date.parse(`${iso}Z`) / 1000);
}

/** Twelve Data returns `values` newest-first — reversed to chronological
 * order, since that's what a charting library expects to plot. */
export function parseTimeSeriesResponse(payload: unknown): Bar[] {
  const parsed = TimeSeriesResponseSchema.safeParse(payload);
  if (!parsed.success) return [];
  return parsed.data.values
    .map((row) => ({
      time: parseTwelveDataDatetime(row.datetime),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }))
    .filter((bar) => Number.isFinite(bar.time))
    .sort((a, b) => a.time - b.time);
}

// ---------- /quote ----------

const QuoteResponseSchema = z.object({
  symbol: z.string(),
  close: z.coerce.number(),
  change: z.coerce.number().optional(),
  percent_change: z.coerce.number().optional(),
  timestamp: z.coerce.number().optional(),
});

export function parseQuoteResponse(payload: unknown): Quote | null {
  const parsed = QuoteResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  return {
    symbol: parsed.data.symbol,
    price: parsed.data.close,
    change: parsed.data.change ?? 0,
    changePercent: parsed.data.percent_change ?? 0,
    timestamp: parsed.data.timestamp ?? Math.floor(Date.now() / 1000),
  };
}

// ---------- WebSocket price events ----------

const WsPriceEventSchema = z.object({
  event: z.literal("price"),
  symbol: z.string(),
  price: z.coerce.number(),
  timestamp: z.coerce.number().optional(),
});

export interface ParsedWsPriceEvent {
  symbol: string;
  price: number;
  timestampSeconds: number;
}

/** Returns null for anything that isn't a price tick (subscribe-status
 * acks, heartbeats, malformed frames) — the caller should simply ignore
 * those, not treat them as an error. */
export function parseWsMessage(raw: string): ParsedWsPriceEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = WsPriceEventSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    symbol: parsed.data.symbol,
    price: parsed.data.price,
    timestampSeconds: parsed.data.timestamp ?? Math.floor(Date.now() / 1000),
  };
}
