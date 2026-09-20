import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { TradeDirection } from "@prisma/client";
import { computeRiskReward } from "@/lib/community/trade";
import { cn } from "@/lib/utils";

const DIRECTION = {
  BUY: { label: "BUY", Icon: TrendingUp, chip: "bg-emerald-500 text-white", ring: "border-emerald-200 bg-emerald-50/60" },
  SELL: { label: "SELL", Icon: TrendingDown, chip: "bg-rose-500 text-white", ring: "border-rose-200 bg-rose-50/60" },
  NEUTRAL: { label: "NEUTRAL", Icon: Minus, chip: "bg-slate-500 text-white", ring: "border-slate-200 bg-slate-50" },
} as const;

export interface TradeSetupData {
  instrument: string | null;
  direction: TradeDirection | null;
  timeframe: string | null;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
}

export function hasTradeSetup(t: TradeSetupData): boolean {
  return !!(t.direction || t.timeframe || t.entryPrice || t.stopLoss || t.takeProfit);
}

// The "EUR/USD — BUY" card. Every field is optional; only what the member
// supplied is shown. Always labelled as user-generated, never as a
// recommendation from FX Bot Hub.
export function TradeSetup({ trade, compact = false }: { trade: TradeSetupData; compact?: boolean }) {
  if (!hasTradeSetup(trade) && !trade.instrument) return null;
  const dir = trade.direction ? DIRECTION[trade.direction] : null;
  const rr = computeRiskReward(trade);
  const cells = [
    { label: "Timeframe", value: trade.timeframe, tone: "" },
    { label: "Entry", value: trade.entryPrice, tone: "" },
    { label: "SL", value: trade.stopLoss, tone: "text-rose-600" },
    { label: "TP", value: trade.takeProfit, tone: "text-emerald-600" },
    { label: "R:R", value: rr ? `1 : ${rr}` : null, tone: "" },
  ].filter((c) => c.value);

  return (
    <div className={cn("rounded-xl border p-3", dir?.ring ?? "border-slate-200 bg-slate-50")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("font-mono font-bold tracking-tight text-slate-900", compact ? "text-base" : "text-xl")}>{trade.instrument ?? "Idea"}</span>
        {dir && (
          <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tracking-wide", dir.chip)}>
            <dir.Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {dir.label}
          </span>
        )}
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-slate-400">Member idea · not advice</span>
      </div>
      {cells.length > 0 && (
        <dl className={cn("mt-2 grid gap-2", compact ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-5")}>
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-slate-200/70">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</dt>
              <dd className={cn("font-mono text-sm font-semibold text-slate-900", c.tone)}>{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
