import { NextResponse } from "next/server";
import { getMarketDataProvider } from "@/lib/market-data/providers";
import type { MarketDataProvider } from "@/lib/market-data/types";

// Shared by every /api/market-data/* route. None of these ever run in the
// browser — MarketDataProvider implementations (see
// src/lib/market-data/providers/twelvedata-provider.ts) read
// MARKET_DATA_API_KEY server-side only; the browser only ever talks to
// these routes. See CLAUDE.md's "Provider abstractions" section for the
// same pattern applied to payments/storage/email/calendar.

export class MarketDataApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True when the underlying cause is "no provider configured" (missing
     * MARKET_DATA_API_KEY) — lets the frontend show a distinct "live data
     * isn't configured yet" state instead of a generic error. */
    readonly notConfigured = false
  ) {
    super(message);
  }
}

export function requireProvider(): MarketDataProvider {
  const provider = getMarketDataProvider();
  if (!provider) {
    throw new MarketDataApiError("No market data provider is registered for MARKET_DATA_PROVIDER.", 503, true);
  }
  return provider;
}

export function isNotConfiguredError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("is not configured");
}

export function respondWithError(err: unknown) {
  if (err instanceof MarketDataApiError) {
    return NextResponse.json({ error: err.message, notConfigured: err.notConfigured }, { status: err.status });
  }
  if (isNotConfiguredError(err)) {
    return NextResponse.json({ error: (err as Error).message, notConfigured: true }, { status: 503 });
  }
  return NextResponse.json({ error: "Internal error." }, { status: 500 });
}
