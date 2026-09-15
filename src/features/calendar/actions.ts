"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authorization";
import { db } from "@/lib/db";
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

  await db.calendarPreference.upsert({
    where: { userId: session.user.id },
    update: { impacts, categories, currencies },
    create: { userId: session.user.id, impacts, categories, currencies },
  });

  revalidatePath("/calendar");
}
