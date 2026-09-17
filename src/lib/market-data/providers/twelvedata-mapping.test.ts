import { describe, expect, it } from "vitest";
import {
  mapAssetClass,
  parseQuoteResponse,
  parseSymbolSearchResponse,
  parseTimeSeriesResponse,
  parseWsMessage,
  SUPPORTED_INTERVALS,
  TWELVE_DATA_INTERVAL,
} from "./twelvedata-mapping";

describe("mapAssetClass", () => {
  it("classifies a metal/commodity symbol by its base currency code", () => {
    expect(mapAssetClass("XAU/USD", "Physical Currency")).toBe("METAL");
    expect(mapAssetClass("XAG/USD", "Physical Currency")).toBe("METAL");
  });

  it("classifies a real forex pair as FOREX, not METAL", () => {
    expect(mapAssetClass("EUR/USD", "Physical Currency")).toBe("FOREX");
  });

  it("classifies a common stock as STOCK", () => {
    expect(mapAssetClass("AAPL", "Common Stock")).toBe("STOCK");
  });

  it("classifies an index as INDEX", () => {
    expect(mapAssetClass("SPX", "Index")).toBe("INDEX");
  });

  it("falls back to OTHER for an unrecognized type", () => {
    expect(mapAssetClass("BTC/USD", "Digital Currency")).toBe("OTHER");
  });
});

describe("parseSymbolSearchResponse", () => {
  it("maps a well-formed response", () => {
    const result = parseSymbolSearchResponse({
      data: [
        { symbol: "EUR/USD", instrument_name: "Euro/US Dollar", exchange: "Physical Currency", instrument_type: "Physical Currency" },
        { symbol: "AAPL", instrument_name: "Apple Inc", exchange: "NASDAQ", instrument_type: "Common Stock", currency: "USD" },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ symbol: "EUR/USD", name: "Euro/US Dollar", assetClass: "FOREX", exchange: "Physical Currency", currency: undefined });
    expect(result[1].assetClass).toBe("STOCK");
  });

  it("returns an empty array for a malformed payload rather than throwing", () => {
    expect(parseSymbolSearchResponse({ unexpected: true })).toEqual([]);
    expect(parseSymbolSearchResponse(null)).toEqual([]);
  });
});

describe("parseTimeSeriesResponse", () => {
  it("parses intraday rows and returns them oldest-first", () => {
    const bars = parseTimeSeriesResponse({
      values: [
        { datetime: "2026-01-01 00:05:00", open: "1.10", high: "1.11", low: "1.09", close: "1.105" },
        { datetime: "2026-01-01 00:00:00", open: "1.09", high: "1.10", low: "1.08", close: "1.10" },
      ],
    });
    expect(bars).toHaveLength(2);
    expect(bars[0].time).toBeLessThan(bars[1].time);
    expect(bars[0].open).toBe(1.09);
    expect(bars[1].close).toBe(1.105);
  });

  it("parses a date-only (daily/weekly) datetime", () => {
    const bars = parseTimeSeriesResponse({
      values: [{ datetime: "2026-01-01", open: "1", high: "1.2", low: "0.9", close: "1.1" }],
    });
    expect(bars).toHaveLength(1);
    expect(Number.isFinite(bars[0].time)).toBe(true);
  });

  it("returns an empty array for a malformed payload", () => {
    expect(parseTimeSeriesResponse({ status: "error" })).toEqual([]);
  });
});

describe("parseQuoteResponse", () => {
  it("maps a well-formed quote", () => {
    const quote = parseQuoteResponse({ symbol: "EUR/USD", close: "1.105", change: "0.002", percent_change: "0.18", timestamp: 1700000000 });
    expect(quote).toEqual({ symbol: "EUR/USD", price: 1.105, change: 0.002, changePercent: 0.18, timestamp: 1700000000 });
  });

  it("returns null for a malformed payload", () => {
    expect(parseQuoteResponse({ symbol: "EUR/USD" })).toBeNull();
  });
});

describe("parseWsMessage", () => {
  it("parses a price event", () => {
    const parsed = parseWsMessage(JSON.stringify({ event: "price", symbol: "EUR/USD", price: 1.105, timestamp: 1700000000 }));
    expect(parsed).toEqual({ symbol: "EUR/USD", price: 1.105, timestampSeconds: 1700000000 });
  });

  it("ignores a non-price event (e.g. heartbeat/subscribe-status) without throwing", () => {
    expect(parseWsMessage(JSON.stringify({ event: "heartbeat", status: "ok" }))).toBeNull();
    expect(parseWsMessage(JSON.stringify({ event: "subscribe-status", status: "ok" }))).toBeNull();
  });

  it("ignores malformed JSON without throwing", () => {
    expect(parseWsMessage("not json")).toBeNull();
  });
});

describe("TWELVE_DATA_INTERVAL / SUPPORTED_INTERVALS", () => {
  it("has one Twelve Data interval string per supported BarInterval", () => {
    expect(SUPPORTED_INTERVALS.length).toBe(Object.keys(TWELVE_DATA_INTERVAL).length);
    for (const interval of SUPPORTED_INTERVALS) {
      expect(typeof TWELVE_DATA_INTERVAL[interval]).toBe("string");
    }
  });
});
