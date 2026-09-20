import Link from "next/link";
import { after } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getEvents, listDistinctCurrencies } from "@/services/calendar/calendar-service";
import { getPresetRange, getCustomRange, getRangeBetween, type CalendarPreset } from "@/lib/calendar/date-ranges";
import { resolveTimezone, getTimezoneOffsetMinutes, CALENDAR_TIMEZONE_COOKIE } from "@/lib/calendar/timezone";
import { CalendarTable } from "@/components/calendar/calendar-table";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { CalendarAutoRefresh } from "@/components/calendar/calendar-auto-refresh";
import { CalendarAttribution } from "@/components/calendar/calendar-attribution";
import { runCalendarSyncIfDue } from "@/services/calendar/auto-sync";
import { saveCalendarPreferencesAction } from "@/features/calendar/actions";
import { track } from "@/lib/analytics/track";
import { env } from "@/lib/env";
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

  const [{ items, total }, allCurrencies] = await Promise.all([
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
  ]);

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
    <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-6 py-12">
      <CalendarAutoRefresh intervalSeconds={env.ECONOMIC_CALENDAR_POLL_INTERVAL_SECONDS} />
      <h1 className="text-2xl font-semibold text-slate-900">Economic calendar</h1>
      <p className="mt-1 text-sm text-slate-500">{total} event{total === 1 ? "" : "s"} in this range</p>

      <div className="mt-6">
        <CalendarFilters
          currencies={allCurrencies}
          timezone={timezone}
          from={fromParam}
          to={toParam}
          savePreferencesAction={session?.user ? saveCalendarPreferencesAction : undefined}
        />
      </div>

      <CalendarTable events={items} timezone={timezone} />

      {(hasPrevPage || hasNextPage) && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {hasPrevPage ? (
            <Link href={pageHref(pageParam - 1)} className="text-slate-600 hover:underline">
              ← Previous {PAGE_SIZE}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-400">
            {(pageParam - 1) * PAGE_SIZE + 1}–{Math.min(pageParam * PAGE_SIZE, total)} of {total}
          </span>
          {hasNextPage ? (
            <Link href={pageHref(pageParam + 1)} className="text-slate-600 hover:underline">
              Next {PAGE_SIZE} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      <CalendarAttribution className="mt-8" />
      <p className="mt-2 max-w-2xl text-xs text-slate-400">
        Economic events can affect markets but do not guarantee a particular market movement. Data is
        admin-managed and, where noted, sourced from third-party providers — see individual event pages for
        source attribution.
      </p>
    </main>
  );
}
