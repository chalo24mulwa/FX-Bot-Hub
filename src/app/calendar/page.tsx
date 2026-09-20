import Link from "next/link";
import { after } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getEvents, listDistinctCurrencies, getCalendarLastUpdated } from "@/services/calendar/calendar-service";
import { getPresetRange, getCustomRange, getRangeBetween, type CalendarPreset } from "@/lib/calendar/date-ranges";
import {
  resolveTimezone,
  getTimezoneOffsetMinutes,
  formatInTimezone,
  formatRangeLabel,
  formatAge,
  CALENDAR_TIMEZONE_COOKIE,
} from "@/lib/calendar/timezone";
import { CalendarTable } from "@/components/calendar/calendar-table";
import { CalendarFilters, CalendarTimezoneSelect } from "@/components/calendar/calendar-filters";
import { CalendarAutoRefresh } from "@/components/calendar/calendar-auto-refresh";
import { CalendarAttribution } from "@/components/calendar/calendar-attribution";
import { runCalendarSyncIfDue } from "@/services/calendar/auto-sync";
import { saveCalendarPreferencesAction } from "@/features/calendar/actions";
import { track } from "@/lib/analytics/track";
import { env } from "@/lib/env";
import { CalendarDays } from "lucide-react";
import type { EventImpact, EventCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

interface CalendarPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const VALID_PRESETS: CalendarPreset[] = ["today", "tomorrow", "week", "next_week"];

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);

  const tzParam = typeof params.tz === "string" ? params.tz : undefined;
  const timezone = resolveTimezone(tzParam ?? cookieStore.get(CALENDAR_TIMEZONE_COOKIE)?.value);
  const offsetMinutes = getTimezoneOffsetMinutes(timezone);

  const presetParam = typeof params.preset === "string" ? params.preset : "week";
  const fromParam = typeof params.from === "string" ? params.from : undefined;
  const toParam = typeof params.to === "string" ? params.to : undefined;
  const range =
    presetParam === "range" && fromParam && toParam
      ? getRangeBetween(fromParam, toParam, offsetMinutes)
      : presetParam === "custom" && typeof params.date === "string"
        ? getCustomRange(params.date, 1, offsetMinutes)
        : getPresetRange(
            VALID_PRESETS.includes(presetParam as CalendarPreset) ? (presetParam as CalendarPreset) : "week",
            new Date(),
            offsetMinutes
          );

  const impacts = ([] as string[]).concat(params.impact ?? []) as EventImpact[];
  const categories = ([] as string[]).concat(params.category ?? []) as EventCategory[];
  const currencies = ([] as string[]).concat(params.currency ?? []);
  const pageParam = typeof params.page === "string" ? Math.max(1, parseInt(params.page, 10) || 1) : 1;
  const PAGE_SIZE = 250;

  const [{ items, total }, allCurrencies, lastUpdated] = await Promise.all([
    getEvents({
      from: range.from,
      to: range.to,
      impacts: impacts.length ? impacts : undefined,
      categories: categories.length ? categories : undefined,
      currencies: currencies.length ? currencies : undefined,
      page: pageParam,
      pageSize: PAGE_SIZE,
    }),
    listDistinctCurrencies(),
    getCalendarLastUpdated(),
  ]);

  const now = new Date();
  const todayDate = formatInTimezone(now, timezone).date;
  const rangeLabel = formatRangeLabel(range.from, range.to, timezone);
  // "Live" only while the feed is actually fresh: within two sync intervals.
  const isFresh = !!lastUpdated && now.getTime() - lastUpdated.getTime() <= env.ECONOMIC_CALENDAR_SYNC_INTERVAL_MINUTES * 2 * 60_000;

  // A single week rarely has more than PAGE_SIZE events, but a multi-month
  // range genuinely can once real provider data is flowing — surface
  // pagination instead of silently truncating at 250. Preserves every
  // other query param (filters, range, timezone), only swapping `page`.
  const hasNextPage = pageParam * PAGE_SIZE < total;
  const hasPrevPage = pageParam > 1;
  function pageHref(nextPage: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
    }
    next.set("page", String(nextPage));
    return `/calendar?${next.toString()}`;
  }

  // Keep the calendar fresh with no scheduler: if the last sync is older than
  // the configured interval, one background sync runs after this response is
  // sent (never blocking it). The page itself only ever reads our own DB —
  // see src/services/calendar/auto-sync.ts.
  after(() => runCalendarSyncIfDue({ trigger: "page" }));

  void track({ type: "CALENDAR_VIEW", userId: session?.user.id, metadata: { preset: presetParam } });

  return (
    // Terminal-style band: a deep-navy page with soft brand glows (violet left,
    // amber right) behind a two-column layout — sticky filter sidebar + the
    // light calendar surface. `w-full min-w-0` stay: without them a wide table
    // pushes the whole flex chain wider than the viewport (see layout.tsx).
    <main
      className="w-full min-w-0 flex-1 bg-[#070c1d]"
      style={{
        backgroundImage:
          "radial-gradient(60% 45% at 8% 0%, rgba(139,92,246,0.20), transparent 70%), radial-gradient(45% 40% at 96% 0%, rgba(245,158,11,0.11), transparent 70%), linear-gradient(180deg, #080e24 0%, #0a1030 55%, #0c1236 100%)",
      }}
    >
      <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:gap-y-4 lg:py-8">
        {/* Header — sits beside the sidebar, so the table starts near the top. */}
        <header className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Economic Calendar
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                    isFresh ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {isFresh && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />}
                    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isFresh ? "bg-emerald-400" : "bg-amber-400"}`} />
                  </span>
                  {isFresh ? "Live" : "Cached"}
                </span>
              </h1>
              <p className="mt-1 text-sm text-slate-400">Live economic events and market-moving announcements</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CalendarTimezoneSelect timezone={timezone} />
              <CalendarAutoRefresh intervalSeconds={env.ECONOMIC_CALENDAR_POLL_INTERVAL_SECONDS} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 font-medium text-violet-100">
              <CalendarDays className="h-4 w-4 text-violet-300" aria-hidden="true" />
              {rangeLabel}
            </span>
            <span className="text-slate-300">
              <span className="font-semibold text-white">{total}</span> event{total === 1 ? "" : "s"} in this range
            </span>
            <span className="text-xs text-slate-500" title={lastUpdated ? lastUpdated.toISOString() : undefined}>
              {lastUpdated
                ? `Updated ${formatAge(lastUpdated, now)} · ${formatInTimezone(lastUpdated, timezone).time}`
                : "Awaiting first update"}
            </span>
          </div>
        </header>

        <CalendarFilters
          currencies={allCurrencies}
          timezone={timezone}
          from={fromParam}
          to={toParam}
          resultCount={total}
          savePreferencesAction={session?.user ? saveCalendarPreferencesAction : undefined}
        />

        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <CalendarTable events={items} timezone={timezone} todayDate={todayDate} />

          {(hasPrevPage || hasNextPage) && (
            <div className="mt-4 flex items-center justify-between text-sm">
              {hasPrevPage ? (
                <Link href={pageHref(pageParam - 1)} className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-medium text-slate-200 transition-colors hover:bg-white/20">
                  ← Previous {PAGE_SIZE}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-slate-400">
                {(pageParam - 1) * PAGE_SIZE + 1}–{Math.min(pageParam * PAGE_SIZE, total)} of {total}
              </span>
              {hasNextPage ? (
                <Link href={pageHref(pageParam + 1)} className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-medium text-slate-200 transition-colors hover:bg-white/20">
                  Next {PAGE_SIZE} →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}

          <div className="mt-6 space-y-2 [&_a:hover]:text-white [&_p]:text-slate-400">
            <CalendarAttribution />
            <p className="max-w-2xl text-xs text-slate-500">
              Economic events can affect markets but do not guarantee a particular market movement. Data is
              admin-managed and, where noted, sourced from third-party providers — see individual event pages for
              source attribution.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
