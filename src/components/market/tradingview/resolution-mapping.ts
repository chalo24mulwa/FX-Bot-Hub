import type { AssetClass, Bar, InstrumentSummary } from "@/lib/market-data/types";
import type { BarInterval } from "@/lib/market-data/types";
import type { TVBar, TVLibrarySymbolInfo, TVResolution, TVSearchSymbolResultItem } from "./types";

// Pure mapping between this app's own MarketDataProvider shapes
// (src/lib/market-data/types.ts) and TradingView's Datafeed shapes — no
// fetch/EventSource here, so it's unit-testable without a DOM or network
// (same "pure logic split from I/O" pattern as twelvedata-mapping.ts).

const RESOLUTION_TO_INTERVAL: Record<TVResolution, BarInterval> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "240": "4h",
  "1D": "1d",
  "1W": "1w",
  "1M": "1M",
};

const INTERVAL_TO_RESOLUTION: Record<BarInterval, TVResolution> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "1D",
  "1w": "1W",
  "1M": "1M",
};

export const TV_SUPPORTED_RESOLUTIONS: TVResolution[] = Object.keys(RESOLUTION_TO_INTERVAL);

export function mapResolutionToInterval(resolution: TVResolution): BarInterval | null {
  return RESOLUTION_TO_INTERVAL[resolution] ?? null;
}

export function mapIntervalToResolution(interval: BarInterval): TVResolution {
  return INTERVAL_TO_RESOLUTION[interval];
}

const ASSET_CLASS_TO_TV_TYPE: Record<AssetClass, string> = {
  FOREX: "forex",
  METAL: "metal",
  COMMODITY: "commodity",
  STOCK: "stock",
  INDEX: "index",
  OTHER: "other",
};

export function mapInstrumentToSearchResult(instrument: InstrumentSummary): TVSearchSymbolResultItem {
  return {
    symbol: instrument.symbol,
    full_name: instrument.symbol,
    description: instrument.name,
    exchange: instrument.exchange ?? "",
    ticker: instrument.symbol,
    type: ASSET_CLASS_TO_TV_TYPE[instrument.assetClass],
  };
}

/** `minmov`/`pricescale` (tick size) default to a 5-decimal forex
 * convention (pricescale 100000) — correct for most forex pairs, an
 * approximation for metals/stocks/indices. Twelve Data's symbol_search
 * response doesn't carry a decimal-places field, so getting this exactly
 * right per instrument needs either a lookup table or a provider response
 * this app hasn't verified against a live account yet (see
 * twelvedata-mapping.ts's doc comment) — a known simplification, not a
 * silent guess dressed up as fact. */
export function mapInstrumentToSymbolInfo(instrument: InstrumentSummary): TVLibrarySymbolInfo {
  return {
    ticker: instrument.symbol,
    name: instrument.symbol,
    description: instrument.name,
    type: ASSET_CLASS_TO_TV_TYPE[instrument.assetClass],
    session: "24x7",
    timezone: "Etc/UTC",
    exchange: instrument.exchange ?? "",
    listed_exchange: instrument.exchange ?? "",
    format: "price",
    minmov: 1,
    pricescale: 100000,
    has_intraday: true,
    has_weekly_and_monthly: true,
    supported_resolutions: TV_SUPPORTED_RESOLUTIONS,
    volume_precision: 0,
    data_status: "streaming",
  };
}

export function mapBarToTVBar(bar: Bar): TVBar {
  return { time: bar.time * 1000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}
