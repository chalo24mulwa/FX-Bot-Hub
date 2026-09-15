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

// Phase 5 fix: this previously nested a <Link> (the provider name) inside
// another <Link> (the whole-card link to the signal) — invalid HTML (an
// <a> can't contain another <a>), which made click targeting unpredictable
// once enough real data existed on the page for the browser's automatic
// DOM correction to matter (see CLAUDE.md's Phase 5 section — this was a
// genuine e2e-caught bug, not test flakiness). A `<div>` wrapper with a
// synthetic onClick + role="link" was tried next and *also* failed:
// stamping role="link" on the div puts a second "link" in the
// accessibility tree with an aggregated accessible name, reintroducing
// the same ambiguity the invalid-HTML fix was meant to remove. Fixed
// properly with the standard "stretched link" CSS pattern instead — an
// absolutely-positioned Link covering the whole card as the click target,
// and the provider-name Link as a normal sibling at a higher z-index so
// its own click area takes precedence. Two real anchors, siblings, no
// nesting, no synthetic ARIA role — see FavoriteButton's sibling (not
// nested-in-Link) positioning in product-card.tsx for the same underlying
// principle applied slightly differently.
export function SignalCard({ signal }: { signal: SignalCardData }) {
  return (
    <div className="relative flex flex-col gap-2 rounded-lg border border-slate-200 p-4 hover:shadow-md">
      <Link href={`/signals/${signal.id}`} className="absolute inset-0 z-0" aria-label={`${signal.instrument} ${signal.direction} signal`} />

      <div className="pointer-events-none flex flex-wrap items-center gap-1.5">
        <Badge className={DIRECTION_STYLES[signal.direction]}>{signal.direction}</Badge>
        <Badge className={STATUS_STYLES[signal.status]}>{signal.status}</Badge>
        <Badge>{signal.timeframe}</Badge>
      </div>
      <h3 className="pointer-events-none font-semibold text-slate-900">{signal.instrument}</h3>
      <div className="relative z-10 flex items-center gap-1 text-sm text-slate-500">
        <Link href={`/signals/provider/${signal.provider.slug}`} className="hover:underline">
          {signal.provider.displayName}
        </Link>
        {signal.provider.verified && <span className="pointer-events-none text-blue-600">✓</span>}
      </div>
      {signal.resultPips !== null && (
        <p className={`pointer-events-none text-sm font-medium ${signal.resultPips > 0 ? "text-emerald-600" : "text-red-600"}`}>
          {signal.resultPips > 0 ? "+" : ""}
          {signal.resultPips} pips
        </p>
      )}
      <p className="pointer-events-none text-xs text-slate-400">{signal.publishedAt.toLocaleString()}</p>
    </div>
  );
}
