import type { BarInterval } from "./types";

// Client-safe (no @/lib/env import, no provider I/O) — the hero chart
// imports this directly rather than a server-only provider module.
// Matches every interval TwelveDataProvider currently supports (see
// SUPPORTED_INTERVALS in providers/twelvedata-mapping.ts); if a future
// provider supports fewer, the /bars and /stream API routes already
// reject an unsupported interval with a 400 + the provider's actual
// supportedIntervals list rather than silently misbehaving.
export const TIMEFRAME_OPTIONS: { value: BarInterval; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1M", label: "1M" },
];
