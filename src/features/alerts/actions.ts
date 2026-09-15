"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authorization";
import { db } from "@/lib/db";
import { subscribeToAlert, unsubscribeFromAlert } from "./alert-service";
import { scheduleEventReminder } from "./dispatch-service";
import type { AlertType, AlertChannel } from "@prisma/client";

export async function subscribeToAlertAction(type: AlertType, targetId: string, channels?: AlertChannel[]) {
  const session = await requireSession();
  const alert = await subscribeToAlert({ userId: session.user.id, type, targetId, channels });

  if (type === "ECONOMIC_EVENT") {
    const event = await db.economicEvent.findUnique({ where: { id: targetId } });
    if (event) void scheduleEventReminder(alert.id, event);
  }

  revalidatePath("/dashboard/alerts");
  return alert;
}

export async function unsubscribeFromAlertAction(type: AlertType, targetId: string) {
  const session = await requireSession();
  await unsubscribeFromAlert(session.user.id, type, targetId);
  revalidatePath("/dashboard/alerts");
}
