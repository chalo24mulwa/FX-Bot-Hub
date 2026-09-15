"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/authorization";

export async function cancelProductSubscriptionAction(subscriptionId: string) {
  const session = await requireSession();
  const subscription = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.userId !== session.user.id) {
    throw new Error("Subscription not found.");
  }
  await db.subscription.update({ where: { id: subscriptionId }, data: { cancelAtPeriodEnd: true } });
  revalidatePath("/dashboard/product-subscriptions");
}

export async function resumeProductSubscriptionAction(subscriptionId: string) {
  const session = await requireSession();
  const subscription = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.userId !== session.user.id) {
    throw new Error("Subscription not found.");
  }
  if (subscription.status !== "ACTIVE") throw new Error("Only an active subscription can be resumed.");
  await db.subscription.update({ where: { id: subscriptionId }, data: { cancelAtPeriodEnd: false } });
  revalidatePath("/dashboard/product-subscriptions");
}
