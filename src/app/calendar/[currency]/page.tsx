import type { Metadata } from "next";
import { getEvents } from "@/services/calendar/calendar-service";
import { getRecentAndUpcomingRange } from "@/lib/calendar/date-ranges";
import { DEFAULT_CALENDAR_TIMEZONE } from "@/lib/calendar/timezone";
import { CalendarTable } from "@/components/calendar/calendar-table";
import { CalendarAttribution } from "@/components/calendar/calendar-attribution";

export const dynamic = "force-dynamic";

interface CurrencyCalendarPageProps {
  params: Promise<{ currency: string }>;
}

export async function generateMetadata({ params }: CurrencyCalendarPageProps): Promise<Metadata> {
  const { currency } = await params;
  const code = currency.toUpperCase();
  return {
    title: `${code} News Calendar`,
    description: `Upcoming and recent ${code} economic events, with impact, forecast, and actual figures.`,
    alternates: { canonical: `/calendar/${currency.toLowerCase()}` },
  };
}

export default async function CurrencyCalendarPage({ params }: CurrencyCalendarPageProps) {
  const { currency } = await params;
  const code = currency.toUpperCase();

  const { from, to } = getRecentAndUpcomingRange();
  const { items, total } = await getEvents({ from, to, currencies: [code], pageSize: 250 });

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">{code} News Calendar</h1>
      <p className="mt-1 text-sm text-slate-500">
        {total} event{total === 1 ? "" : "s"} — last 7 days through next 14 days
      </p>
      <CalendarTable events={items} timezone={DEFAULT_CALENDAR_TIMEZONE} />
      <CalendarAttribution className="mt-8" />
    </main>
  );
}
