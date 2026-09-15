import { db } from "@/lib/db";
import { getSellerBalance, recordLedgerEntry } from "@/repositories/ledger-repository";
import { recordAuditLog } from "@/repositories/audit-log-repository";
import { enqueueEmail } from "@/jobs/send-email";
import { buildPayoutEmail } from "@/emails/templates";

export class PayoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MIN_PAYOUT_CENTS = 1000; // $10 — an arbitrary but sane floor to avoid payout spam for pennies

/** A seller requests their current balance be paid out. Doesn't move any
 * money itself — see the Payout model comment: processing is manual/
 * external until a real payout processor is wired up. */
export async function requestPayout(sellerId: string) {
  const [balanceCents, pending] = await Promise.all([
    getSellerBalance(sellerId),
    db.payout.findFirst({ where: { sellerId, status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);
  if (pending) throw new PayoutError("You already have a payout in progress.", 409);
  if (balanceCents < MIN_PAYOUT_CENTS) {
    throw new PayoutError(`Balance must be at least $${(MIN_PAYOUT_CENTS / 100).toFixed(2)} to request a payout.`, 409);
  }

  const profile = await db.sellerProfile.findUnique({ where: { userId: sellerId } });

  return db.payout.create({
    data: {
      sellerId,
      amountCents: balanceCents,
      currency: "USD",
      status: "PENDING",
      payoutEmail: profile?.payoutEmail,
    },
  });
}

async function updatePayoutStatus(payoutId: string, status: "PROCESSING" | "PAID" | "FAILED", actorId: string) {
  const payout = await db.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new PayoutError("Payout not found.", 404);

  const canTransition = payout.status === "PENDING" || (payout.status === "PROCESSING" && status !== "PROCESSING");
  if (!canTransition) {
    throw new PayoutError(`Payout is already ${payout.status.toLowerCase()}.`, 409);
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.payout.update({
      where: { id: payoutId },
      data: { status, processedAt: new Date(), processedByUserId: actorId },
    });
    if (status === "PAID") {
      await recordLedgerEntry(
        {
          sellerId: payout.sellerId,
          type: "PAYOUT",
          amountCents: -payout.amountCents,
          currency: payout.currency,
          payoutId: payout.id,
          description: `Payout ${payout.id.slice(0, 8)}`,
        },
        tx
      );
    }
    return result;
  });

  await recordAuditLog({
    actorId,
    action: `payout.${status.toLowerCase()}`,
    entityType: "Payout",
    entityId: payoutId,
  });

  if (status === "PROCESSING" || status === "PAID") {
    const seller = await db.user.findUnique({ where: { id: payout.sellerId } });
    if (seller) void enqueueEmail(seller.email, buildPayoutEmail(payout.amountCents, payout.currency, status === "PAID" ? "PAID" : "PROCESSING"));
  }

  return updated;
}

export async function markPayoutProcessing(payoutId: string, actorId: string) {
  return updatePayoutStatus(payoutId, "PROCESSING", actorId);
}

export async function markPayoutPaid(payoutId: string, actorId: string) {
  return updatePayoutStatus(payoutId, "PAID", actorId);
}

export async function markPayoutFailed(payoutId: string, actorId: string) {
  return updatePayoutStatus(payoutId, "FAILED", actorId);
}

export async function listPayouts(page: number, pageSize: number, status?: "PENDING" | "PROCESSING" | "PAID" | "FAILED") {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    db.payout.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { seller: { select: { name: true, email: true } } },
    }),
    db.payout.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function listSellerPayouts(sellerId: string) {
  return db.payout.findMany({ where: { sellerId }, orderBy: { requestedAt: "desc" } });
}
