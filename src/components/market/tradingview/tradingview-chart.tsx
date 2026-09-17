"use client";

import { useEffect, useRef, useState } from "react";
import { createDatafeed } from "./create-datafeed";
import type { TVDatafeed } from "./types";

// Mounts TradingView's Advanced Charting Library widget, backed by
// createDatafeed() (this app's own /api/market-data/* routes — see that
// file's doc comment). NOT wired into any page yet: the library itself
// isn't in this project (see CLAUDE.md's "TradingView Advanced Charting
// Library" section) — TradingView distributes it as a private GitHub repo
// granted per approved account, not an npm package, so it can't be
// fetched or guessed at here. Once `public/charting_library/` (or
// wherever `libraryPath` points) holds the real library files, this
// component is ready to mount — it loads the library's own script tag at
// runtime and shows an explicit, non-crashing message if that script
// isn't there instead of a blank chart.
//
// A minimal local `TVWidgetConstructor` type stands in for the real
// `TradingView.widget` constructor's typings (which ship inside the
// library itself, in `charting_library.d.ts`) — swap to importing the
// real type once the library is present, same reasoning as ./types.ts.
interface TVWidgetOptions {
  container: HTMLElement;
  datafeed: TVDatafeed;
  symbol: string;
  interval: string;
  library_path: string;
  locale: string;
  autosize: boolean;
  fullscreen: boolean;
}
interface TVWidgetInstance {
  remove(): void;
}
type TVWidgetConstructor = new (options: TVWidgetOptions) => TVWidgetInstance;

declare global {
  interface Window {
    TradingView?: { widget: TVWidgetConstructor };
  }
}

const SCRIPT_ID = "tradingview-charting-library-script";

function loadLibraryScript(libraryPath: string): Promise<void> {
  if (window.TradingView?.widget) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script load failed")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${libraryPath}charting_library.js`;
    script.onload = () => (window.TradingView?.widget ? resolve() : reject(new Error("TradingView.widget not found after script load")));
    script.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(script);
  });
}

interface TradingViewChartProps {
  defaultSymbol?: string;
  defaultResolution?: string;
  /** Where the library's own static files live — see this project's
   * README/CLAUDE.md for where to place them once obtained. */
  libraryPath?: string;
}

export function TradingViewChart({ defaultSymbol = "EUR/USD", defaultResolution = "5", libraryPath = "/charting_library/" }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidgetInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "library-missing">("loading");

  useEffect(() => {
    let cancelled = false;
    loadLibraryScript(libraryPath)
      .then(() => {
        if (cancelled || !containerRef.current || !window.TradingView) return;
        widgetRef.current = new window.TradingView.widget({
          container: containerRef.current,
          datafeed: createDatafeed(),
          symbol: defaultSymbol,
          interval: defaultResolution,
          library_path: libraryPath,
          locale: "en",
          autosize: true,
          fullscreen: false,
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("library-missing");
      });

    return () => {
      cancelled = true;
      widgetRef.current?.remove();
      widgetRef.current = null;
    };
  }, [defaultSymbol, defaultResolution, libraryPath]);

  return (
    <div className="relative h-[320px] w-full sm:h-[400px] lg:h-[460px]">
      <div ref={containerRef} className="h-full w-full" />
      {status === "library-missing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/95 px-6 text-center">
          <p className="text-sm font-medium text-slate-700">TradingView Charting Library not installed</p>
          <p className="max-w-sm text-xs text-slate-500">
            Add the library&apos;s files to <code className="rounded bg-slate-100 px-1">public{libraryPath}</code> — see CLAUDE.md.
            The datafeed backing it is already wired up.
          </p>
        </div>
      )}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
          <p className="text-xs text-slate-400">Loading chart…</p>
        </div>
      )}
    </div>
  );
}
