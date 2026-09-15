import { db } from "@/lib/db";
import type { LedgerEntryType, Prisma } from "@prisma/client";

export interface RecordLedgerEntryInput {
  sellerId: string;
  type: LedgerEntryType;
  /** Signed: positive credits the seller's balance, negative debits it. */
  amountCents: number;
  currency: string;
  orderId?: string;
  orderItemId?: string;
  refundId?: string;
  payoutId?: string;
  description: string;
}

export async function recordLedgerEntry(input: RecordLedgerEntryInput, tx: Prisma.TransactionClient = db) {
  return tx.ledgerEntry.create({ data: input });
}

/** Batch variant — one `createMany` instead of N sequential inserts, used
 * by completePaidOrder()'s per-order-item loop (each item posts a SALE and
 * a COMMISSION entry). */
export async function recordLedgerEntries(inputs: RecordLedgerEntryInput[], tx: Prisma.TransactionClient = db) {
  if (inputs.length === 0) return;
  await tx.ledgerEntry.createMany({ data: inputs });
}

/** A seller's balance is always the sum of their own ledger history —
 * never a stored counter — so it can't drift from what actually happened.
 * See the LedgerEntry model comment in schema.prisma. */
export async function getSellerBalance(sellerId: string): Promise<number> {
  const result = await db.ledgerEntry.aggregate({
    where: { sellerId },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}

export async function listLedgerEntries(sellerId: string, page: number, pageSize: number) {
  const [items, total] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.ledgerEntry.count({ where: { sellerId } }),
  ]);
  return { items, total, page, pageSize };
}

export interface LedgerDateRange {
  from?: Date;
  to?: Date;
}

/** Marketplace-wide totals by entry type over an optional date range — the
 * admin finance dashboard's source of truth. Commission entries are stored
 * negative (they debit the seller); this returns their absolute magnitude
 * since "commissions collected" is naturally a positive figure to report. */
export async function getLedgerTotals(range: LedgerDateRange = {}) {
  const where: Prisma.LedgerEntryWhereInput = {
    createdAt: range.from || range.to ? { gte: range.from, lte: range.to } : undefined,
  };

  const byType = await db.ledgerEntry.groupBy({
    by: ["type"],
    where,
    _sum: { amountCents: true },
  });

  const totals = Object.fromEntries(byType.map((row) => [row.type, row._sum.amountCents ?? 0])) as Record<
    LedgerEntryType,
    number
  >;

  return {
    salesCents: totals.SALE ?? 0,
    commissionCents: Math.abs(totals.COMMISSION ?? 0),
    refundCents: Math.abs(totals.REFUND ?? 0),
    payoutCents: Math.abs(totals.PAYOUT ?? 0),
    adjustmentCents: totals.ADJUSTMENT ?? 0,
  };
}

/** Every seller's current balance in one query (grouped sum), for the
 * admin finance dashboard's "outstanding seller balances" — never a
 * per-seller loop. */
export async function listOutstandingSellerBalances(minBalanceCents = 1) {
  const grouped = await db.ledgerEntry.groupBy({
    by: ["sellerId"],
    _sum: { amountCents: true },
  });
  const positive = grouped
    .map((g) => ({ sellerId: g.sellerId, balanceCents: g._sum.amountCents ?? 0 }))
    .filter((g) => g.balanceCents >= minBalanceCents)
    .sort((a, b) => b.balanceCents - a.balanceCents);

  if (positive.length === 0) return [];

  const sellers = await db.user.findMany({
    where: { id: { in: positive.map((p) => p.sellerId) } },
    select: { id: true, name: true, email: true, sellerProfile: { select: { displayName: true, payoutEmail: true } } },
  });
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));

  return positive.map((p) => ({ ...p, seller: sellerMap.get(p.sellerId) ?? null }));
}
