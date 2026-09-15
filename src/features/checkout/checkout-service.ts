import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createPayment } from "@/lib/payments/payment-service";
import { ensureLicense } from "@/features/downloads/entitlement-service";
import { computeCommission } from "@/lib/commerce/commission";
import { getMarketplaceSettings } from "@/features/admin/settings-service";
import { recordLedgerEntry } from "@/repositories/ledger-repository";
import { createInvoiceForOrderItem } from "@/repositories/invoice-repository";
import { checkRepeatedPaymentFailures } from "@/lib/security/fraud";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import {
  buildOrderPaidEmail,
  buildSaleNotificationEmail,
  buildDownloadAvailableEmail,
  buildPaymentFailedEmail,
  buildSubscriptionStartedEmail,
} from "@/emails/templates";

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SUBSCRIPTION_PERIOD_DAYS = 30;

export interface CheckoutResult {
  orderId: string;
  status: "paid" | "pending" | "failed";
  redirectUrl: string | null;
}

function toCheckoutResult(order: { id: string; status: string }): CheckoutResult {
  if (order.status === "PAID") return { orderId: order.id, status: "paid", redirectUrl: null };
  if (order.status === "FAILED" || order.status === "CANCELLED") {
    return { orderId: order.id, status: "failed", redirectUrl: null };
  }
  return { orderId: order.id, status: "pending", redirectUrl: null };
}

/**
 * Creates an Order + OrderItems from the user's cart, charges via
 * PaymentService, and — if the charge settles synchronously (true today
 * for the "manual" dev provider) — marks the order PAID and issues
 * licenses/subscriptions immediately. An async provider (Stripe/M-Pesa)
 * instead leaves the order PENDING; a webhook (src/app/api/payments/
 * webhook) finishes the job later via completePaidOrder(). Callers must
 * not assume PAID on return — check `status`. See PRODUCTION REQUIREMENT
 * in CLAUDE.md: a frontend "success" page is never itself the source of
 * truth for whether an order is paid.
 *
 * `idempotencyKey`, when supplied, makes a retried call (a double-click, a
 * network retry replaying the same request) return the *existing* order
 * instead of creating a duplicate one — see Order.idempotencyKey.
 */
export async function checkoutCart(userId: string, userEmail: string, idempotencyKey?: string): Promise<CheckoutResult> {
  if (idempotencyKey) {
    const existing = await db.order.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.userId !== userId) throw new CheckoutError("Invalid request.", 409);
      return toCheckoutResult(existing);
    }
  }

  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) {
    throw new CheckoutError("Your cart is empty.");
  }

  const [existingLicenses, existingSubscriptions] = await Promise.all([
    db.license.findMany({
      where: { userId, productId: { in: cart.items.map((i) => i.productId) } },
      select: { productId: true },
    }),
    db.subscription.findMany({
      where: {
        userId,
        productId: { in: cart.items.map((i) => i.productId) },
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      select: { productId: true },
    }),
  ]);
  const alreadyOwned = new Set([
    ...existingLicenses.map((l) => l.productId),
    ...existingSubscriptions.map((s) => s.productId),
  ]);
  const items = cart.items.filter((i) => !alreadyOwned.has(i.productId));
  if (items.length === 0) {
    throw new CheckoutError("You already own everything in your cart.");
  }
  for (const item of items) {
    if (item.product.status !== "PUBLISHED") {
      throw new CheckoutError(`"${item.product.name}" is no longer available.`);
    }
  }

  const currency = items[0].product.currency;
  const totalCents = items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);

  let order;
  try {
    order = await db.order.create({
      data: {
        userId,
        idempotencyKey,
        totalCents,
        currency,
        status: "PENDING",
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            unitPriceCents: i.product.priceCents,
            quantity: i.quantity,
          })),
        },
      },
    });
  } catch (err) {
    // Two truly concurrent requests with the same idempotencyKey (not just
    // a sequential retry) can both pass the findUnique check above before
    // either commits — the DB's own unique constraint is the real guard
    // against a duplicate order here. Losing this race isn't an error: it
    // means the other request is the one creating the order, so fetch and
    // return its result instead of a charge going through twice.
    if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.order.findUnique({ where: { idempotencyKey } });
      if (existing) return toCheckoutResult(existing);
    }
    throw err;
  }

  const payment = await createPayment({
    orderId: order.id,
    amountCents: totalCents,
    currency,
    description: `FX Bot Market order #${order.id.slice(0, 8)}`,
    customerEmail: userEmail,
  });

  if (payment.status === "SUCCEEDED") {
    await completePaidOrder(order.id);
    return { orderId: order.id, status: "paid", redirectUrl: null };
  }

  if (payment.status === "FAILED") {
    await markOrderFailed(order.id);
    void checkRepeatedPaymentFailures(userId);
    void enqueueEmail(userEmail, buildPaymentFailedEmail(order.id, `${siteUrl}/cart`));
    return { orderId: order.id, status: "failed", redirectUrl: null };
  }

  const redirectUrl = (payment.rawPayload as { redirectUrl?: string } | null)?.redirectUrl ?? null;
  return { orderId: order.id, status: "pending", redirectUrl };
}

/** Marks an order PAID, issues licenses/subscriptions, records the
 * commission split + invoice + ledger entries for each item's seller,
 * clears the buyer's cart of those items, and notifies buyer + sellers.
 * Idempotent — safe to call twice for the same order (e.g. a retried
 * webhook), since it returns early once the order is already PAID. */
export async function completePaidOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { seller: true } } } },
      payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) throw new CheckoutError("Order not found.", 404);
  if (order.status === "PAID") return order;

  const settings = await getMarketplaceSettings();
  const paymentReference = order.payments[0]?.providerReference ?? undefined;

  await db.order.update({ where: { id: order.id }, data: { status: "PAID" } });

  const [cart, buyer] = await Promise.all([
    db.cart.findUnique({ where: { userId: order.userId } }),
    db.user.findUniqueOrThrow({ where: { id: order.userId } }),
  ]);

  for (const item of order.items) {
    const grossCents = item.unitPriceCents * item.quantity;

    if (item.product.pricingType === "SUBSCRIPTION") {
      await db.subscription.upsert({
        where: { userId_productId: { userId: order.userId, productId: item.productId } },
        update: {
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 86_400_000),
          cancelAtPeriodEnd: false,
        },
        create: {
          userId: order.userId,
          productId: item.productId,
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 86_400_000),
          provider: order.payments[0]?.provider,
          providerReference: paymentReference,
        },
      });
      void enqueueEmail(
        buyer.email,
        buildSubscriptionStartedEmail(item.product.name, `${siteUrl}/dashboard/product-subscriptions`)
      );
    } else {
      await ensureLicense(order.userId, item.productId, order.id);
    }

    if (cart) {
      await db.cartItem.deleteMany({ where: { cartId: cart.id, productId: item.productId } });
    }

    const split = computeCommission(grossCents, settings.commissionPercent);
    await recordLedgerEntry({
      sellerId: item.product.sellerId,
      type: "SALE",
      amountCents: split.grossCents,
      currency: order.currency,
      orderId: order.id,
      orderItemId: item.id,
      description: `Sale: ${item.product.name} x${item.quantity}`,
    });
    await recordLedgerEntry({
      sellerId: item.product.sellerId,
      type: "COMMISSION",
      amountCents: -split.commissionCents,
      currency: order.currency,
      orderId: order.id,
      orderItemId: item.id,
      description: `Marketplace commission (${settings.commissionPercent}%): ${item.product.name}`,
    });
    await createInvoiceForOrderItem({
      orderId: order.id,
      orderItemId: item.id,
      buyerId: order.userId,
      sellerId: item.product.sellerId,
      productId: item.productId,
      amountCents: grossCents,
      currency: order.currency,
      paymentReference,
    });

    void createNotification({
      userId: item.product.sellerId,
      type: "ORDER_PAID",
      title: `New sale: "${item.product.name}"`,
      body: `${item.quantity} x ${(item.unitPriceCents / 100).toFixed(2)} ${order.currency}`,
      link: `/seller/orders`,
    });
    void enqueueEmail(
      item.product.seller.email,
      buildSaleNotificationEmail(item.product.name, item.quantity * item.unitPriceCents, order.currency)
    );
  }

  void enqueueEmail(buyer.email, buildOrderPaidEmail(order.id, `${siteUrl}/dashboard/orders`));
  for (const item of order.items) {
    if (item.product.pricingType !== "SUBSCRIPTION") {
      void enqueueEmail(
        buyer.email,
        buildDownloadAvailableEmail(item.product.name, `${siteUrl}/dashboard/orders/${order.id}`)
      );
    }
  }

  return db.order.findUniqueOrThrow({ where: { id: order.id } });
}

export async function markOrderFailed(orderId: string) {
  return db.order.update({ where: { id: orderId }, data: { status: "FAILED" } });
}
