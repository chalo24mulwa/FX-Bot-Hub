"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Globe, SlidersHorizontal, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORTED_TIMEZONES, CALENDAR_TIMEZONE_COOKIE } from "@/lib/calendar/timezone";

// The calendar's filter panel. Same state model as before — everything lives
// in URL search params (preset/from/to/impact/category/currency/tz), which the
// server page reads — only the presentation changed: a sticky left sidebar on
// desktop, a slide-in drawer opened by a "Filters" bar on small screens. It is
// ONE element that restyles at the `lg` breakpoint (not two copies), so there
// is a single set of controls to keep in sync.

const NAV_PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
];

const IMPACTS: { value: string; label: string; dot: string }[] = [
  { value: "HIGH", label: "High", dot: "bg-red-500" },
  { value: "MEDIUM", label: "Medium", dot: "bg-amber-400" },
  { value: "LOW", label: "Low", dot: "bg-slate-400" },
  { value: "HOLIDAY", label: "Holiday", dot: "bg-sky-400" },
  { value: "OTHER", label: "Other", dot: "bg-slate-500" },
];

const CATEGORIES: { value: string; label: string }[] = [
  { value: "CENTRAL_BANK", label: "Central Bank" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "INFLATION", label: "Inflation" },
  { value: "GDP", label: "GDP" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "RETAIL", label: "Retail" },
  { value: "HOUSING", label: "Housing" },
  { value: "CONSUMER", label: "Consumer" },
  { value: "POLITICS", label: "Politics" },
  { value: "OTHER", label: "Other" },
];

// The majors first, in the order traders scan them. Any other currency that
// actually has events (e.g. an "unmapped" GLOBAL bucket) is appended after —
// the list is the desired display order, never a cap on what can be filtered.
const CURRENCY_ORDER = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY", "SEK", "NOK", "INR", "HKD"];

// Formats the viewer's LOCAL calendar date (not the UTC one): the range end is
// built at local midnight, and `toISOString()` converts that to UTC first — for
// anyone east of UTC (Nairobi included) it landed on the *previous* day, so
// "This Month" silently dropped the month's last day.
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** First and last day of the viewer's current local month, computed
 * client-side purely for filling in the From/To inputs — the server still
 * does the real, timezone-aware range math (getRangeBetween) once these
 * land as `from`/`to` query params. */
function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function nextNDaysRange(days: number): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getTime() + days * 86_400_000);
  return { from: toIsoDate(now), to: toIsoDate(to) };
}

/** Shared URL-state plumbing for the sidebar and the header's timezone picker. */
function useCalendarParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // The params the *next* click should build on: the URL as last committed,
  // advanced immediately by every click. Without this, two quick clicks (say
  // "High" then "USD" before the first navigation has finished rendering) would
  // both start from the same stale URL and the second would silently undo the
  // first. It re-syncs to the real URL whenever navigation commits.
  const latest = useRef(searchParams.toString());
  const committed = searchParams.toString();
  useEffect(() => {
    latest.current = committed;
  }, [committed]);

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(latest.current);
    mutate(params);
    latest.current = params.toString();
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return { searchParams, updateParams, isPending };
}

/** Timezone picker — lives in the page header now (it was inside the filter
 * bar), same cookie + `tz` param behaviour as before. */
export function CalendarTimezoneSelect({ timezone }: { timezone: string }) {
  const { updateParams, isPending } = useCalendarParams();

  function handleTimezoneChange(next: string) {
    // 1 year: long enough that "change once, keep it" holds across normal
    // browsing, short enough that a stale cookie can't outlive the app.
    document.cookie = `${CALENDAR_TIMEZONE_COOKIE}=${next}; path=/; max-age=${365 * 86_400}; samesite=lax`;
    updateParams((params) => params.set("tz", next));
  }

  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 py-1 pl-2.5 pr-1.5 text-xs text-slate-300 transition-colors focus-within:border-violet-400 hover:bg-white/15",
        isPending && "opacity-60"
      )}
    >
      <Globe className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Timezone</span>
      <select
        value={timezone}
        onChange={(e) => handleTimezoneChange(e.target.value)}
        aria-label="Timezone"
        className="cursor-pointer rounded-full bg-transparent py-0.5 pr-1 text-sm font-medium text-white outline-none"
      >
        {SUPPORTED_TIMEZONES.map((tz) => (
          <option key={tz.id} value={tz.id} className="text-slate-900">
            {tz.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{children}</h3>;
}

export function CalendarFilters({
  currencies,
  timezone,
  from,
  to,
  resultCount,
  savePreferencesAction,
}: {
  currencies: string[];
  timezone: string;
  from?: string;
  to?: string;
  /** Events matching the current view — shown on the mobile drawer's "Show N events" button. */
  resultCount?: number;
  savePreferencesAction?: (formData: FormData) => Promise<void>;
}) {
  const { searchParams, updateParams, isPending } = useCalendarParams();
  const [rangeFrom, setRangeFrom] = useState(from ?? "");
  const [rangeTo, setRangeTo] = useState(to ?? "");
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const preset = searchParams.get("preset") ?? "week";
  const nav = searchParams.get("nav");
  const selectedImpacts = searchParams.getAll("impact");
  const selectedCategories = searchParams.getAll("category");
  const selectedCurrencies = searchParams.getAll("currency");
  const activeCount = selectedImpacts.length + selectedCategories.length + selectedCurrencies.length;

  // Which navigation row is "current". `nav` is a marker the quick ranges
  // add to the URL (the server ignores it) so This Month / Next 3 Months can
  // be told apart from a hand-picked custom range without re-deriving dates
  // in the browser (which would risk an SSR/hydration mismatch near midnight).
  const activeNav = NAV_PRESETS.some((p) => p.value === preset) ? preset : nav === "month" || nav === "quarter" ? nav : "custom";

  const currencyList = [...CURRENCY_ORDER, ...currencies.filter((c) => !CURRENCY_ORDER.includes(c))];

  // Drawer: Escape closes, page scroll is locked while it's open, focus moves in.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function applyPreset(value: string) {
    setOpen(false);
    updateParams((params) => {
      params.set("preset", value);
      params.delete("from");
      params.delete("to");
      params.delete("date");
      params.delete("nav");
    });
  }

  function applyRange(rangeStart: string, rangeEnd: string, marker?: "month" | "quarter") {
    if (!rangeStart || !rangeEnd) return;
    setRangeFrom(rangeStart);
    setRangeTo(rangeEnd);
    setOpen(false);
    updateParams((params) => {
      params.set("preset", "range");
      params.set("from", rangeStart);
      params.set("to", rangeEnd);
      params.delete("date");
      if (marker) params.set("nav", marker);
      else params.delete("nav");
    });
  }

  function toggleMulti(key: string, value: string) {
    updateParams((params) => {
      const current = params.getAll(key);
      params.delete(key);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      next.forEach((v) => params.append(key, v));
    });
  }

  function clearFilters() {
    updateParams((params) => {
      params.delete("impact");
      params.delete("category");
      params.delete("currency");
    });
  }

  const activeChips = [
    ...selectedImpacts.map((v) => ({ key: "impact", value: v, label: IMPACTS.find((i) => i.value === v)?.label ?? v })),
    ...selectedCategories.map((v) => ({ key: "category", value: v, label: CATEGORIES.find((c) => c.value === v)?.label ?? v })),
    ...selectedCurrencies.map((v) => ({ key: "currency", value: v, label: v })),
  ];

  const navItemClass = (active: boolean) =>
    cn(
      "flex w-full items-center rounded-lg px-3 py-1 text-left text-sm font-medium transition-colors motion-reduce:transition-none",
      active
        ? "bg-violet-500/20 text-white shadow-[inset_2px_0_0_0_#a78bfa]"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
    );

  const pillClass = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors motion-reduce:transition-none",
      active
        ? "border-violet-400 bg-violet-500 text-white shadow-sm"
        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
    );

  return (
    <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
      {/* Small screens: a bar that opens the drawer. Desktop: not rendered. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0e1530] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[#131c3f]"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-violet-300" aria-hidden="true" />
            Filters
          </span>
          {activeCount > 0 ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-slate-900">{activeCount} active</span>
          ) : (
            <span className="text-xs text-slate-400">Impact · Category · Currency</span>
          )}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Calendar filters"
        aria-modal={open ? true : undefined}
        role={open ? "dialog" : undefined}
        aria-busy={isPending}
        className={cn(
          // < lg: off-canvas drawer.  lg+: static, sticky sidebar under the site header.
          "fixed inset-y-0 left-0 z-50 w-[88%] max-w-sm -translate-x-full overflow-y-auto [scrollbar-color:rgba(148,163,184,0.35)_transparent] [scrollbar-width:thin] border-r border-white/10 bg-[#0b1129] p-4 text-slate-200 shadow-2xl transition-transform duration-200 motion-reduce:transition-none",
          "lg:sticky lg:top-[4.75rem] lg:z-auto lg:max-h-[calc(100vh-5.5rem)] lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-2xl lg:border lg:bg-[#0e1530]/90 lg:shadow-[0_10px_40px_-12px_rgba(2,6,23,0.7)] lg:backdrop-blur",
          open && "translate-x-0",
          isPending && "opacity-70"
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-white">Filters</h2>
            {activeCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-slate-900">{activeCount} filter{activeCount === 1 ? "" : "s"} active</span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {activeCount > 0 && (
          <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map((chip) => (
                <button
                  key={`${chip.key}:${chip.value}`}
                  type="button"
                  onClick={() => toggleMulti(chip.key, chip.value)}
                  aria-label={`Remove ${chip.label} filter`}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white transition-colors hover:bg-red-500/30"
                >
                  {chip.label}
                  <X className="h-3 w-3 text-slate-300" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-xs font-medium text-amber-300 underline-offset-2 transition-colors hover:text-amber-200 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        <nav aria-label="Calendar range" className="mb-4">
          <SectionTitle>Calendar</SectionTitle>
          <ul className="flex flex-col gap-0.5">
            {NAV_PRESETS.map((p) => (
              <li key={p.value}>
                <button type="button" onClick={() => applyPreset(p.value)} aria-current={activeNav === p.value ? "true" : undefined} className={navItemClass(activeNav === p.value)}>
                  {p.label}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => applyRange(toIsoDate(new Date()), thisMonthRange().to, "month")}
                aria-current={activeNav === "month" ? "true" : undefined}
                className={navItemClass(activeNav === "month")}
              >
                This Month
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  const { from: f, to: t } = nextNDaysRange(90);
                  applyRange(f, t, "quarter");
                }}
                aria-current={activeNav === "quarter" ? "true" : undefined}
                className={navItemClass(activeNav === "quarter")}
              >
                Next 3 Months
              </button>
            </li>
            <li>
              <div className={cn("rounded-lg", activeNav === "custom" && "bg-violet-500/10 shadow-[inset_2px_0_0_0_#a78bfa]")}>
                <p className={cn("px-3 pt-1.5 text-sm font-medium", activeNav === "custom" ? "text-white" : "text-slate-300")}>Custom Range</p>
                <div className="flex flex-col gap-1.5 px-3 pb-2 pt-1">
                  <label className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="w-8 shrink-0">From</span>
                    <input
                      type="date"
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                      aria-label="Range start date"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="w-8 shrink-0">To</span>
                    <input
                      type="date"
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                      aria-label="Range end date"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => applyRange(rangeFrom, rangeTo)}
                    disabled={!rangeFrom || !rangeTo}
                    className="mt-0.5 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Apply range
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </nav>

        <section className="mb-4" aria-label="Impact">
          <SectionTitle>Impact</SectionTitle>
          <ul className="flex flex-col gap-0.5">
            {IMPACTS.map((impact) => {
              const selected = selectedImpacts.includes(impact.value);
              return (
                <li key={impact.value}>
                  <button
                    type="button"
                    onClick={() => toggleMulti("impact", impact.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-1 text-left text-sm transition-colors motion-reduce:transition-none",
                      selected ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", impact.dot)} aria-hidden="true" />
                    <span className="flex-1">{impact.label}</span>
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                        selected ? "border-violet-400 bg-violet-500" : "border-white/20"
                      )}
                      aria-hidden="true"
                    >
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-4" aria-label="Category">
          <SectionTitle>Categories</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => toggleMulti("category", category.value)}
                aria-pressed={selectedCategories.includes(category.value)}
                className={pillClass(selectedCategories.includes(category.value))}
              >
                {category.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4" aria-label="Currency">
          <SectionTitle>Currency</SectionTitle>
          <div className="grid grid-cols-4 gap-1.5">
            {currencyList.map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => toggleMulti("currency", currency)}
                aria-pressed={selectedCurrencies.includes(currency)}
                className={cn(pillClass(selectedCurrencies.includes(currency)), "px-0 text-center font-mono tracking-wide")}
              >
                {currency}
              </button>
            ))}
          </div>
        </section>

        {savePreferencesAction && (
          <form action={savePreferencesAction} className="border-t border-white/10 pt-3">
            <input type="hidden" name="impacts" value={selectedImpacts.join(",")} />
            <input type="hidden" name="categories" value={selectedCategories.join(",")} />
            <input type="hidden" name="currencies" value={selectedCurrencies.join(",")} />
            <input type="hidden" name="timezone" value={timezone} />
            <button type="submit" className="text-xs font-medium text-violet-300 underline-offset-2 transition-colors hover:text-violet-200 hover:underline">
              Save these filters as my default
            </button>
          </form>
        )}

        <div // -bottom-4 cancels the aside's p-4: a sticky element otherwise stops 16px short of the edge and content shows through the gap.
        className="sticky -bottom-4 -mx-4 mt-4 border-t border-white/10 bg-[#0b1129] px-4 pb-4 pt-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          >
            {typeof resultCount === "number" ? `Show ${resultCount} event${resultCount === 1 ? "" : "s"}` : "Done"}
          </button>
        </div>
      </aside>
    </div>
  );
}
