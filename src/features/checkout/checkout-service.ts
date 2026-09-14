import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payments";
import { ensureLicense } from "@/features/downloads/entitlement-service";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import { buildOrderPaidEmail, buildSaleNotificationEmail } from "@/emails/templates";

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface CheckoutResult {
  orderId: string;
  status: "paid" | "pending";
  redirectUrl: string | null;
}

/**
 * Creates an Order + OrderItems from the user's cart, charges via the
 * configured PaymentProvider, and — if the charge settles synchronously
 * (true today for the "manual" dev provider) — marks the order PAID and
 * issues licenses immediately. An async provider (Stripe/M-Pesa) instead
 * leaves the order PENDING; completePayment() (called from a webhook)
 * finishes the job later. Callers must not assume PAID on return — check
 * `status`.
 */
export async function checkoutCart(userId: string, userEmail: string): Promise<CheckoutResult> {
  const cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) {
    throw new CheckoutError("Your cart is empty.");
  }

  const existingLicenses = await db.license.findMany({
    where: { userId, productId: { in: cart.items.map((i) => i.productId) } },
    select: { productId: true },
  });
  const alreadyOwned = new Set(existingLicenses.map((l) => l.productId));
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

  const order = await db.order.create({
    data: {
      userId,
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
    include: { items: { include: { product: true } } },
  });

  const charge = await paymentProvider.createCharge({
    orderId: order.id,
    amountCents: totalCents,
    currency,
    description: `FX Bot Market order #${order.id.slice(0, 8)}`,
    customerEmail: userEmail,
  });

  await db.payment.create({
    data: {
      orderId: order.id,
      provider: paymentProvider.name,
      status: charge.status === "succeeded" ? "SUCCEEDED" : "INITIATED",
      amountCents: totalCents,
      currency,
      providerReference: charge.providerReference,
    },
  });

  if (charge.status === "succeeded") {
    await completePaidOrder(order.id);
    return { orderId: order.id, status: "paid", redirectUrl: null };
  }

  return { orderId: order.id, status: "pending", redirectUrl: charge.redirectUrl };
}

/** Marks an order PAID, issues licenses, clears the buyer's cart of those
 * items, and notifies buyer + sellers. Idempotent — safe to call twice for
 * the same order (e.g. a retried webhook). */
export async function completePaidOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { include: { seller: true } } } } },
  });
  if (!order) throw new CheckoutError("Order not found.", 404);
  if (order.status === "PAID") return order;

  await db.order.update({ where: { id: order.id }, data: { status: "PAID" } });

  const cart = await db.cart.findUnique({ where: { userId: order.userId } });

  for (const item of order.items) {
    await ensureLicense(order.userId, item.productId, order.id);
    if (cart) {
      await db.cartItem.deleteMany({ where: { cartId: cart.id, productId: item.productId } });
    }

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

  const buyer = await db.user.findUnique({ where: { id: order.userId } });
  if (buyer) {
    void enqueueEmail(buyer.email, buildOrderPaidEmail(order.id, `${siteUrl}/dashboard/orders`));
  }

  return db.order.findUniqueOrThrow({ where: { id: order.id } });
}

export async function markOrderFailed(orderId: string) {
  return db.order.update({ where: { id: orderId }, data: { status: "FAILED" } });
}
