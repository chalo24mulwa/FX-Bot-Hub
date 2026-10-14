"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Per-step "done" checkboxes and a progress summary for one tutorial.
 *
 * Progress is a per-viewer convenience, stored in this browser's localStorage only (no
 * account sync — that would need a new table and migration). Every storage access is
 * wrapped in try/catch: private windows and blocked storage simply mean nothing is
 * remembered, and the page still works.
 */

const EVENT = "fxbh:tutorial-progress";
const key = (slug: string) => `fxbh:tutorial:${slug}`;

function read(slug: string): string {
  try {
    return window.localStorage.getItem(key(slug)) ?? "";
  } catch {
    return "";
  }
}

// In-memory fallback so checkboxes still work for this visit when storage is blocked.
const memory = new Map<string, string>();

function snapshot(slug: string): string {
  return memory.get(slug) ?? read(slug);
}

function write(slug: string, done: Set<number>) {
  const value = [...done].sort((a, b) => a - b).join(",");
  memory.set(slug, value);
  try {
    if (value) window.localStorage.setItem(key(slug), value);
    else window.localStorage.removeItem(key(slug));
  } catch {
    /* storage unavailable — memory fallback above still applies */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: slug }));
}

function subscribe(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function parse(value: string): Set<number> {
  return new Set(
    value
      .split(",")
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => Number.isInteger(n) && n >= 0),
  );
}

function useDone(slug: string) {
  // A string snapshot keeps useSyncExternalStore's equality check cheap and stable.
  const value = useSyncExternalStore(subscribe, () => snapshot(slug), () => "");
  return parse(value);
}

export function StepDoneToggle({ slug, index, title }: { slug: string; index: number; title: string }) {
  const done = useDone(slug);
  const checked = done.has(index);
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
        checked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400",
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => {
          const next = new Set(done);
          if (e.target.checked) next.add(index);
          else next.delete(index);
          write(slug, next);
        }}
      />
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-1",
          checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 bg-white",
        )}
        aria-hidden="true"
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {checked ? "Done" : "Mark as done"}
      <span className="sr-only">: {title}</span>
    </label>
  );
}

export function TutorialProgressSummary({ slug, total, className }: { slug: string; total: number; className?: string }) {
  const done = useDone(slug);
  const count = [...done].filter((i) => i < total).length;
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">Your progress</span>
        <span className="text-slate-500" aria-live="polite">
          {count} of {total} steps
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Steps completed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={count}
      >
        <div className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
      {count > 0 && (
        <button type="button" onClick={() => write(slug, new Set())} className="mt-2 text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">
          Reset progress
        </button>
      )}
      <p className="mt-2 text-xs leading-5 text-slate-400">Saved in this browser only.</p>
    </div>
  );
}

/** Thin bar at the very top of the window showing how far down the page you've read. */
export function ReadingProgressBar() {
  const progress = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true });
      window.addEventListener("resize", onChange);
      return () => {
        window.removeEventListener("scroll", onChange);
        window.removeEventListener("resize", onChange);
      };
    },
    () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))) : 0;
    },
    () => 0,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-transparent" aria-hidden="true">
      <div className="h-full bg-gradient-to-r from-violet-500 to-amber-400" style={{ width: `${progress}%` }} />
    </div>
  );
}
