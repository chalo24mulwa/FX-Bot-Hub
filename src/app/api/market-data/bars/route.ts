import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import { cacheWrap } from "@/lib/cache";
import type { BarInterval } from "@/lib/market-data/types";
import { requireProvider, respondWithError } from "../_shared";

const QuerySchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  interval: z.string(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// Default lookback per interval when the caller doesn't supply `from` —
// bounded per interval so a 1-minute chart doesn't accidentally request
// years of one-minute bars (a real cost/latency concern against a
// commercial provider), while a daily/weekly chart still gets enough
// history to be useful. The frontend can page further back with an
// explicit `from`/`to` (see CalendarPage's own from/to pattern) — this
// route doesn't return a single unbounded history in one call, mirroring
// EconomicCalendarService's "never scan the whole table" rule.
//
// Sized to keep the expected bar count for each interval in the low
// hundreds, not thousands — confirmed directly against the live Twelve
// Data API that request latency scales badly with bar count on its free
// tier (outputsize=5 responded in ~2s; outputsize=2000 took ~22s;
// outputsize=5000 combined with a wide date range took over two
// minutes). The previous values (7 days for "5m" = ~2016 bars) were
// picked before that was known and reliably timed out in production.
const DEFAULT_LOOKBACK_DAYS: Record<BarInterval, number> = {
  "1m": 0.25,
  "5m": 1,
  "15m": 5,
  "30m": 10,
  "1h": 20,
  "4h": 80,
  "1d": 730,
  "1w": 1825,
  "1M": 3650,
};

const MAX_BARS = 5000;

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(clientIp(request), { bucket: "market-data:bars", limit: 60, windowSeconds: 60 });

    const parsed = QuerySchema.safeParse({
      symbol: request.nextUrl.searchParams.get("symbol"),
      interval: request.nextUrl.searchParams.get("interval"),
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Query parameters 'symbol' and 'interval' are required." }, { status: 400 });
    }

    const provider = requireProvider();
    const interval = parsed.data.interval as BarInterval;
    if (!provider.supportedIntervals.includes(interval)) {
      return NextResponse.json(
        { error: `Interval '${interval}' is not supported by provider '${provider.key}'.`, supportedIntervals: provider.supportedIntervals },
        { status: 400 }
      );
    }

    const to = parsed.data.to ?? new Date();
    const from = parsed.data.from ?? new Date(to.getTime() - DEFAULT_LOOKBACK_DAYS[interval] * 86_400_000);
    if (from > to) {
      return NextResponse.json({ error: "'from' must not be after 'to'." }, { status: 400 });
    }

    const usingDefaultRange = !parsed.data.from && !parsed.data.to;
    const cacheTtlSeconds = interval === "1m" || interval === "5m" ? 15 : 60;
    const fetchBars = () => provider.getHistoricalBars(parsed.data.symbol, interval, from, to);
    const bars = usingDefaultRange
      ? await cacheWrap(`market-data:bars:${provider.key}:${parsed.data.symbol.toUpperCase()}:${interval}`, cacheTtlSeconds, fetchBars)
      : await fetchBars();

    return NextResponse.json({ bars: bars.slice(-MAX_BARS), symbol: parsed.data.symbol, interval });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Retry-After": String(err.retryAfterSeconds) } });
    }
    return respondWithError(err);
  }
}
