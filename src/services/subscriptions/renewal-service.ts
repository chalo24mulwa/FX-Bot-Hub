import { db } from "@/lib/db";
import { startSyncLog, finishSyncLog } from "@/repositories/sync-log-repository";
import { createPayment } from "@/lib/payments/payment-service";
import { completePaidOrder, markOrderFailed } from "@/features/checkout/checkout-service";
import { checkRepeatedPaymentFailures } from "@/lib/security/fraud";
import { enqueueEmail } from "@/jobs/send-email";
import { buildPaymentFailedEmail, buildSubscriptionEndingEmail } from "@/emails/templates";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ENDING_REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export interface RenewalResult {
  renewed: number;
  expired: number;
  failed: number;
  remindersSent: number;
}

/**
 * The recurring-billing half of product subscriptions — runs on the same
 * "no in-process scheduler, an external cron calls the trigger script"
 * model as Phase 3's calendar/news sync (see CLAUDE.md). For each due,
 * non-cancelled ACTIVE subscription: charges one more period through
 * PaymentService and calls completePaidOrder() (the exact same function
 * checkout uses), which extends currentPeriodEnd — so a renewal and an
 * initial purchase go through identical order/ledger/invoice/notification
 * logic. This never trusts a frontend "success" state, same as checkout:
 * a renewal is either a real charge that succeeded or it didn't.
 */
export async function runSubscriptionRenewals(): Promise<RenewalResult> {
  const log = await startSyncLog("subscriptionRenewal");
  const now = new Date();
  let renewed = 0;
  let expired = 0;
  let failed = 0;
  let remindersSent = 0;

  try {
    // Cancelled subscriptions whose period has run out: expire, no charge.
    const toExpire = await db.subscription.findMany({
      where: { status: "ACTIVE", cancelAtPeriodEnd: true, currentPeriodEnd: { lte: now } },
    });
    for (const sub of toExpire) {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
      expired += 1;
    }

    // Due for renewal: active, not cancelling, period has ended.
    const due = await db.subscription.findMany({
      where: { status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodEnd: { lte: now } },
      include: { user: true, product: true },
    });

    for (const sub of due) {
      const idempotencyKey = `renewal:${sub.id}:${sub.currentPeriodEnd!.toISOString()}`;
      const existingOrder = await db.order.findUnique({ where: { idempotencyKey } });
      if (existingOrder) continue; // already handled by a previous run of this job

      const order = await db.order.create({
        data: {
          userId: sub.userId,
          idempotencyKey,
          totalCents: sub.product.priceCents,
          currency: sub.product.currency,
          status: "PENDING",
          items: {
            create: [{ productId: sub.productId, unitPriceCents: sub.product.priceCents, quantity: 1 }],
          },
        },
      });

      const payment = await createPayment({
        orderId: order.id,
        amountCents: sub.product.priceCents,
        currency: sub.product.currency,
        description: `FX BOT Hub subscription renewal — ${sub.product.name}`,
        customerEmail: sub.user.email,
      });

      if (payment.status === "SUCCEEDED") {
        await completePaidOrder(order.id);
        renewed += 1;
      } else {
        await markOrderFailed(order.id);
        await db.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
        void checkRepeatedPaymentFailures(sub.userId);
        void enqueueEmail(sub.user.email, buildPaymentFailedEmail(order.id, `${siteUrl}/dashboard/product-subscriptions`));
        failed += 1;
      }
    }

    // Reminder emails for subscriptions about to lapse (cancelled, ending soon).
    const ending = await db.subscription.findMany({
      where: {
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + ENDING_REMINDER_WINDOW_MS) },
      },
      include: { user: true, product: true },
    });
    for (const sub of ending) {
      void enqueueEmail(
        sub.user.email,
        buildSubscriptionEndingEmail(
          sub.product.name,
          sub.currentPeriodEnd!.toLocaleDateString(),
          `${siteUrl}/dashboard/product-subscriptions`
        )
      );
      remindersSent += 1;
    }

    await finishSyncLog(log.id, "SUCCESS", { itemsProcessed: renewed + expired, itemsFailed: failed });
    return { renewed, expired, failed, remindersSent };
  } catch (err) {
    await finishSyncLog(log.id, "FAILED", {
      itemsProcessed: renewed + expired,
      itemsFailed: failed,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
