// Minimal local declarations for the subset of TradingView's Charting
// Library "Datafeed API" this adapter implements — NOT copied from
// TradingView's own charting_library.d.ts (that file ships inside the
// private, license-gated repo TradingView grants after approving an
// application; it isn't in this project yet — see CLAUDE.md's
// "TradingView Advanced Charting Library" section). Hand-written against
// TradingView's public Datafeed API documentation, which has been a
// stable, widely-documented shape for years. Once the real
// charting_library package is added to this project (its own
// `charting_library/charting_library.d.ts`), prefer importing its actual
// types here instead of these — this file exists only so the adapter can
// be built and unit-tested before those files are available.

export type TVResolution = string; // "1" | "5" | "15" | "30" | "60" | "240" | "1D" | "1W" | "1M"

export interface TVDatafeedConfiguration {
  supported_resolutions: TVResolution[];
  supports_search: boolean;
  supports_group_request: boolean;
  exchanges: { value: string; name: string; desc: string }[];
  symbols_types: { name: string; value: string }[];
}

export interface TVSearchSymbolResultItem {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker: string;
  type: string;
}

export interface TVLibrarySymbolInfo {
  ticker: string;
  name: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  format: "price" | "volume";
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: TVResolution[];
  volume_precision: number;
  data_status: "streaming" | "endofday" | "pulsed";
}

export interface TVBar {
  time: number; // ms, unlike this app's internal Bar.time (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TVPeriodParams {
  from: number; // seconds
  to: number; // seconds
  countBack: number;
  firstDataRequest: boolean;
}

export type TVOnReadyCallback = (config: TVDatafeedConfiguration) => void;
export type TVSearchSymbolsCallback = (results: TVSearchSymbolResultItem[]) => void;
export type TVResolveCallback = (symbolInfo: TVLibrarySymbolInfo) => void;
export type TVErrorCallback = (reason: string) => void;
export type TVHistoryCallback = (bars: TVBar[], meta: { noData: boolean }) => void;
export type TVSubscribeBarsCallback = (bar: TVBar) => void;

/** The subset of IBasicDataFeed this adapter implements — every method
 * TradingView's Charting Library actually calls for a live, searchable
 * chart. See createDatafeed() in ./create-datafeed.ts. */
export interface TVDatafeed {
  onReady(callback: TVOnReadyCallback): void;
  searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: TVSearchSymbolsCallback): void;
  resolveSymbol(symbolName: string, onResolve: TVResolveCallback, onError: TVErrorCallback): void;
  getBars(
    symbolInfo: TVLibrarySymbolInfo,
    resolution: TVResolution,
    periodParams: TVPeriodParams,
    onResult: TVHistoryCallback,
    onError: TVErrorCallback
  ): void;
  subscribeBars(
    symbolInfo: TVLibrarySymbolInfo,
    resolution: TVResolution,
    onTick: TVSubscribeBarsCallback,
    listenerGuid: string,
    onResetCacheNeededCallback: () => void
  ): void;
  unsubscribeBars(listenerGuid: string): void;
}
