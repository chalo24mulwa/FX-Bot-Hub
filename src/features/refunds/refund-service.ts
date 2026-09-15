import { db } from "@/lib/db";
import { refundPayment as chargeRefundThroughProvider } from "@/lib/payments/payment-service";
import { recordLedgerEntry } from "@/repositories/ledger-repository";
import { markInvoiceRefunded } from "@/repositories/invoice-repository";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { createNotification } from "@/repositories/notification-repository";
import { enqueueEmail } from "@/jobs/send-email";
import { buildRefundEmail, buildSellerRefundNoticeEmail } from "@/emails/templates";

export class RefundError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * A refund targets a whole Order's Payment (real-world processors refund a
 * charge, and this app's Payment is per-Order, not per-item) — so a
 * refund reverses every item in the order: License revoked / Subscription
 * canceled, each item's Invoice marked REFUNDED, and a REFUND ledger entry
 * per seller reversing their net share of that item's sale. Partial
 * (single-item) refunds of a multi-item order aren't supported — a
 * deliberate scope limit, not an oversight, since allocating a partial
 * refund across items/commissions correctly needs a design of its own.
 */
export async function requestRefund(input: { orderId: string; requestedByUserId: string; reason?: string }) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw new RefundError("Order not found.", 404);
  if (order.status !== "PAID") throw new RefundError("Only a paid order can be refunded.", 409);
  const payment = order.payments[0];
  if (!payment) throw new RefundError("No successful payment found for this order.", 409);

  const existing = await db.refund.findFirst({
    where: { orderId: order.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSED"] } },
  });
  if (existing) throw new RefundError("A refund has already been requested for this order.", 409);

  const refund = await db.refund.create({
    data: {
      paymentId: payment.id,
      orderId: order.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      reason: input.reason,
      status: "REQUESTED",
      requestedByUserId: input.requestedByUserId,
    },
  });

  await recordAuditLog({
    actorId: input.requestedByUserId,
    action: "refund.request",
    entityType: "Refund",
    entityId: refund.id,
    metadata: { orderId: order.id },
  });

  return refund;
}

export async function rejectRefund(refundId: string, actorId: string) {
  const refund = await db.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new RefundError("Refund not found.", 404);
  if (refund.status !== "REQUESTED") throw new RefundError("Only a requested refund can be rejected.", 409);

  const updated = await db.refund.update({
    where: { id: refundId },
    data: { status: "REJECTED", processedByUserId: actorId },
  });
  await recordAuditLog({ actorId, action: "refund.reject", entityType: "Refund", entityId: refundId });
  return updated;
}

/**
 * Approves and processes a refund in one step (there is no separate
 * manual "capture" for the synchronous manual provider — an async
 * processor, once implemented, would still resolve inline here since the
 * provider call is awaited before this returns). Reverses licenses/
 * subscriptions/invoices/ledger for every item and marks the order
 * REFUNDED. Idempotent against a duplicate click — a refund not still in
 * REQUESTED status is rejected outright.
 */
export async function approveAndProcessRefund(refundId: string, actorId: string) {
  const refund = await db.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new RefundError("Refund not found.", 404);
  if (refund.status !== "REQUESTED") throw new RefundError("Refund is not awaiting approval.", 409);

  const order = await db.order.findUnique({
    where: { id: refund.orderId },
    include: { items: { include: { product: { include: { seller: true } } } }, user: true },
  });
  if (!order) throw new RefundError("Order not found.", 404);

  const providerResult = await chargeRefundThroughProvider({
    paymentId: refund.paymentId,
    amountCents: refund.amountCents,
    reason: refund.reason ?? undefined,
  });

  await db.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refundId },
      data: {
        status: "PROCESSED",
        processedByUserId: actorId,
        providerRefundReference: providerResult.providerRefundReference,
      },
    });
    await tx.payment.update({ where: { id: refund.paymentId }, data: { status: "REFUNDED" } });
    await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });

    for (const item of order.items) {
      if (item.product.pricingType === "SUBSCRIPTION") {
        await tx.subscription.updateMany({
          where: { userId: order.userId, productId: item.productId },
          data: { status: "CANCELED", cancelAtPeriodEnd: true },
        });
      } else {
        await tx.license.updateMany({
          where: { userId: order.userId, productId: item.productId, orderId: order.id },
          data: { status: "REVOKED" },
        });
      }

      await markInvoiceRefunded(item.id).catch(() => undefined); // no-op if no invoice exists (shouldn't happen for a PAID order)

      const grossCents = item.unitPriceCents * item.quantity;
      await recordLedgerEntry(
        {
          sellerId: item.product.sellerId,
          type: "REFUND",
          amountCents: -grossCents,
          currency: order.currency,
          orderId: order.id,
          orderItemId: item.id,
          refundId: refund.id,
          description: `Refund: ${item.product.name} x${item.quantity}`,
        },
        tx
      );
    }
  });

  for (const item of order.items) {
    void createNotification({
      userId: item.product.sellerId,
      type: "GENERAL",
      title: `Refund issued: "${item.product.name}"`,
      body: `Order #${order.id.slice(0, 8)} was refunded.`,
      link: "/seller/orders",
    });
    void enqueueEmail(
      item.product.seller.email,
      buildSellerRefundNoticeEmail(item.product.name, item.unitPriceCents * item.quantity, order.currency)
    );
    void enqueueEmail(order.user.email, buildRefundEmail(item.product.name, item.unitPriceCents * item.quantity, order.currency));
  }

  await recordAuditLog({
    actorId,
    action: "refund.process",
    entityType: "Refund",
    entityId: refundId,
    metadata: { orderId: order.id, amountCents: refund.amountCents },
  });

  return db.refund.findUniqueOrThrow({ where: { id: refundId } });
}

export async function listRefunds(page: number, pageSize: number, status?: "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSED") {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    db.refund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { order: { include: { user: { select: { name: true, email: true } } } } },
    }),
    db.refund.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
