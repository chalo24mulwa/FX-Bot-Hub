import type { Bar, BarInterval } from "./types";

// Twelve Data's WebSocket stream (like most real-time forex/stock feeds)
// pushes individual price ticks, not OHLC bars — turning a tick stream
// into "the currently-forming candle just updated" for the chart is this
// file's job. Pure and DB/network-free specifically so the bucketing math
// (the part most likely to have an off-by-one) is unit-testable without a
// live WebSocket connection — see tick-aggregator.test.ts.

export const INTERVAL_SECONDS: Record<BarInterval, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "30m": 30 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
  "1w": 7 * 24 * 60 * 60,
  "1M": 30 * 24 * 60 * 60, // approximate — a calendar-month bucket isn't a fixed span; see doc comment below
};

/** Floors a Unix-seconds timestamp to the start of its interval bucket.
 * "1M" is approximated as a fixed 30-day span rather than true
 * calendar-month boundaries — acceptable for a live-updating "current
 * candle" indicator (the monthly bar is visually coarse either way); a
 * historical monthly series from getHistoricalBars() comes from the
 * provider's own calendar-aware endpoint, not this function. */
export function bucketStart(timestampSeconds: number, interval: BarInterval): number {
  const span = INTERVAL_SECONDS[interval];
  return Math.floor(timestampSeconds / span) * span;
}

export interface TickAggregatorResult {
  bar: Bar;
  /** True when this tick started a new bar (the chart should append a new
   * candle) rather than updating the currently-forming one in place. */
  isNewBar: boolean;
}

/** Stateful per-subscription aggregator: feed it ticks in timestamp order,
 * get back the current bar to render. One instance per active
 * symbol+interval subscription — see TwelveDataProvider.subscribeBars. */
export class TickAggregator {
  private current: Bar | null = null;

  constructor(private readonly interval: BarInterval) {}

  ingestTick(price: number, timestampSeconds: number): TickAggregatorResult {
    const start = bucketStart(timestampSeconds, this.interval);

    if (!this.current || this.current.time !== start) {
      this.current = { time: start, open: price, high: price, low: price, close: price };
      return { bar: this.current, isNewBar: true };
    }

    this.current = {
      ...this.current,
      high: Math.max(this.current.high, price),
      low: Math.min(this.current.low, price),
      close: price,
    };
    return { bar: this.current, isNewBar: false };
  }
}
