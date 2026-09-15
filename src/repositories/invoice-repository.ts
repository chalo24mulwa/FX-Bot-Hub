import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

function generateInvoiceNumber(orderItemId: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = orderItemId.slice(-6).toUpperCase();
  return `INV-${stamp}-${suffix}`;
}

export interface CreateInvoiceInput {
  orderId: string;
  orderItemId: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  amountCents: number;
  currency: string;
  paymentReference?: string;
}

/** One invoice per OrderItem — see the Invoice model comment in
 * schema.prisma for why. Idempotent on orderItemId (its own unique
 * constraint) so calling this twice for the same item is safe. */
export async function createInvoiceForOrderItem(input: CreateInvoiceInput, tx: Prisma.TransactionClient = db) {
  const existing = await tx.invoice.findUnique({ where: { orderItemId: input.orderItemId } });
  if (existing) return existing;

  return tx.invoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber(input.orderItemId),
      status: "PAID",
      ...input,
    },
  });
}

export async function getInvoice(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      order: true,
      orderItem: true,
      buyer: { select: { name: true, email: true } },
      seller: { select: { name: true, email: true, sellerProfile: { select: { displayName: true } } } },
      product: { select: { name: true, slug: true } },
    },
  });
}

export async function markInvoiceRefunded(orderItemId: string) {
  return db.invoice.update({ where: { orderItemId }, data: { status: "REFUNDED" } });
}

export async function listInvoicesForBuyer(buyerId: string, page: number, pageSize: number) {
  const where = { buyerId };
  const [items, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { product: { select: { name: true } }, seller: { select: { name: true } } },
    }),
    db.invoice.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function listInvoicesForSeller(sellerId: string, page: number, pageSize: number) {
  const where = { sellerId };
  const [items, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { product: { select: { name: true } }, buyer: { select: { name: true, email: true } } },
    }),
    db.invoice.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
