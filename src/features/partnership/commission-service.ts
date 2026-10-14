import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { recordSecurityEvent } from "@/repositories/security-event-repository";
import { formatMoney, holdUntil, isCommissionableOrder, planOrderCommissions, planReversal } from "@/lib/partnership/rules";
import { PartnershipError, getPartnershipSettings, type Tx } from "./core";

// The commission ledger: creation from verified paid orders, maturity after
// the holding period, reversal on refund/chargeback, and admin review.
//
// Creation is idempotent twice over: it only runs for a PAID order with a
// SUCCEEDED payment, and the (orderItemId, type) unique constraint plus
// `skipDuplicates` mean a repeated webhook, a retried job or two concurrent
// callers can never create a second row for the same sale.

const reason = (s: unknown) => (typeof s === "string" ? s.trim().slice(0, 1000) : "");

/**
 * Creates the Partner (and, if applicable, Master Partner) commissions for a
 * paid order that was credited to a Partner at checkout. Safe to call any
 * number of times. Returns how many new rows were written.
 */
export async function createCommissionsForOrder(orderId: string): Promise<number> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      currency: true,
      items: { select: { id: true, unitPriceCents: true, quantity: true, product: { select: { categoryId: true } } } },
      payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1, select: { status: true, provider: true } },
      partnerReferral: {
        select: {
          partner: {
            select: {
              id: true,
              userId: true,
              status: true,
              masterStatus: true,
              recruitedAt: true,
              recruitedBy: { select: { id: true, userId: true, status: true, masterStatus: true } },
            },
          },
        },
      },
    },
  });
  if (!order?.partnerReferral) return 0;

  const commissionable = isCommissionableOrder({
    orderStatus: order.status,
    payment: order.payments[0] ?? null,
    isProduction: env.NODE_ENV === "production",
    allowManualPayments: env.PARTNERSHIP_ALLOW_MANUAL_PAYMENT_COMMISSIONS,
  });
  if (!commissionable) return 0;

  const settings = await getPartnershipSettings();
  if (!settings.currencies.includes(order.currency)) {
    logger.warn("partnership: order currency not supported by the programme — no commission", { orderId, currency: order.currency });
    return 0;
  }
  const partner = order.partnerReferral.partner;
  const planned = planOrderCommissions({
    buyerId: order.userId,
    partner: {
      id: partner.id,
      userId: partner.userId,
      status: partner.status,
      masterStatus: partner.masterStatus,
      // Only a confirmed recruitment (recruitedAt set at approval) earns the Master Partner commission.
      recruiter: partner.recruitedAt && partner.recruitedBy ? partner.recruitedBy : null,
    },
    items: order.items.map((i) => ({ orderItemId: i.id, basisCents: i.unitPriceCents * i.quantity, categoryId: i.product.categoryId })),
    partnerRateBps: settings.partnerRateBps,
    masterRateBps: settings.masterRateBps,
    eligibleCategoryIds: settings.eligibleCategoryIds,
  });
  if (planned.length === 0) return 0;

  const hold = holdUntil(new Date(), settings.holdDays);
  const result = await db.partnerCommission.createMany({
    data: planned.map((c) => ({
      ...c,
      orderId: order.id,
      buyerId: order.userId,
      currency: order.currency,
      status: "PENDING" as const,
      holdUntil: hold,
    })),
    skipDuplicates: true,
  });
  if (result.count === 0) return 0;

  await recordAuditLog({
    actorId: null,
    action: "partnership.commission.create",
    entityType: "Order",
    entityId: order.id,
    metadata: { commissions: planned.map((c) => ({ beneficiaryId: c.beneficiaryId, type: c.type, amountCents: c.amountCents, rateBps: c.rateBps })) },
  });

  const perBeneficiary = new Map<string, number>();
  for (const c of planned) perBeneficiary.set(c.beneficiaryId, (perBeneficiary.get(c.beneficiaryId) ?? 0) + c.amountCents);
  const owners = await db.partnerProfile.findMany({ where: { id: { in: [...perBeneficiary.keys()] } }, select: { id: true, userId: true } });
  for (const o of owners) {
    void notify({
      userId: o.userId,
      type: "PARTNERSHIP",
      title: "New pending commission",
      body: `${formatMoney(perBeneficiary.get(o.id) ?? 0, order.currency)} from a referred purchase. It becomes available after the ${settings.holdDays}-day holding period.`,
      link: "/dashboard/partnership/commissions",
    }).catch(() => undefined);
  }
  return result.count;
}

/** Fail-soft wrapper used from the checkout path: a commission problem must never affect a paid order. */
export async function createCommissionsForOrderSafely(orderId: string): Promise<void> {
  try {
    await createCommissionsForOrder(orderId);
  } catch (err) {
    logger.error("partnership: commission creation failed", { orderId, error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Moves commissions whose holding period has ended to APPROVED — but only
 * while their order is still PAID with no refund request open. Called lazily
 * (dashboard and admin views, payout requests); there is no scheduler.
 */
export async function releaseMaturedCommissions(now = new Date()): Promise<number> {
  const { count } = await db.partnerCommission.updateMany({
    where: {
      status: "PENDING",
      holdUntil: { lte: now },
      order: { status: "PAID", refunds: { none: { status: "REQUESTED" } } },
    },
    data: { status: "APPROVED", approvedAt: now },
  });
  return count;
}

/** Keeps a payout request's amount equal to the commissions still attached to it. */
async function recomputePayout(tx: Tx, payoutId: string, emptyReason: string) {
  const payout = await tx.partnerPayout.findUnique({ where: { id: payoutId }, select: { status: true } });
  if (!payout || (payout.status !== "REQUESTED" && payout.status !== "APPROVED")) return;
  const agg = await tx.partnerCommission.aggregate({ where: { payoutId }, _sum: { amountCents: true } });
  const amount = agg._sum.amountCents ?? 0;
  await tx.partnerPayout.update({
    where: { id: payoutId },
    data: amount > 0 ? { amountCents: amount } : { amountCents: 0, status: "REJECTED", rejectionReason: emptyReason, decidedAt: new Date() },
  });
}

/**
 * Reverses every unpaid commission on an order (refund, chargeback). Already
 * paid commissions are not clawed back — they're flagged for an admin to
 * handle with a recorded adjustment. Idempotent.
 */
export async function reverseCommissionsForOrder(orderId: string, why: string, actorId: string | null): Promise<void> {
  const rows = await db.partnerCommission.findMany({
    where: { orderId },
    select: { id: true, status: true, payoutId: true, amountCents: true, currency: true, beneficiaryId: true, payout: { select: { status: true } } },
  });
  if (rows.length === 0) return;
  const plan = planReversal(rows.map((r) => ({ id: r.id, status: r.status, payoutId: r.payoutId, payoutStatus: r.payout?.status ?? null })));

  if (plan.reverse.length > 0) {
    const now = new Date();
    await db.$transaction(async (tx) => {
      const ids = plan.reverse.map((r) => r.id);
      await tx.partnerCommission.updateMany({
        where: { id: { in: ids }, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "REVERSED", reversedAt: now, statusReason: why, payoutId: null },
      });
      const payouts = new Set(plan.reverse.map((r) => r.detachFromPayoutId).filter((p): p is string => Boolean(p)));
      for (const payoutId of payouts) await recomputePayout(tx, payoutId, "Every commission in this request was reversed.");
    });

    await recordAuditLog({
      actorId,
      action: "partnership.commission.reverse",
      entityType: "Order",
      entityId: orderId,
      metadata: { commissionIds: plan.reverse.map((r) => r.id), reason: why },
    });
    const affected = rows.filter((r) => plan.reverse.some((p) => p.id === r.id));
    const owners = await db.partnerProfile.findMany({ where: { id: { in: affected.map((r) => r.beneficiaryId) } }, select: { id: true, userId: true } });
    for (const o of owners) {
      void notify({
        userId: o.userId,
        type: "PARTNERSHIP",
        title: "Commission reversed",
        body: `A referred order was refunded, so the commission on it was reversed. Reason: ${why}`,
        link: "/dashboard/partnership/commissions",
      }).catch(() => undefined);
    }
  }

  if (plan.alreadyPaid.length > 0) {
    await recordSecurityEvent({
      type: "OTHER",
      severity: "MEDIUM",
      metadata: { note: "Partnership: refunded order has commission that was already paid out — review for adjustment", orderId, commissionIds: plan.alreadyPaid },
    });
    await recordAuditLog({
      actorId,
      action: "partnership.commission.paid_on_refunded_order",
      entityType: "Order",
      entityId: orderId,
      metadata: { commissionIds: plan.alreadyPaid, reason: why },
    });
  }
}

export async function reverseCommissionsForOrderSafely(orderId: string, why: string, actorId: string | null) {
  try {
    await reverseCommissionsForOrder(orderId, why, actorId);
  } catch (err) {
    logger.error("partnership: commission reversal failed", { orderId, error: err instanceof Error ? err.message : String(err) });
    await recordSecurityEvent({
      type: "OTHER",
      severity: "HIGH",
      metadata: { note: "Partnership: commission reversal failed for refunded order — review manually", orderId },
    }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------

export async function rejectCommission(actorId: string, commissionId: string, rawReason: unknown) {
  const why = reason(rawReason);
  if (!why) throw new PartnershipError("Please give a reason — it's shown to the Partner and kept in the audit log.");
  const row = await db.partnerCommission.findUnique({ where: { id: commissionId }, include: { payout: { select: { status: true } }, beneficiary: { select: { userId: true } } } });
  if (!row) throw new PartnershipError("Commission not found.", 404);
  if (row.beneficiary.userId === actorId) throw new PartnershipError("You can't review your own commission.", 403);
  if (row.status !== "PENDING" && row.status !== "APPROVED") throw new PartnershipError(`A ${row.status.toLowerCase()} commission can't be rejected.`, 409);
  if (row.payout?.status === "PAID") throw new PartnershipError("This commission has already been paid out.", 409);

  await db.$transaction(async (tx) => {
    const res = await tx.partnerCommission.updateMany({
      where: { id: commissionId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "REJECTED", statusReason: why, payoutId: null },
    });
    if (res.count === 0) throw new PartnershipError("This commission changed. Please refresh.", 409);
    if (row.payoutId) await recomputePayout(tx, row.payoutId, "Every commission in this request was rejected.");
  });
  await recordAuditLog({ actorId, action: "partnership.commission.reject", entityType: "PartnerCommission", entityId: commissionId, metadata: { reason: why, from: row.status } });
  void notify({
    userId: row.beneficiary.userId,
    type: "PARTNERSHIP",
    title: "Commission rejected",
    body: `A commission of ${formatMoney(row.amountCents, row.currency)} was rejected. Reason: ${why}`,
    link: "/dashboard/partnership/commissions",
  }).catch(() => undefined);
}

/** Releases a pending commission before its holding period ends. Requires a reason; the order must still be paid. */
export async function approveCommissionEarly(actorId: string, commissionId: string, rawReason: unknown) {
  const why = reason(rawReason);
  if (!why) throw new PartnershipError("Please give a reason for approving before the holding period ends.");
  const row = await db.partnerCommission.findUnique({ where: { id: commissionId }, include: { order: { select: { status: true } }, beneficiary: { select: { userId: true } } } });
  if (!row) throw new PartnershipError("Commission not found.", 404);
  if (row.beneficiary.userId === actorId) throw new PartnershipError("You can't review your own commission.", 403);
  if (row.order.status !== "PAID") throw new PartnershipError("The order is no longer paid.", 409);
  const res = await db.partnerCommission.updateMany({
    where: { id: commissionId, status: "PENDING" },
    data: { status: "APPROVED", approvedAt: new Date(), statusReason: why },
  });
  if (res.count === 0) throw new PartnershipError("Only a pending commission can be approved early.", 409);
  await recordAuditLog({ actorId, action: "partnership.commission.approve_early", entityType: "PartnerCommission", entityId: commissionId, metadata: { reason: why } });
}

/** Admin tool: re-run commission creation for an order (idempotent — never duplicates). */
export async function recalculateOrderCommissions(actorId: string, orderId: string) {
  const exists = await db.order.findUnique({ where: { id: orderId.trim() }, select: { id: true } });
  if (!exists) throw new PartnershipError("Order not found.", 404);
  const created = await createCommissionsForOrder(exists.id);
  await recordAuditLog({ actorId, action: "partnership.commission.recalculate", entityType: "Order", entityId: exists.id, metadata: { created } });
  return created;
}
