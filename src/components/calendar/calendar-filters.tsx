"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { SUPPORTED_TIMEZONES, CALENDAR_TIMEZONE_COOKIE } from "@/lib/calendar/timezone";

const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
];

const IMPACTS = ["HIGH", "MEDIUM", "LOW", "HOLIDAY", "OTHER"];
const CATEGORIES = [
  "CENTRAL_BANK",
  "EMPLOYMENT",
  "INFLATION",
  "GDP",
  "MANUFACTURING",
  "RETAIL",
  "HOUSING",
  "CONSUMER",
  "POLITICS",
  "OTHER",
];

export function CalendarFilters({
  currencies,
  timezone,
  savePreferencesAction,
}: {
  currencies: string[];
  timezone: string;
  savePreferencesAction?: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const preset = searchParams.get("preset") ?? "week";
  const selectedImpacts = searchParams.getAll("impact");
  const selectedCategories = searchParams.getAll("category");
  const selectedCurrencies = searchParams.getAll("currency");

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleTimezoneChange(next: string) {
    // 1 year: long enough that "change once, keep it" holds across normal
    // browsing, short enough that a stale cookie can't outlive the app.
    document.cookie = `${CALENDAR_TIMEZONE_COOKIE}=${next}; path=/; max-age=${365 * 86_400}; samesite=lax`;
    updateParams((params) => params.set("tz", next));
  }

  function toggleMulti(key: string, value: string) {
    updateParams((params) => {
      const current = params.getAll(key);
      params.delete(key);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      next.forEach((v) => params.append(key, v));
    });
  }

  return (
    <div className={cn("flex flex-col gap-4", isPending && "opacity-60")}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => updateParams((params) => params.set("preset", p.value))}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              preset === p.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          onChange={(e) => updateParams((params) => {
            params.set("preset", "custom");
            params.set("date", e.target.value);
          })}
          className="rounded-full border border-slate-300 px-3 py-1 text-sm"
        />
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          Timezone
          <select
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className="rounded-full border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
          >
            {SUPPORTED_TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Impact</p>
          <div className="flex flex-wrap gap-1">
            {IMPACTS.map((impact) => (
              <button
                key={impact}
                onClick={() => toggleMulti("impact", impact)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs",
                  selectedImpacts.includes(impact)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                )}
              >
                {impact}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Category</p>
          <div className="flex max-w-md flex-wrap gap-1">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => toggleMulti("category", category)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs",
                  selectedCategories.includes(category)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                )}
              >
                {category.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {currencies.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Currency</p>
            <div className="flex max-w-xs flex-wrap gap-1">
              {currencies.map((currency) => (
                <button
                  key={currency}
                  onClick={() => toggleMulti("currency", currency)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs",
                    selectedCurrencies.includes(currency)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {savePreferencesAction && (
        <form action={savePreferencesAction}>
          <input type="hidden" name="impacts" value={selectedImpacts.join(",")} />
          <input type="hidden" name="categories" value={selectedCategories.join(",")} />
          <input type="hidden" name="currencies" value={selectedCurrencies.join(",")} />
          <input type="hidden" name="timezone" value={timezone} />
          <button type="submit" className="self-start text-xs text-blue-600 hover:underline">
            Save these filters as my default
          </button>
        </form>
      )}
    </div>
  );
}
