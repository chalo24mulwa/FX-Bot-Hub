import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp, RateLimitError } from "@/lib/security/rate-limit";
import type { BarInterval, BarUpdate, MarketDataProvider } from "@/lib/market-data/types";
import { requireProvider, respondWithError } from "../_shared";

// Server-Sent Events endpoint — the "server-streaming where supported"
// half of the live-data requirement (see CLAUDE.md's market-data-chart
// section). Deliberately not a raw WebSocket proxy: this app has no
// custom Node server (`next start` only — see docs/DEPLOYMENT.md), and
// Next.js route handlers can stream a `ReadableStream` response exactly
// like this without one. The browser only ever holds this same-origin
// EventSource connection; MarketDataProvider.subscribeBars() (see
// src/lib/market-data/providers/twelvedata-provider.ts) is the only thing
// that ever opens a connection to the upstream provider, server-side,
// with the API key it never exposes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({ symbol: z.string().trim().min(1).max(20), interval: z.string() });
const KEEPALIVE_INTERVAL_MS = 15_000;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(clientIp(request), { bucket: "market-data:stream", limit: 20, windowSeconds: 60 });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Retry-After": String(err.retryAfterSeconds) } });
    }
    return respondWithError(err);
  }

  const parsed = QuerySchema.safeParse({
    symbol: request.nextUrl.searchParams.get("symbol"),
    interval: request.nextUrl.searchParams.get("interval"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Query parameters 'symbol' and 'interval' are required." }, { status: 400 });
  }

  let provider: MarketDataProvider;
  try {
    provider = requireProvider();
  } catch (err) {
    return respondWithError(err);
  }

  const interval = parsed.data.interval as BarInterval;
  if (!provider.supportedIntervals.includes(interval)) {
    return NextResponse.json({ error: `Interval '${interval}' is not supported.` }, { status: 400 });
  }

  const symbol = parsed.data.symbol;
  let subscriptionId: string | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed (client disconnected between an
          // upstream event and this send) — cleanup() below handles it.
        }
      };

      try {
        subscriptionId = provider.subscribeBars(symbol, interval, (bar: BarUpdate) => send(sseEvent("bar", bar)));
      } catch (err) {
        send(sseEvent("error", { message: err instanceof Error ? err.message : "subscription failed" }));
        controller.close();
        return;
      }

      send(sseEvent("connected", { symbol, interval }));
      keepaliveTimer = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_INTERVAL_MS);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = null;
    // Unsubscribing here — on client disconnect (tab close, instrument
    // change closing this EventSource) — is what "do not leave
    // unnecessary WebSocket subscriptions running" actually means in
    // practice: the last subscriber leaving releases the upstream
    // provider subscription too (see TwelveDataProvider.unsubscribeBars).
    if (subscriptionId) provider.unsubscribeBars(subscriptionId);
    subscriptionId = null;
  }

  request.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
