import { env } from "@/lib/env";
import type { MarketDataProvider } from "../types";
import { TwelveDataProvider } from "./twelvedata-provider";

// Same key-based registry pattern as the payments/storage/email/calendar
// providers (see CLAUDE.md's "Provider abstractions" section) — add a new
// provider by creating a file here and adding a case below, never by
// rewriting the API routes or chart component that call this.
const providers: Record<string, MarketDataProvider> = {
  twelvedata: new TwelveDataProvider(),
};

export function getMarketDataProvider(key: string = env.MARKET_DATA_PROVIDER): MarketDataProvider | null {
  return providers[key] ?? null;
}
