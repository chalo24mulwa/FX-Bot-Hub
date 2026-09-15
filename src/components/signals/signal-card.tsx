"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const DIRECTION_STYLES: Record<string, string> = {
  BUY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SELL: "bg-red-50 text-red-700 border-red-200",
  WATCH: "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-50 text-blue-700 border-blue-200",
  CLOSED: "bg-slate-50 text-slate-600 border-slate-200",
  CANCELLED: "bg-slate-50 text-slate-400 border-slate-200",
};

export interface SignalCardData {
  id: string;
  instrument: string;
  direction: string;
  status: string;
  timeframe: string;
  publishedAt: Date;
  resultPips: number | null;
  provider: { displayName: string; slug: string; verified: boolean };
}

export function SignalCard({ signal }: { signal: SignalCardData }) {
  return (
    <Link href={`/signals/${signal.id}`} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={DIRECTION_STYLES[signal.direction]}>{signal.direction}</Badge>
        <Badge className={STATUS_STYLES[signal.status]}>{signal.status}</Badge>
        <Badge>{signal.timeframe}</Badge>
      </div>
      <h3 className="font-semibold text-slate-900">{signal.instrument}</h3>
      <div className="flex items-center gap-1 text-sm text-slate-500">
        <Link href={`/signals/provider/${signal.provider.slug}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
          {signal.provider.displayName}
        </Link>
        {signal.provider.verified && <span className="text-blue-600">✓</span>}
      </div>
      {signal.resultPips !== null && (
        <p className={`text-sm font-medium ${signal.resultPips > 0 ? "text-emerald-600" : "text-red-600"}`}>
          {signal.resultPips > 0 ? "+" : ""}
          {signal.resultPips} pips
        </p>
      )}
      <p className="text-xs text-slate-400">{signal.publishedAt.toLocaleString()}</p>
    </Link>
  );
}
