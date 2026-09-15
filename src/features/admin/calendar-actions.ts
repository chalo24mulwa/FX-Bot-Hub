"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import type { EventImpact, EventCategory } from "@prisma/client";

export interface EconomicEventInput {
  country: string;
  currency: string;
  title: string;
  impact: EventImpact;
  category: EventCategory;
  eventTime: string; // ISO — form inputs give strings
  actual?: string;
  forecast?: string;
  previous?: string;
  description?: string;
}

/** Manual override — the same path a real provider's sync would use
 * (source: "manual"), so an admin can create/fix a calendar row when the
 * data is wrong or a provider is down. */
export async function createEconomicEventAction(input: EconomicEventInput) {
  const session = await requirePermission("calendar:manage");
  const event = await db.economicEvent.create({
    data: { ...input, eventTime: new Date(input.eventTime), source: "manual" },
  });
  await recordAuditLog({ actorId: session.user.id, action: "calendar_event.create", entityType: "EconomicEvent", entityId: event.id });
  revalidatePath("/admin/calendar");
  revalidatePath("/calendar");
  return event;
}

export async function updateEconomicEventAction(id: string, input: Partial<EconomicEventInput>) {
  const session = await requirePermission("calendar:manage");
  const event = await db.economicEvent.update({
    where: { id },
    data: { ...input, eventTime: input.eventTime ? new Date(input.eventTime) : undefined },
  });
  await recordAuditLog({ actorId: session.user.id, action: "calendar_event.update", entityType: "EconomicEvent", entityId: id });
  revalidatePath("/admin/calendar");
  revalidatePath("/calendar");
  return event;
}

export async function deleteEconomicEventAction(id: string) {
  const session = await requirePermission("calendar:manage");
  await db.economicEvent.delete({ where: { id } });
  await recordAuditLog({ actorId: session.user.id, action: "calendar_event.delete", entityType: "EconomicEvent", entityId: id });
  revalidatePath("/admin/calendar");
  revalidatePath("/calendar");
}
