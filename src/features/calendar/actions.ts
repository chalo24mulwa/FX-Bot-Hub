"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authorization";
import { db } from "@/lib/db";
import { isSupportedTimezone } from "@/lib/calendar/timezone";
import type { EventImpact, EventCategory } from "@prisma/client";

function splitOrEmpty<T extends string>(value: FormDataEntryValue | null): T[] {
  const str = String(value ?? "");
  return str ? (str.split(",").filter(Boolean) as T[]) : [];
}

export async function saveCalendarPreferencesAction(formData: FormData) {
  const session = await requireSession();
  const impacts = splitOrEmpty<EventImpact>(formData.get("impacts"));
  const categories = splitOrEmpty<EventCategory>(formData.get("categories"));
  const currencies = splitOrEmpty<string>(formData.get("currencies"));
  const timezoneRaw = formData.get("timezone");
  const timezone = isSupportedTimezone(timezoneRaw ? String(timezoneRaw) : null) ? String(timezoneRaw) : null;

  await db.calendarPreference.upsert({
    where: { userId: session.user.id },
    update: { impacts, categories, currencies, timezone },
    create: { userId: session.user.id, impacts, categories, currencies, timezone },
  });

  revalidatePath("/calendar");
}
