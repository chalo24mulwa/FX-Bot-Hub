import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { buildPartnershipUpdateEmail } from "@/emails/templates";
import { resolveSiteUrl } from "@/lib/site-url";
import { formatMoney, planPayout } from "@/lib/partnership/rules";
import { PartnershipError, getPartnershipSettings } from "./core";
import { releaseMaturedCommissions } from "./commission-service";

// Partner payouts. No processor is connected: a request reserves the
// Partner's approved commissions, an admin approves it, sends the money
// through the chosen channel outside the app, then records the transfer
// reference — only that last step marks anything PAID.

export const PAYOUT_METHOD_LABELS: Record<string, string> = {
  MPESA: "M-Pesa",
  BANK_TRANSFER: "Bank transfer",
};

const DESTINATION_PATTERN = /^[\p{L}\p{N} .,:/#@+\-()]{5,120}$/u;

export async function requestPartnerPayout(userId: string, input: { currency?: unknown; method?: unknown; destination?: unknown }) {
  const settings = await getPartnershipSettings();
  const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
  const method = typeof input.method === "string" ? input.method : "";
  const destination = typeof input.destination === "string" ? input.destination.trim() : "";
  if (!/^[A-Z]{3}$/.test(currency)) throw new PartnershipError("Choose a currency.");
  if (!settings.payoutMethods.includes(method)) throw new PartnershipError("Choose one of the available payout methods.");
  if (!DESTINATION_PATTERN.test(destination)) {
    throw new PartnershipError("Enter where the payout should go — for example your M-Pesa number, or your bank name and account number (5–120 characters).");
  }

  const profile = await db.partnerProfile.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!profile) throw new PartnershipError("You're not a Partner.", 403);

  await releaseMaturedCommissions();

  const payout = await db.$transaction(async (tx) => {
    const [open, commissions] = await Promise.all([
      tx.partnerPayout.count({ where: { partnerId: profile.id, currency, status: { in: ["REQUESTED", "APPROVED"] } } }),
      tx.partnerCommission.findMany({
        where: { beneficiaryId: profile.id, currency, status: "APPROVED", payoutId: null },
        select: { id: true, status: true, payoutId: true, amountCents: true, order: { select: { status: true } } },
      }),
    ]);
    const plan = planPayout({
      partnerStatus: profile.status,
      hasOpenPayout: open > 0,
      minPayoutCents: settings.minPayoutCents,
      commissions: commissions.map((c) => ({ ...c, orderStatus: c.order.status })),
    });
    if (!plan.ok) throw new PartnershipError(plan.reason, 409);

    const created = await tx.partnerPayout.create({
      data: { partnerId: profile.id, amountCents: plan.amountCents, currency, method, destination },
    });
    // Reserve exactly the planned rows; a concurrent request that already took
    // any of them makes the counts differ and rolls this one back.
    const linked = await tx.partnerCommission.updateMany({
      where: { id: { in: plan.commissionIds }, payoutId: null, status: "APPROVED" },
      data: { payoutId: created.id },
    });
    if (linked.count !== plan.commissionIds.length) throw new PartnershipError("Your balance changed while requesting. Please try again.", 409);
    return created;
  });

  await recordAuditLog({
    actorId: userId,
    action: "partnership.payout.request",
    entityType: "PartnerPayout",
    entityId: payout.id,
    metadata: { amountCents: payout.amountCents, currency, method },
  });
  return payout;
}

async function notifyPayout(partnerId: string, title: string, message: string) {
  const profile = await db.partnerProfile.findUnique({ where: { id: partnerId }, select: { userId: true } });
  if (!profile) return;
  const url = `${resolveSiteUrl().replace(/\/$/, "")}/dashboard/partnership/payouts`;
  void notify({
    userId: profile.userId,
    type: "PARTNERSHIP",
    title,
    body: message,
    link: "/dashboard/partnership/payouts",
    email: buildPartnershipUpdateEmail(title, message, url),
  }).catch(() => undefined);
}

async function loadForDecision(actorId: string, payoutId: string) {
  const payout = await db.partnerPayout.findUnique({ where: { id: payoutId }, include: { partner: { select: { userId: true } } } });
  if (!payout) throw new PartnershipError("Payout not found.", 404);
  if (payout.partner.userId === actorId) throw new PartnershipError("You can't process your own payout.", 403);
  return payout;
}

export async function approvePartnerPayout(actorId: string, payoutId: string) {
  const payout = await loadForDecision(actorId, payoutId);
  const res = await db.partnerPayout.updateMany({
    where: { id: payoutId, status: "REQUESTED", amountCents: { gt: 0 } },
    data: { status: "APPROVED", decidedAt: new Date(), decidedById: actorId },
  });
  if (res.count === 0) throw new PartnershipError("Only a requested payout can be approved.", 409);
  await recordAuditLog({ actorId, action: "partnership.payout.approve", entityType: "PartnerPayout", entityId: payoutId });
  await notifyPayout(payout.partnerId, "Payout approved", `Your payout of ${formatMoney(payout.amountCents, payout.currency)} was approved and will be sent shortly.`);
}

export async function rejectPartnerPayout(actorId: string, payoutId: string, rawReason: unknown) {
  const why = typeof rawReason === "string" ? rawReason.trim().slice(0, 1000) : "";
  if (!why) throw new PartnershipError("Please give a reason — it's shown to the Partner.");
  const payout = await loadForDecision(actorId, payoutId);
  await db.$transaction(async (tx) => {
    const res = await tx.partnerPayout.updateMany({
      where: { id: payoutId, status: { in: ["REQUESTED", "APPROVED"] } },
      data: { status: "REJECTED", rejectionReason: why, decidedAt: new Date(), decidedById: actorId },
    });
    if (res.count === 0) throw new PartnershipError("Only an open payout can be rejected.", 409);
    // The commissions go back to the Partner's available balance.
    await tx.partnerCommission.updateMany({ where: { payoutId, status: "APPROVED" }, data: { payoutId: null } });
  });
  await recordAuditLog({ actorId, action: "partnership.payout.reject", entityType: "PartnerPayout", entityId: payoutId, metadata: { reason: why } });
  await notifyPayout(payout.partnerId, "Payout request rejected", `Your payout request was rejected and the balance is available again. Reason: ${why}`);
}

/** Records that the money has actually been sent. The only path that marks commissions PAID. */
export async function markPartnerPayoutPaid(actorId: string, payoutId: string, rawReference: unknown) {
  const reference = typeof rawReference === "string" ? rawReference.trim().slice(0, 120) : "";
  if (reference.length < 3) throw new PartnershipError("Enter the transfer reference (for example the M-Pesa transaction code).");
  const payout = await loadForDecision(actorId, payoutId);
  const now = new Date();

  const paid = await db.$transaction(async (tx) => {
    const current = await tx.partnerPayout.findUnique({ where: { id: payoutId } });
    if (!current || current.status !== "APPROVED") throw new PartnershipError("Approve the payout before marking it paid.", 409);
    const agg = await tx.partnerCommission.aggregate({ where: { payoutId, status: "APPROVED" }, _sum: { amountCents: true } });
    const amount = agg._sum.amountCents ?? 0;
    if (amount <= 0) throw new PartnershipError("This payout no longer contains any commission.", 409);
    const res = await tx.partnerPayout.updateMany({
      where: { id: payoutId, status: "APPROVED" },
      data: { status: "PAID", paidAt: now, paymentReference: reference, amountCents: amount },
    });
    if (res.count === 0) throw new PartnershipError("This payout changed. Please refresh.", 409);
    await tx.partnerCommission.updateMany({ where: { payoutId, status: "APPROVED" }, data: { status: "PAID", paidAt: now } });
    return amount;
  });

  await recordAuditLog({
    actorId,
    action: "partnership.payout.paid",
    entityType: "PartnerPayout",
    entityId: payoutId,
    metadata: { amountCents: paid, currency: payout.currency, reference },
  });
  await notifyPayout(payout.partnerId, "Payout sent", `Your payout of ${formatMoney(paid, payout.currency)} has been sent. Reference: ${reference}`);
}
