import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvents } from "@/services/calendar/calendar-service";
import { getCustomRange } from "@/lib/calendar/date-ranges";
import { DEFAULT_CALENDAR_TIMEZONE } from "@/lib/calendar/timezone";
import { CalendarTable } from "@/components/calendar/calendar-table";
import { CalendarAttribution } from "@/components/calendar/calendar-attribution";

export const dynamic = "force-dynamic";

interface WeekCalendarPageProps {
  params: Promise<{ date: string }>;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function generateMetadata({ params }: WeekCalendarPageProps): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `News Calendar — Week of ${date}`,
    alternates: { canonical: `/calendar/week/${date}` },
  };
}

export default async function WeekCalendarPage({ params }: WeekCalendarPageProps) {
  const { date } = await params;
  if (!DATE_PATTERN.test(date)) notFound();

  const range = getCustomRange(date, 7, 0);
  const { items, total } = await getEvents({ from: range.from, to: range.to, pageSize: 250 });

  return (
    <main className="mx-auto max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Week of {date}</h1>
      <p className="mt-1 text-sm text-slate-500">{total} event{total === 1 ? "" : "s"}</p>
      <CalendarTable events={items} timezone={DEFAULT_CALENDAR_TIMEZONE} />
      <CalendarAttribution className="mt-8" />
    </main>
  );
}
