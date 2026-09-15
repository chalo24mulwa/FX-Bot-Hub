import { db } from "@/lib/db";
import type { AlertChannel, AlertType } from "@prisma/client";

export interface SubscribeInput {
  userId: string;
  type: AlertType;
  targetId: string;
  channels?: AlertChannel[];
}

export async function subscribeToAlert({ userId, type, targetId, channels }: SubscribeInput) {
  return db.alert.upsert({
    where: { userId_type_targetId: { userId, type, targetId } },
    update: { channels: channels ?? ["IN_APP"] },
    create: { userId, type, targetId, channels: channels ?? ["IN_APP"] },
  });
}

export async function unsubscribeFromAlert(userId: string, type: AlertType, targetId: string) {
  await db.alert.deleteMany({ where: { userId, type, targetId } });
}

export async function listUserAlerts(userId: string) {
  return db.alert.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function isSubscribed(userId: string, type: AlertType, targetId: string): Promise<boolean> {
  const row = await db.alert.findUnique({
    where: { userId_type_targetId: { userId, type, targetId } },
  });
  return row !== null;
}
