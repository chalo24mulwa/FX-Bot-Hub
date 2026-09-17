import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Bar, BarInterval, BarUpdate, InstrumentSummary, MarketDataProvider, Quote } from "../types";
import { RefCountedSubscriptionRegistry } from "../subscription-registry";
import { TickAggregator } from "../tick-aggregator";
import {
  parseQuoteResponse,
  parseSymbolSearchResponse,
  parseTimeSeriesResponse,
  parseWsMessage,
  SUPPORTED_INTERVALS,
  TWELVE_DATA_INTERVAL,
} from "./twelvedata-mapping";

// Real integration against Twelve Data (https://twelvedata.com/docs) — a
// commercial market-data provider covering forex, metals/commodities, and
// stocks with historical OHLC + real-time WebSocket streaming + symbol
// search, exactly the coverage the homepage hero chart needs (never Forex
// Factory/TradingView/Google/Yahoo Finance scraping — see CLAUDE.md's
// data-sourcing rule, which this follows the same way
// AuthorizedCalendarProvider does for the economic calendar).
//
// Requires MARKET_DATA_API_KEY (a real, licensed key) and
// MARKET_DATA_PROVIDER=twelvedata — see src/lib/env.ts and
// docs/ENVIRONMENT.md. Every method throws a clear "not configured" error
// until a real key is set, so the chart can show an explicit message
// instead of fabricating prices (see the hero chart component, which
// catches this and renders a "live data not configured" state).
//
// NOT YET EXERCISED against a live Twelve Data account — this
// environment holds no real API key. Request/response mapping is
// unit-tested against the documented shape (twelvedata-mapping.test.ts);
// re-verify against a real key/sandbox before enabling
// MARKET_DATA_PROVIDER=twelvedata in production, the same caution
// CLAUDE.md already documents for AuthorizedCalendarProvider.

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const WS_RECONNECT_BASE_DELAY_MS = 1000;
const WS_RECONNECT_MAX_DELAY_MS = 30_000;
const WS_HEARTBEAT_INTERVAL_MS = 10_000;

function requireConfigured(): { apiKey: string; apiUrl: string; wsUrl: string } {
  if (!env.MARKET_DATA_API_KEY) {
    throw new Error(
      "TwelveDataProvider is not configured: set MARKET_DATA_API_KEY to a real, licensed Twelve Data " +
        "API key before the homepage hero chart can show live data."
    );
  }
  return { apiKey: env.MARKET_DATA_API_KEY, apiUrl: env.MARKET_DATA_API_URL, wsUrl: env.MARKET_DATA_WS_URL };
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`market data provider request failed (${res.status}): ${await safeText(res)}`);
      }
      lastError = new Error(`market data provider request failed (${res.status})`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_RETRY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("market data provider request failed");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function formatDateForTwelveData(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Manages exactly one shared upstream WebSocket connection for the whole
 * process, reconnecting with backoff and re-subscribing every currently-
 * retained symbol on reconnect. Symbols are ref-counted (retainSymbol/
 * releaseSymbol) — the connection itself is opened lazily on the first
 * retain and closed once no symbol is retained anymore, per "do not leave
 * unnecessary WebSocket subscriptions running." */
class TwelveDataStream {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private readonly symbolRefCounts = new Map<string, number>();
  private readonly tickListeners = new Map<string, Set<(symbol: string, price: number, timestampSeconds: number) => void>>();

  onTick(symbol: string, listener: (symbol: string, price: number, timestampSeconds: number) => void): () => void {
    let set = this.tickListeners.get(symbol);
    if (!set) {
      set = new Set();
      this.tickListeners.set(symbol, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  retainSymbol(symbol: string): void {
    const count = (this.symbolRefCounts.get(symbol) ?? 0) + 1;
    this.symbolRefCounts.set(symbol, count);
    if (count === 1) {
      this.ensureConnected();
      this.send({ action: "subscribe", params: { symbols: symbol } });
    }
  }

  releaseSymbol(symbol: string): void {
    const count = (this.symbolRefCounts.get(symbol) ?? 1) - 1;
    if (count <= 0) {
      this.symbolRefCounts.delete(symbol);
      this.tickListeners.delete(symbol);
      this.send({ action: "unsubscribe", params: { symbols: symbol } });
      if (this.symbolRefCounts.size === 0) this.disconnect();
    } else {
      this.symbolRefCounts.set(symbol, count);
    }
  }

  private send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
    // If not open yet, ensureConnected()'s onopen handler re-subscribes
    // every retained symbol, so a subscribe issued mid-connect isn't lost.
  }

  private ensureConnected(): void {
    if (this.ws) return;
    const { apiKey, wsUrl } = requireConfigured();
    const socket = new WebSocket(`${wsUrl}?apikey=${encodeURIComponent(apiKey)}`);
    this.ws = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      for (const symbol of this.symbolRefCounts.keys()) {
        this.send({ action: "subscribe", params: { symbols: symbol } });
      }
      this.heartbeatTimer = setInterval(() => this.send({ action: "heartbeat" }), WS_HEARTBEAT_INTERVAL_MS);
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      const parsed = parseWsMessage(String(event.data));
      if (!parsed) return;
      const listeners = this.tickListeners.get(parsed.symbol);
      if (!listeners) return;
      for (const listener of listeners) listener(parsed.symbol, parsed.price, parsed.timestampSeconds);
    });

    const handleClose = () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.ws = null;
      if (this.symbolRefCounts.size > 0) this.scheduleReconnect();
    };
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", (err: Event) => {
      logger.warn("market data websocket error", { error: String(err) });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(WS_RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt, WS_RECONNECT_MAX_DELAY_MS);
    this.reconnectAttempt += 1;
    logger.warn("market data websocket reconnecting", { attempt: this.reconnectAttempt, delayMs: delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.symbolRefCounts.size > 0) this.ensureConnected();
    }, delay);
  }

  private disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.ws?.close();
    this.ws = null;
    this.reconnectAttempt = 0;
  }
}

// One shared stream per process (see class doc comment) — module-level
// singleton, same lifetime as the BullMQ queue singletons in
// src/lib/queue/queues.ts.
const sharedStream = new TwelveDataStream();

export class TwelveDataProvider implements MarketDataProvider {
  readonly key = "twelvedata";
  readonly supportedIntervals: BarInterval[] = SUPPORTED_INTERVALS;

  private readonly barRegistry = new RefCountedSubscriptionRegistry<(bar: BarUpdate) => void>();
  private readonly aggregatorsByBarKey = new Map<string, TickAggregator>();
  private readonly unsubTickListenerByBarKey = new Map<string, () => void>();
  private readonly symbolByBarKey = new Map<string, string>();

  async searchSymbols(query: string): Promise<InstrumentSummary[]> {
    const { apiKey, apiUrl } = requireConfigured();
    const url = `${apiUrl}/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetchWithRetry(url);
    return parseSymbolSearchResponse(await res.json());
  }

  async resolveSymbol(symbol: string): Promise<InstrumentSummary | null> {
    const results = await this.searchSymbols(symbol);
    return results.find((r) => r.symbol.toUpperCase() === symbol.toUpperCase()) ?? results[0] ?? null;
  }

  async getHistoricalBars(symbol: string, interval: BarInterval, from: Date, to: Date): Promise<Bar[]> {
    const { apiKey, apiUrl } = requireConfigured();
    const tdInterval = TWELVE_DATA_INTERVAL[interval];
    const url =
      `${apiUrl}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${tdInterval}` +
      `&start_date=${encodeURIComponent(formatDateForTwelveData(from))}` +
      `&end_date=${encodeURIComponent(formatDateForTwelveData(to))}` +
      `&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetchWithRetry(url);
    return parseTimeSeriesResponse(await res.json());
  }

  async getLatestQuote(symbol: string): Promise<Quote | null> {
    const { apiKey, apiUrl } = requireConfigured();
    const url = `${apiUrl}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetchWithRetry(url);
    return parseQuoteResponse(await res.json());
  }

  subscribeBars(symbol: string, interval: BarInterval, onUpdate: (bar: BarUpdate) => void): string {
    requireConfigured();
    const barKey = `${symbol}:${interval}`;
    const { subscriptionId, isFirstForKey } = this.barRegistry.subscribe(barKey, onUpdate);

    if (isFirstForKey) {
      this.aggregatorsByBarKey.set(barKey, new TickAggregator(interval));
      this.symbolByBarKey.set(barKey, symbol);
      sharedStream.retainSymbol(symbol);
      const unsubTick = sharedStream.onTick(symbol, (_sym, price, timestampSeconds) => {
        const aggregator = this.aggregatorsByBarKey.get(barKey);
        if (!aggregator) return;
        const { bar } = aggregator.ingestTick(price, timestampSeconds);
        for (const callback of this.barRegistry.callbacksFor(barKey)) callback(bar);
      });
      this.unsubTickListenerByBarKey.set(barKey, unsubTick);
    }

    return subscriptionId;
  }

  unsubscribeBars(subscriptionId: string): void {
    const outcome = this.barRegistry.unsubscribe(subscriptionId);
    if (!outcome.found || !outcome.key) return;
    if (outcome.wasLastForKey) {
      const barKey = outcome.key;
      const symbol = this.symbolByBarKey.get(barKey);
      this.aggregatorsByBarKey.delete(barKey);
      this.symbolByBarKey.delete(barKey);
      this.unsubTickListenerByBarKey.get(barKey)?.();
      this.unsubTickListenerByBarKey.delete(barKey);
      if (symbol) sharedStream.releaseSymbol(symbol);
    }
  }
}
