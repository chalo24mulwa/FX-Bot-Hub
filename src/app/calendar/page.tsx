import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getEvents, listDistinctCurrencies } from "@/services/calendar/calendar-service";
import { getPresetRange, getCustomRange, type CalendarPreset } from "@/lib/calendar/date-ranges";
import { resolveTimezone, getTimezoneOffsetMinutes, CALENDAR_TIMEZONE_COOKIE } from "@/lib/calendar/timezone";
import { CalendarTable } from "@/components/calendar/calendar-table";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { CalendarAutoRefresh } from "@/components/calendar/calendar-auto-refresh";
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
  const range =
    presetParam === "custom" && typeof params.date === "string"
      ? getCustomRange(params.date, 1, offsetMinutes)
      : getPresetRange(
          VALID_PRESETS.includes(presetParam as CalendarPreset) ? (presetParam as CalendarPreset) : "week",
          new Date(),
          offsetMinutes
        );

  const impacts = ([] as string[]).concat(params.impact ?? []) as EventImpact[];
  const categories = ([] as string[]).concat(params.category ?? []) as EventCategory[];
  const currencies = ([] as string[]).concat(params.currency ?? []);

  const [{ items, total }, allCurrencies] = await Promise.all([
    getEvents({
      from: range.from,
      to: range.to,
      impacts: impacts.length ? impacts : undefined,
      categories: categories.length ? categories : undefined,
      currencies: currencies.length ? currencies : undefined,
      pageSize: 250,
    }),
    listDistinctCurrencies(),
  ]);

  void track({ type: "CALENDAR_VIEW", userId: session?.user.id, metadata: { preset: presetParam } });

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <CalendarAutoRefresh intervalSeconds={env.ECONOMIC_CALENDAR_POLL_INTERVAL_SECONDS} />
      <h1 className="text-2xl font-semibold text-slate-900">Economic calendar</h1>
      <p className="mt-1 text-sm text-slate-500">{total} event{total === 1 ? "" : "s"} in this range</p>

      <div className="mt-6">
        <CalendarFilters
          currencies={allCurrencies}
          timezone={timezone}
          savePreferencesAction={session?.user ? saveCalendarPreferencesAction : undefined}
        />
      </div>

      <CalendarTable events={items} timezone={timezone} />

      <p className="mt-8 max-w-2xl text-xs text-slate-400">
        Economic events can affect markets but do not guarantee a particular market movement. Data is
        admin-managed and, where noted, sourced from third-party providers — see individual event pages for
        source attribution.
      </p>
    </main>
  );
}
