import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payments";
import { SignalError } from "./signal-service";

const PERIOD_DAYS = 30;

export interface SubscribeResult {
  status: "active" | "pending";
  redirectUrl: string | null;
}

/**
 * Signal-provider billing goes through the exact same PaymentProvider
 * interface as marketplace checkout (src/lib/payments) — deliberately not
 * a second payment integration. FREE providers activate instantly with no
 * charge; SUBSCRIPTION providers charge one period up front (the "manual"
 * dev provider settles synchronously, same as marketplace checkout).
 */
export async function subscribeToProvider(userId: string, providerId: string, userEmail: string): Promise<SubscribeResult> {
  const provider = await db.signalProviderProfile.findUnique({ where: { id: providerId } });
  if (!provider) throw new SignalError("Provider not found.", 404);

  const existing = await db.signalSubscription.findUnique({
    where: { userId_providerId: { userId, providerId } },
  });
  if (existing?.status === "ACTIVE") throw new SignalError("Already subscribed.", 409);

  if (provider.pricingType === "FREE") {
    await db.signalSubscription.upsert({
      where: { userId_providerId: { userId, providerId } },
      update: { status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodEnd: null },
      create: { userId, providerId, status: "ACTIVE" },
    });
    return { status: "active", redirectUrl: null };
  }

  const charge = await paymentProvider.createCharge({
    orderId: `signal-sub:${userId}:${providerId}:${Date.now()}`,
    amountCents: provider.priceCents,
    currency: provider.currency,
    description: `Subscription to ${provider.displayName}'s signals`,
    customerEmail: userEmail,
  });

  if (charge.status === "succeeded") {
    const currentPeriodEnd = new Date(Date.now() + PERIOD_DAYS * 86_400_000);
    await db.signalSubscription.upsert({
      where: { userId_providerId: { userId, providerId } },
      update: { status: "ACTIVE", currentPeriodEnd, cancelAtPeriodEnd: false },
      create: { userId, providerId, status: "ACTIVE", currentPeriodEnd },
    });
    return { status: "active", redirectUrl: null };
  }

  // Async provider (Stripe/M-Pesa, once implemented): leave no subscription
  // row yet — a webhook confirming payment would create it, mirroring
  // completePaidOrder() in the marketplace checkout flow.
  return { status: "pending", redirectUrl: charge.redirectUrl };
}

export async function cancelSubscription(userId: string, providerId: string) {
  await db.signalSubscription.updateMany({
    where: { userId, providerId },
    data: { cancelAtPeriodEnd: true, status: "CANCELED" },
  });
}

export async function pauseSubscription(userId: string, providerId: string) {
  await db.signalSubscription.updateMany({ where: { userId, providerId }, data: { status: "PAUSED" } });
}

export async function resumeSubscription(userId: string, providerId: string) {
  await db.signalSubscription.updateMany({
    where: { userId, providerId, status: "PAUSED" },
    data: { status: "ACTIVE" },
  });
}

export async function hasActiveSubscription(userId: string, providerId: string): Promise<boolean> {
  const sub = await db.signalSubscription.findUnique({ where: { userId_providerId: { userId, providerId } } });
  return sub?.status === "ACTIVE";
}

export async function listUserSubscriptions(userId: string) {
  return db.signalSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { provider: { select: { displayName: true, slug: true } } },
  });
}
