import type { InstrumentSummary } from "@/lib/market-data/types";
import { mapBarToTVBar, mapInstrumentToSearchResult, mapInstrumentToSymbolInfo, mapResolutionToInterval, TV_SUPPORTED_RESOLUTIONS } from "./resolution-mapping";
import type { TVDatafeed } from "./types";

// TradingView "Datafeed API" implementation for the Advanced Charting
// Library — every method here calls this app's own same-origin
// /api/market-data/* routes (never a provider or its API key directly;
// see CLAUDE.md's market-data-chart section), the exact same read path
// the lightweight-charts hero chart already uses. This is genuinely new
// infrastructure, not a duplicate of that chart's data layer — the
// Charting Library owns its own chart state/rendering and expects to
// drive fetching itself through these callbacks, rather than being handed
// data imperatively the way lightweight-charts' series.setData()/update()
// are called from hero-chart.tsx.
//
// One shared EventSource per subscribeBars() call, closed by
// unsubscribeBars(listenerGuid) — mirrors the same "unsubscribe the
// previous instrument before subscribing the next" contract the library
// itself drives (it calls unsubscribeBars for the old symbol before
// subscribeBars for a newly resolved one).

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `Request to ${url} failed (${res.status})`);
  }
  return data as T;
}

export function createDatafeed(): TVDatafeed {
  const activeStreams = new Map<string, EventSource>();

  return {
    onReady(callback) {
      setTimeout(
        () =>
          callback({
            supported_resolutions: TV_SUPPORTED_RESOLUTIONS,
            supports_search: true,
            supports_group_request: false,
            exchanges: [],
            symbols_types: [
              { name: "Forex", value: "forex" },
              { name: "Metal", value: "metal" },
              { name: "Commodity", value: "commodity" },
              { name: "Stock", value: "stock" },
              { name: "Index", value: "index" },
              { name: "Other", value: "other" },
            ],
          }),
        0
      );
    },

    searchSymbols(userInput, _exchange, _symbolType, onResult) {
      if (!userInput.trim()) {
        onResult([]);
        return;
      }
      fetchJson<{ results: InstrumentSummary[] }>(`/api/market-data/search?q=${encodeURIComponent(userInput)}`)
        .then((data) => onResult(data.results.map(mapInstrumentToSearchResult)))
        .catch(() => onResult([]));
    },

    resolveSymbol(symbolName, onResolve, onError) {
      fetchJson<{ instrument: InstrumentSummary }>(`/api/market-data/resolve?symbol=${encodeURIComponent(symbolName)}`)
        .then((data) => onResolve(mapInstrumentToSymbolInfo(data.instrument)))
        .catch((err) => onError(err instanceof Error ? err.message : "Symbol not found"));
    },

    getBars(symbolInfo, resolution, periodParams, onResult, onError) {
      const interval = mapResolutionToInterval(resolution);
      if (!interval) {
        onError(`Unsupported resolution: ${resolution}`);
        return;
      }
      const from = new Date(periodParams.from * 1000).toISOString();
      const to = new Date(periodParams.to * 1000).toISOString();
      const url = `/api/market-data/bars?symbol=${encodeURIComponent(symbolInfo.ticker)}&interval=${interval}&from=${from}&to=${to}`;
      fetchJson<{ bars: Parameters<typeof mapBarToTVBar>[0][] }>(url)
        .then((data) => onResult(data.bars.map(mapBarToTVBar), { noData: data.bars.length === 0 }))
        .catch((err) => onError(err instanceof Error ? err.message : "Failed to load bars"));
    },

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid) {
      const interval = mapResolutionToInterval(resolution);
      if (!interval) return;

      activeStreams.get(listenerGuid)?.close();

      const es = new EventSource(
        `/api/market-data/stream?symbol=${encodeURIComponent(symbolInfo.ticker)}&interval=${interval}`
      );
      es.addEventListener("bar", (event: MessageEvent) => {
        try {
          onTick(mapBarToTVBar(JSON.parse(event.data)));
        } catch {
          // Malformed frame — skip it rather than crash the chart.
        }
      });
      activeStreams.set(listenerGuid, es);
    },

    unsubscribeBars(listenerGuid) {
      activeStreams.get(listenerGuid)?.close();
      activeStreams.delete(listenerGuid);
    },
  };
}
