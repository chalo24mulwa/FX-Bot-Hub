"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { InstrumentSearch } from "./instrument-search";
import { ChartDrawingLayer } from "./chart-drawing-layer";
import { TIMEFRAME_OPTIONS } from "@/lib/market-data/timeframes";
import type { AssetClass, Bar, BarInterval, InstrumentSummary } from "@/lib/market-data/types";
import { cn } from "@/lib/utils";

type ChartType = "candlestick" | "line" | "area";
type ChartStatus = "loading" | "ready" | "not-configured" | "error";

interface Quote {
  price: number;
  change: number;
  changePercent: number;
}

const QUICK_SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "AAPL"];
const QUOTE_POLL_MS = 30_000;

function mapBarsToSeriesData(bars: Bar[], chartType: ChartType) {
  if (chartType === "candlestick") {
    return bars.map((b) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close }));
  }
  return bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close }));
}

function mapBarToSeriesPoint(bar: Bar, chartType: ChartType) {
  if (chartType === "candlestick") {
    return { time: bar.time as UTCTimestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close };
  }
  return { time: bar.time as UTCTimestamp, value: bar.close };
}

/**
 * Homepage hero chart — live instrument chart backed by
 * MarketDataProvider via /api/market-data/* (see src/lib/market-data/).
 * Uses lightweight-charts (TradingView's free, MIT-licensed charting
 * library — this environment has no licensing agreement for TradingView's
 * separate paid Advanced Charting Library, which isn't distributed via
 * npm; see CLAUDE.md's market-data-chart section for the full reasoning).
 * Renders an explicit "not configured" state instead of fabricating
 * prices when MARKET_DATA_API_KEY isn't set — see the CRITICAL
 * requirement this was built against.
 */
export function HeroChart({ defaultSymbol = "EUR/USD" }: { defaultSymbol?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [instrumentName, setInstrumentName] = useState(defaultSymbol);
  const [assetClass, setAssetClass] = useState<AssetClass | null>(null);
  const [interval, setChartInterval] = useState<BarInterval>("5m");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<ChartStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  // Chart instance is created once and never recreated — only its series
  // and data change when the instrument/timeframe/chart type change below.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#000000" }, textColor: "#cbd5e1" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Resolve → load history → subscribe live, re-run whenever the
  // instrument, timeframe, or chart type changes. Always closes the
  // previous EventSource (unsubscribing the previous instrument's stream
  // server-side) before opening the next one — see
  // src/app/api/market-data/stream/route.ts's cleanup().
  useEffect(() => {
    let cancelled = false;
    const chart = chartRef.current;
    if (!chart) return;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setLiveConnected(false);
    setStatus("loading");
    setErrorMessage(null);

    async function load() {
      const barsRes = await fetch(`/api/market-data/bars?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
      const barsData = await barsRes.json();
      if (cancelled) return;

      if (!barsRes.ok) {
        setStatus(barsData.notConfigured ? "not-configured" : "error");
        setErrorMessage(barsData.error ?? "Failed to load chart data.");
        return;
      }

      if (seriesRef.current) {
        chart!.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }
      const bars: Bar[] = barsData.bars ?? [];
      if (chartType === "candlestick") {
        const series = chart!.addSeries(CandlestickSeries, {
          upColor: "#16a34a",
          downColor: "#dc2626",
          borderVisible: false,
          wickUpColor: "#16a34a",
          wickDownColor: "#dc2626",
        });
        series.setData(mapBarsToSeriesData(bars, "candlestick"));
        seriesRef.current = series;
      } else if (chartType === "line") {
        const series = chart!.addSeries(LineSeries, { color: "#2563eb", lineWidth: 2 });
        series.setData(mapBarsToSeriesData(bars, "line"));
        seriesRef.current = series;
      } else {
        const series = chart!.addSeries(AreaSeries, {
          lineColor: "#2563eb",
          topColor: "rgba(37, 99, 235, 0.3)",
          bottomColor: "rgba(37, 99, 235, 0.02)",
          lineWidth: 2,
        });
        series.setData(mapBarsToSeriesData(bars, "area"));
        seriesRef.current = series;
      }
      chart!.timeScale().fitContent();
      setStatus("ready");

      const quoteRes = await fetch(`/api/market-data/quote?symbol=${encodeURIComponent(symbol)}`);
      if (!cancelled && quoteRes.ok) {
        const quoteData = await quoteRes.json();
        setQuote({ price: quoteData.quote.price, change: quoteData.quote.change, changePercent: quoteData.quote.changePercent });
      }

      const es = new EventSource(`/api/market-data/stream?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
      eventSourceRef.current = es;
      es.addEventListener("connected", () => setLiveConnected(true));
      es.addEventListener("bar", (event: MessageEvent) => {
        if (cancelled) return;
        const bar: Bar = JSON.parse(event.data);
        seriesRef.current?.update(mapBarToSeriesPoint(bar, chartType) as never);
        setQuote((prev) => (prev ? { ...prev, price: bar.close } : { price: bar.close, change: 0, changePercent: 0 }));
      });
      es.onerror = () => setLiveConnected(false);
      // EventSource reconnects automatically per the browser's own SSE
      // spec (no custom reconnect loop needed) — the server-side
      // subscription this connection held is released on disconnect and
      // re-established on reconnect (see stream/route.ts's cleanup()).
    }

    load().catch(() => {
      if (!cancelled) {
        setStatus("error");
        setErrorMessage("Failed to load chart data.");
      }
    });

    const quotePoll = setInterval(async () => {
      const res = await fetch(`/api/market-data/quote?symbol=${encodeURIComponent(symbol)}`);
      if (!cancelled && res.ok) {
        const data = await res.json();
        setQuote({ price: data.quote.price, change: data.quote.change, changePercent: data.quote.changePercent });
      }
    }, QUOTE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(quotePoll);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [symbol, interval, chartType]);

  function selectInstrument(instrument: InstrumentSummary) {
    setSymbol(instrument.symbol);
    setInstrumentName(instrument.name);
    setAssetClass(instrument.assetClass);
    setQuote(null);
  }

  const isUp = (quote?.change ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{symbol}</span>
            {assetClass && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {assetClass}
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                liveConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", liveConnected ? "bg-emerald-500" : "bg-slate-300")} />
              {liveConnected ? "Live" : "Connecting"}
            </span>
          </div>
          <p className="truncate text-xs text-slate-500">{instrumentName}</p>
          {quote && (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {quote.price.toLocaleString(undefined, { maximumFractionDigits: 5 })}
              </span>
              <span className={cn("text-sm font-medium tabular-nums", isUp ? "text-emerald-600" : "text-red-600")}>
                {isUp ? "+" : ""}
                {quote.change.toFixed(5)} ({isUp ? "+" : ""}
                {quote.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        <InstrumentSearch onSelect={selectInstrument} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 sm:px-5">
        <div className="flex flex-wrap gap-1">
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => selectInstrument({ symbol: s, name: s, assetClass: "OTHER" })}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium",
                symbol === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
            {(["candlestick", "line", "area"] as ChartType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartType(t)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium capitalize",
                  chartType === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-0.5">
            {TIMEFRAME_OPTIONS.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setChartInterval(tf.value)}
                className={cn(
                  "rounded px-1.5 py-1 text-xs font-medium",
                  interval === tf.value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-[360px] w-full sm:h-[440px] lg:h-[520px]">
        <div ref={containerRef} className="h-full w-full bg-black" />
        {status === "ready" && <ChartDrawingLayer />}
        {status === "not-configured" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/95 px-6 text-center">
            <p className="text-sm font-medium text-slate-200">Live market data isn&apos;t connected yet</p>
            <p className="max-w-sm text-xs text-slate-400">
              This chart is fully wired up, but no market-data provider credentials are configured in this environment.
              Set MARKET_DATA_API_KEY to show real live prices.
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/95 px-6 text-center">
            <p className="text-sm font-medium text-red-400">Couldn&apos;t load chart data</p>
            {errorMessage && <p className="max-w-sm text-xs text-slate-400">{errorMessage}</p>}
          </div>
        )}
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-xs text-slate-400">Loading chart…</p>
          </div>
        )}
      </div>
    </div>
  );
}
