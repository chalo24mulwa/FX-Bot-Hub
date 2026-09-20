import type { CommunityPostType, TradeDirection } from "@prisma/client";
import { TIMEFRAMES, isTradePostType } from "@/config/community";

// Trading-idea parameters. Everything here is OPTIONAL — a question or
// discussion carries none, and even an idea may omit any field. What IS
// enforced is internal consistency when the member does provide numbers
// (a BUY with its stop above its entry is a typo worth catching, not a
// setup). Pure module, unit-tested.

const PRICE = /^\d{1,10}(\.\d{1,8})?$/;
const INSTRUMENT = /^[A-Za-z0-9]{2,10}([/._-][A-Za-z0-9]{2,10})?$/;

export interface TradeInput {
  type: CommunityPostType;
  instrument?: string | null;
  direction?: TradeDirection | null;
  timeframe?: string | null;
  entryPrice?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
}

export interface NormalizedTrade {
  instrument: string | null;
  direction: TradeDirection | null;
  timeframe: string | null;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
}

export type TradeResult = { ok: true; value: NormalizedTrade } | { ok: false; error: string };

const EMPTY: NormalizedTrade = { instrument: null, direction: null, timeframe: null, entryPrice: null, stopLoss: null, takeProfit: null };

/** "eurusd" / "EUR/USD" / "eur-usd" -> "EUR/USD"; anything else is uppercased as typed. */
export function normalizeInstrument(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[\s._-]+/g, "/");
  return /^[A-Z]{6}$/.test(cleaned) ? `${cleaned.slice(0, 3)}/${cleaned.slice(3)}` : cleaned;
}

const blank = (v: string | null | undefined) => (v === undefined || v === null || v.trim() === "" ? null : v.trim());

export function normalizeTrade(input: TradeInput): TradeResult {
  const instrument = blank(input.instrument);

  // An instrument is allowed on any post (e.g. a question about EUR/USD).
  let normalizedInstrument: string | null = null;
  if (instrument) {
    if (!INSTRUMENT.test(instrument.replace(/\s+/g, ""))) return { ok: false, error: "Enter the instrument as a symbol, e.g. EUR/USD or XAUUSD." };
    normalizedInstrument = normalizeInstrument(instrument);
  }

  // Direction, timeframe and prices only exist on trade-style posts; for a
  // discussion or question they're dropped rather than stored.
  if (!isTradePostType(input.type)) return { ok: true, value: { ...EMPTY, instrument: normalizedInstrument } };

  const timeframe = blank(input.timeframe)?.toUpperCase() ?? null;
  if (timeframe && !(TIMEFRAMES as readonly string[]).includes(timeframe)) return { ok: false, error: "Choose a timeframe from the list." };

  const prices: Record<"entryPrice" | "stopLoss" | "takeProfit", string | null> = {
    entryPrice: blank(input.entryPrice),
    stopLoss: blank(input.stopLoss),
    takeProfit: blank(input.takeProfit),
  };
  const labels = { entryPrice: "Entry", stopLoss: "Stop loss", takeProfit: "Take profit" } as const;
  for (const key of Object.keys(prices) as (keyof typeof prices)[]) {
    const value = prices[key];
    if (value !== null && !PRICE.test(value)) return { ok: false, error: `${labels[key]} must be a number, e.g. 1.0850.` };
    if (value !== null && Number(value) <= 0) return { ok: false, error: `${labels[key]} must be greater than zero.` };
  }

  const direction = input.direction ?? null;
  const anyLevel = prices.stopLoss !== null || prices.takeProfit !== null;
  if (anyLevel && direction !== "BUY" && direction !== "SELL") {
    return { ok: false, error: "Choose BUY or SELL to set a stop loss or take profit." };
  }

  const entry = prices.entryPrice === null ? null : Number(prices.entryPrice);
  const sl = prices.stopLoss === null ? null : Number(prices.stopLoss);
  const tp = prices.takeProfit === null ? null : Number(prices.takeProfit);

  if (direction === "BUY") {
    if (entry !== null && sl !== null && !(sl < entry)) return { ok: false, error: "For a BUY, the stop loss must be below the entry." };
    if (entry !== null && tp !== null && !(tp > entry)) return { ok: false, error: "For a BUY, the take profit must be above the entry." };
    if (entry === null && sl !== null && tp !== null && !(sl < tp)) return { ok: false, error: "For a BUY, the stop loss must be below the take profit." };
  } else if (direction === "SELL") {
    if (entry !== null && sl !== null && !(sl > entry)) return { ok: false, error: "For a SELL, the stop loss must be above the entry." };
    if (entry !== null && tp !== null && !(tp < entry)) return { ok: false, error: "For a SELL, the take profit must be below the entry." };
    if (entry === null && sl !== null && tp !== null && !(sl > tp)) return { ok: false, error: "For a SELL, the stop loss must be above the take profit." };
  }

  return { ok: true, value: { instrument: normalizedInstrument, direction, timeframe, ...prices } };
}

/** Reward:risk from the member's own numbers, or null unless entry, SL and TP are all present and coherent. */
export function computeRiskReward(t: Pick<NormalizedTrade, "direction" | "entryPrice" | "stopLoss" | "takeProfit">): number | null {
  if ((t.direction !== "BUY" && t.direction !== "SELL") || !t.entryPrice || !t.stopLoss || !t.takeProfit) return null;
  const entry = Number(t.entryPrice);
  const risk = Math.abs(entry - Number(t.stopLoss));
  const reward = Math.abs(Number(t.takeProfit) - entry);
  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0) return null;
  return Math.round((reward / risk) * 100) / 100;
}
