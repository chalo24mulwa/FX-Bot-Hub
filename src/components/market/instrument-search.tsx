"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AssetClass, InstrumentSummary } from "@/lib/market-data/types";

const GROUP_ORDER: AssetClass[] = ["FOREX", "METAL", "COMMODITY", "STOCK", "INDEX", "OTHER"];
const GROUP_LABELS: Record<AssetClass, string> = {
  FOREX: "Forex",
  METAL: "Metals",
  COMMODITY: "Commodities",
  STOCK: "Stocks",
  INDEX: "Indices",
  OTHER: "Other",
};

interface InstrumentSearchProps {
  onSelect: (instrument: InstrumentSummary) => void;
}

// Debounced search over /api/market-data/search, grouped by asset class —
// never queries the provider directly from the browser (see
// src/app/api/market-data/search/route.ts, which holds the API key
// server-side). Results are whatever the provider's symbol search returns
// for this query, not a fixed local list — see MarketDataProvider.searchSymbols's
// doc comment.
export function InstrumentSearch({ onSelect }: InstrumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InstrumentSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      if (trimmed.length < 1) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/market-data/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.notConfigured ? "Live market data isn't configured yet." : data.error || "Search failed.");
          setResults([]);
        } else {
          setResults(data.results ?? []);
        }
      } catch {
        setError("Search failed.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const grouped = GROUP_ORDER.map((assetClass) => ({
    assetClass,
    items: results.filter((r) => r.assetClass === assetClass),
  })).filter((g) => g.items.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search EUR/USD, XAU/USD, AAPL…"
        aria-label="Search instruments"
        className="h-9 bg-white/90 text-sm text-slate-900"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading && <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>}
          {!loading && error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
          {!loading && !error && grouped.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No matching instruments.</p>}
          {!loading &&
            grouped.map((group) => (
              <div key={group.assetClass}>
                <p className="bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {GROUP_LABELS[group.assetClass]}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                      "text-slate-900"
                    )}
                  >
                    <span className="font-medium">{item.symbol}</span>
                    <span className="truncate text-xs text-slate-500">{item.name}</span>
                    {item.exchange && <span className="shrink-0 text-[10px] text-slate-400">{item.exchange}</span>}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
