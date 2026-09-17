import { describe, expect, it } from "vitest";
import {
  mapBarToTVBar,
  mapInstrumentToSearchResult,
  mapInstrumentToSymbolInfo,
  mapIntervalToResolution,
  mapResolutionToInterval,
  TV_SUPPORTED_RESOLUTIONS,
} from "./resolution-mapping";
import type { BarInterval } from "@/lib/market-data/types";

describe("resolution <-> interval mapping", () => {
  it("round-trips every supported interval through a TradingView resolution", () => {
    const intervals: BarInterval[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"];
    for (const interval of intervals) {
      const resolution = mapIntervalToResolution(interval);
      expect(mapResolutionToInterval(resolution)).toBe(interval);
    }
  });

  it("maps intraday resolutions to plain minute strings", () => {
    expect(mapIntervalToResolution("1h")).toBe("60");
    expect(mapIntervalToResolution("4h")).toBe("240");
  });

  it("maps daily/weekly/monthly to TradingView's letter-suffixed resolutions", () => {
    expect(mapIntervalToResolution("1d")).toBe("1D");
    expect(mapIntervalToResolution("1w")).toBe("1W");
    expect(mapIntervalToResolution("1M")).toBe("1M");
  });

  it("returns null for an unrecognized resolution instead of throwing", () => {
    expect(mapResolutionToInterval("banana")).toBeNull();
  });

  it("every supported resolution maps back to a real interval", () => {
    for (const resolution of TV_SUPPORTED_RESOLUTIONS) {
      expect(mapResolutionToInterval(resolution)).not.toBeNull();
    }
  });
});

describe("mapInstrumentToSearchResult", () => {
  it("maps asset class to TradingView's lowercase type", () => {
    const result = mapInstrumentToSearchResult({ symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "FOREX" });
    expect(result).toEqual({ symbol: "EUR/USD", full_name: "EUR/USD", description: "Euro / US Dollar", exchange: "", ticker: "EUR/USD", type: "forex" });
  });
});

describe("mapInstrumentToSymbolInfo", () => {
  it("builds a symbol info with the full supported-resolution list", () => {
    const info = mapInstrumentToSymbolInfo({ symbol: "AAPL", name: "Apple Inc", assetClass: "STOCK", exchange: "NASDAQ" });
    expect(info.ticker).toBe("AAPL");
    expect(info.type).toBe("stock");
    expect(info.exchange).toBe("NASDAQ");
    expect(info.supported_resolutions).toEqual(TV_SUPPORTED_RESOLUTIONS);
  });
});

describe("mapBarToTVBar", () => {
  it("converts seconds to milliseconds and keeps OHLCV fields", () => {
    const tvBar = mapBarToTVBar({ time: 1700000000, open: 1.1, high: 1.2, low: 1.05, close: 1.15, volume: 42 });
    expect(tvBar).toEqual({ time: 1700000000000, open: 1.1, high: 1.2, low: 1.05, close: 1.15, volume: 42 });
  });
});
