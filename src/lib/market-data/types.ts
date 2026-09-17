// MarketDataProvider abstraction for the homepage hero chart — mirrors the
// payments/storage/email/calendar provider pattern (see CLAUDE.md's
// "Provider abstractions" section): a typed interface here, a real
// implementation per provider under ./providers, selected by
// MARKET_DATA_PROVIDER (src/lib/env.ts). Swapping providers later means
// adding a new file under ./providers and registering it in
// ./providers/index.ts — never rewriting the chart or API routes that
// call this interface.

export type AssetClass = "FOREX" | "METAL" | "COMMODITY" | "STOCK" | "INDEX" | "OTHER";

// Only the intervals a provider actually supports should be offered in the
// UI — see MarketDataProvider.supportedIntervals below, not a fixed list
// assumed to work for every provider.
export type BarInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w" | "1M";

export interface InstrumentSummary {
  /** Provider-native symbol string (e.g. "EUR/USD", "XAU/USD", "AAPL"). */
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange?: string;
  currency?: string;
}

export interface Bar {
  /** Unix seconds (UTC) — matches lightweight-charts' `time` field directly. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  /** Unix seconds (UTC). */
  timestamp: number;
}

/** A single live bar update pushed to a subscriber — same shape as a
 * historical Bar so the chart can append/update it with one code path. */
export type BarUpdate = Bar;

export interface MarketDataProvider {
  readonly key: string;
  readonly supportedIntervals: BarInterval[];

  searchSymbols(query: string): Promise<InstrumentSummary[]>;
  resolveSymbol(symbol: string): Promise<InstrumentSummary | null>;
  getHistoricalBars(symbol: string, interval: BarInterval, from: Date, to: Date): Promise<Bar[]>;
  getLatestQuote(symbol: string): Promise<Quote | null>;

  /** Starts streaming live bar updates for one symbol/interval; returns a
   * subscription id to pass to unsubscribeBars(). Multiple callers
   * subscribing to the same symbol/interval share one upstream connection
   * (see the provider's own doc comment) — this is reference-counted, not
   * one upstream connection per subscriber. */
  subscribeBars(symbol: string, interval: BarInterval, onUpdate: (bar: BarUpdate) => void): string;
  unsubscribeBars(subscriptionId: string): void;
}
